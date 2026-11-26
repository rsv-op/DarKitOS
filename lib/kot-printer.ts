import "server-only";
import crypto from "crypto";
import type { KotTicketData } from "@/lib/kot-format";

export interface DispatchKotPrintInput {
  ticket: KotTicketData;
  escPosPayload: string;
  actor: string;
  fetchImpl?: typeof fetch;
}

export interface DispatchKotPrintResult {
  ok: true;
  mode: "LAN_BRIDGE" | "SANDBOX_BRIDGE";
  printJobId: string;
  bridgeUrl?: string;
  signed: boolean;
}

export function computeKotBridgeSignature(
  rawBody: string,
  secret: string,
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
}

/**
 * Dispatches an 80mm ESC/POS ticket to an optional LAN print relay (`KOT_BRIDGE_URL`)
 * with HMAC-SHA256 signing (`KOT_BRIDGE_SECRET`), or returns a deterministic
 * offline sandbox print acknowledgment when no LAN relay is configured.
 */
export async function dispatchKotPrintJob(
  input: DispatchKotPrintInput,
): Promise<DispatchKotPrintResult> {
  const bridgeUrl = process.env.KOT_BRIDGE_URL?.trim();
  const bridgeSecret = process.env.KOT_BRIDGE_SECRET?.trim();
  const timestamp = new Date().toISOString();

  if (bridgeUrl) {
    const rawBody = JSON.stringify({
      ticket: input.ticket,
      escPosPayload: input.escPosPayload,
      actor: input.actor,
      timestamp,
    });
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (bridgeSecret) {
      headers["X-KOT-Signature"] = computeKotBridgeSignature(
        rawBody,
        bridgeSecret,
      );
    }

    const doFetch = input.fetchImpl ?? fetch;
    const response = await doFetch(bridgeUrl, {
      method: "POST",
      headers,
      body: rawBody,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `LAN KOT print bridge rejected job (${response.status}): ${errText.slice(0, 180)}`,
      );
    }

    const body = (await response.json().catch(() => ({}))) as {
      printJobId?: string;
      jobId?: string;
    };
    const fallbackId = `kot_lan_${crypto
      .createHash("sha256")
      .update(`${input.ticket.orderId}:${timestamp}`)
      .digest("hex")
      .slice(0, 12)}`;

    return {
      ok: true,
      mode: "LAN_BRIDGE",
      printJobId: body.printJobId || body.jobId || fallbackId,
      bridgeUrl,
      signed: Boolean(bridgeSecret),
    };
  }

  const hash = crypto
    .createHash("sha256")
    .update(
      `kot:${input.ticket.orderId}:${input.ticket.kitchenId}:${input.escPosPayload.length}:${timestamp}`,
    )
    .digest("hex")
    .slice(0, 14);

  return {
    ok: true,
    mode: "SANDBOX_BRIDGE",
    printJobId: `kot_sbx_${hash}`,
    signed: false,
  };
}
