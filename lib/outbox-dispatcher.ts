import "server-only";
import crypto from "crypto";
import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import type { OutboxEvent } from "@/lib/db";
import {
  getOutboxEvents,
  logOperationalActivity,
  updateOutboxEventDelivery,
} from "@/lib/store";
import {
  pushUrbanPiperOrderStatus,
  submitUrbanPiperDisputeClaim,
} from "@/lib/urbanpiper";

export interface WorkerAuthResult {
  authorized: boolean;
  authMethod?: "CRON_SECRET" | "QSTASH_SIGNATURE";
  error?: string;
}

function timingSafeStringEqual(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function verifyUpstashSignatureJwt(
  signatureHeader: string,
  rawBody: string,
): Promise<boolean> {
  const keys = [
    process.env.QSTASH_CURRENT_SIGNING_KEY?.trim(),
    process.env.QSTASH_NEXT_SIGNING_KEY?.trim(),
  ].filter((k): k is string => Boolean(k));

  if (keys.length === 0) {
    return false;
  }

  for (const key of keys) {
    try {
      const secretBytes = new TextEncoder().encode(key);
      const { payload } = await jwtVerify(signatureHeader, secretBytes, {
        issuer: "Upstash",
      });
      if (typeof payload.body === "string" && payload.body.length > 0) {
        const expectedHash = crypto
          .createHash("sha256")
          .update(rawBody, "utf8")
          .digest("base64url");
        const expectedHex = crypto
          .createHash("sha256")
          .update(rawBody, "utf8")
          .digest("hex");
        const normalizedBodyClaim = payload.body.replace(/=+$/, "");
        if (
          normalizedBodyClaim !== expectedHash &&
          payload.body !== expectedHex
        ) {
          continue;
        }
      }
      return true;
    } catch {
      // Try next signing key
    }
  }

  return false;
}

/**
 * Strictly authenticates worker/cron endpoints via Bearer CRON_SECRET
 * or Upstash-Signature JWT. Never bypasses auth in Demo Sandbox mode.
 */
export async function verifyWorkerAuth(
  request: NextRequest,
  rawBody = "",
): Promise<WorkerAuthResult> {
  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";

  if (cronSecret && authHeader.toLowerCase().startsWith("bearer ")) {
    const providedToken = authHeader.slice(7).trim();
    if (providedToken && timingSafeStringEqual(cronSecret, providedToken)) {
      return { authorized: true, authMethod: "CRON_SECRET" };
    }
  }

  const upstashSig = request.headers.get("upstash-signature")?.trim() ?? "";
  if (upstashSig) {
    const valid = await verifyUpstashSignatureJwt(upstashSig, rawBody);
    if (valid) {
      return { authorized: true, authMethod: "QSTASH_SIGNATURE" };
    }
  }

  return {
    authorized: false,
    error:
      "Unauthorized worker call. Provide a valid Bearer CRON_SECRET or Upstash-Signature JWT.",
  };
}

/**
 * Exponential backoff schedule in seconds:
 * attempt 1 -> 30s, attempt 2 -> 120s (2m), attempt 3 -> 480s (8m), attempt 4 -> 1920s (32m).
 */
export function calculateOutboxBackoffSeconds(attempt: number): number {
  const exp = Math.max(0, attempt - 1);
  return 30 * Math.pow(4, exp);
}

export interface ProcessOutboxOptions {
  limit?: number;
  now?: Date;
  organizationId?: string;
  kitchenId?: string;
  deliverFn?: (event: OutboxEvent) => Promise<void>;
}

export interface ProcessOutboxResult {
  processed: number;
  delivered: number;
  retrying: number;
  failed: number;
  events: OutboxEvent[];
}

async function defaultDeliverOutboxEvent(event: OutboxEvent): Promise<void> {
  if (event.destination !== "URBANPIPER") {
    return;
  }

  let parsedPayload: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(event.payload);
    if (parsed && typeof parsed === "object") {
      parsedPayload = parsed as Record<string, unknown>;
    }
  } catch {
    throw new Error(`Malformed JSON payload on outbox event ${event.id}`);
  }

  const externalOrderId = String(
    parsedPayload.externalOrderId ?? parsedPayload.orderId ?? event.aggregateId,
  ).trim();

  if (event.eventType === "AGGREGATOR_CLAIM_SUBMITTED") {
    const claimAmount = Number(parsedPayload.claimAmount ?? 0);
    const reason = String(
      parsedPayload.reason ?? "Post-pickup cancellation claim",
    );
    const evidence =
      parsedPayload.evidence && typeof parsedPayload.evidence === "object"
        ? (parsedPayload.evidence as Record<string, unknown>)
        : {};
    await submitUrbanPiperDisputeClaim({
      externalOrderId,
      claimAmount,
      reason,
      evidence,
    });
    return;
  }

  const newStatus = String(parsedPayload.newStatus ?? event.eventType);
  const details =
    typeof parsedPayload.details === "string"
      ? parsedPayload.details
      : undefined;
  await pushUrbanPiperOrderStatus({
    externalOrderId,
    newStatus,
    details,
  });
}

/**
 * Processes due PENDING / RETRYING outbox events in deterministic FIFO order,
 * applying exponential backoff on transient failures and dead-lettering to FAILED
 * once attempt >= maxAttempts.
 */
export async function processOutboxQueue(
  options: ProcessOutboxOptions = {},
): Promise<ProcessOutboxResult> {
  const nowDate = options.now ?? new Date();
  const nowMs = nowDate.getTime();
  const nowIso = nowDate.toISOString();
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));

  const allEvents = await getOutboxEvents({
    organizationId: options.organizationId,
    kitchenId: options.kitchenId,
  });

  const dueEvents = allEvents
    .filter((event) => {
      if (event.status !== "PENDING" && event.status !== "RETRYING") {
        return false;
      }
      if (!event.nextRetryAt) return true;
      return new Date(event.nextRetryAt).getTime() <= nowMs;
    })
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .slice(0, limit);

  let delivered = 0;
  let retrying = 0;
  let failed = 0;
  const processedEvents: OutboxEvent[] = [];

  for (const event of dueEvents) {
    const nextAttempt = event.attempt + 1;
    try {
      if (options.deliverFn) {
        await options.deliverFn(event);
      } else {
        await defaultDeliverOutboxEvent(event);
      }

      const updated = await updateOutboxEventDelivery(event.id, {
        status: "DELIVERED",
        attempt: nextAttempt,
        nextRetryAt: null,
        lastError: null,
        deliveredAt: nowIso,
      });
      delivered += 1;
      processedEvents.push(updated);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Outbox delivery failed";

      if (nextAttempt >= event.maxAttempts) {
        const updated = await updateOutboxEventDelivery(event.id, {
          status: "FAILED",
          attempt: nextAttempt,
          nextRetryAt: null,
          lastError: errorMessage,
          deliveredAt: null,
        });
        failed += 1;
        processedEvents.push(updated);

        await logOperationalActivity({
          organizationId: event.organizationId,
          type: "OUTBOX_DEAD_LETTER",
          category: "INTEGRATION",
          title: `Outbox Dead-Lettered (${event.eventType})`,
          details: `Event ${event.id} for ${event.aggregateId} failed after ${nextAttempt}/${event.maxAttempts} attempts: ${errorMessage}`,
          actor: "OUTBOX_WORKER",
          orderId: event.aggregateId.startsWith("ORD-")
            ? event.aggregateId
            : undefined,
          kitchenId: event.kitchenId,
          severity: "error",
        });
      } else {
        const backoffSecs = calculateOutboxBackoffSeconds(nextAttempt);
        const nextRetryAt = new Date(nowMs + backoffSecs * 1000).toISOString();
        const updated = await updateOutboxEventDelivery(event.id, {
          status: "RETRYING",
          attempt: nextAttempt,
          nextRetryAt,
          lastError: errorMessage,
          deliveredAt: null,
        });
        retrying += 1;
        processedEvents.push(updated);
      }
    }
  }

  return {
    processed: processedEvents.length,
    delivered,
    retrying,
    failed,
    events: processedEvents,
  };
}

/**
 * Optionally publishes an async trigger to Upstash QStash so `/api/workers/outbox`
 * flushes shortly after an order transition without blocking KDS UI latency.
 */
export async function triggerQStashOutboxFlush(
  targetWorkerUrl?: string,
): Promise<{ published: boolean; messageId?: string; mode: string }> {
  const token = process.env.QSTASH_TOKEN?.trim();
  const baseUrl = (
    targetWorkerUrl ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ""
  ).replace(/\/+$/, "");

  if (!token || !baseUrl) {
    return { published: false, mode: "sandbox_local" };
  }

  const qstashBase = (
    process.env.QSTASH_URL?.trim() || "https://qstash.upstash.io"
  ).replace(/\/+$/, "");
  const destination = baseUrl.endsWith("/api/workers/outbox")
    ? baseUrl
    : `${baseUrl}/api/workers/outbox`;

  try {
    const res = await fetch(
      `${qstashBase}/v2/publish/${encodeURIComponent(destination)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Upstash-Retries": "3",
        },
        body: JSON.stringify({ trigger: "kds_transition" }),
      },
    );
    if (!res.ok) {
      return { published: false, mode: `qstash_http_${res.status}` };
    }
    const body = (await res.json().catch(() => ({}))) as {
      messageId?: string;
    };
    return {
      published: true,
      messageId: body.messageId,
      mode: "qstash_live",
    };
  } catch {
    return { published: false, mode: "qstash_network_error" };
  }
}
