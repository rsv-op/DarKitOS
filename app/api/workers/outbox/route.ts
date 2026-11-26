import { NextRequest, NextResponse } from "next/server";
import {
  processOutboxQueue,
  verifyWorkerAuth,
} from "@/lib/outbox-dispatcher";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    rawBody = "";
  }

  const auth = await verifyWorkerAuth(request, rawBody);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 },
    );
  }

  let limit: number | undefined;
  let organizationId: string | undefined;
  let kitchenId: string | undefined;

  if (rawBody.trim()) {
    try {
      const parsed = JSON.parse(rawBody) as {
        limit?: unknown;
        organizationId?: unknown;
        kitchenId?: unknown;
      };
      if (typeof parsed.limit === "number" && Number.isFinite(parsed.limit)) {
        limit = parsed.limit;
      }
      if (typeof parsed.organizationId === "string" && parsed.organizationId.trim()) {
        organizationId = parsed.organizationId.trim();
      }
      if (typeof parsed.kitchenId === "string" && parsed.kitchenId.trim()) {
        kitchenId = parsed.kitchenId.trim();
      }
    } catch {
      // Optional JSON body; ignore empty/non-JSON payloads from cron schedulers
    }
  }

  const summary = await processOutboxQueue({
    limit,
    organizationId,
    kitchenId,
  });

  return NextResponse.json({
    ok: true,
    authMethod: auth.authMethod,
    processed: summary.processed,
    delivered: summary.delivered,
    retrying: summary.retrying,
    failed: summary.failed,
    events: summary.events,
  });
}
