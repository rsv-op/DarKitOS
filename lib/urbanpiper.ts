import "server-only";
import crypto from "crypto";
import type { OrderChannel, OrderSource } from "@/lib/db";

const SANDBOX_URBANPIPER_WEBHOOK_SECRET = "up_whsec_darkitos_sandbox_dev_only";

export class UrbanPiperError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "UrbanPiperError";
    this.statusCode = statusCode;
  }
}

export function isUrbanPiperLiveConfigured(): boolean {
  return Boolean(process.env.URBANPIPER_API_KEY?.trim());
}

export function isUrbanPiperSandboxAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.DEMO_SANDBOX_MODE === "true"
  );
}

export function resolveUrbanPiperWebhookSecret(override?: string): string | null {
  if (override?.trim()) return override.trim();
  const configured = process.env.URBANPIPER_WEBHOOK_SECRET?.trim();
  if (configured) return configured;
  return isUrbanPiperSandboxAllowed() ? SANDBOX_URBANPIPER_WEBHOOK_SECRET : null;
}

function timingSafeHexEqual(expectedHex: string, actualHex: string): boolean {
  const cleanActual = actualHex.trim().toLowerCase().replace(/^sha256=/, "");
  const cleanExpected = expectedHex.trim().toLowerCase();
  if (
    !cleanActual ||
    cleanActual.length !== cleanExpected.length ||
    !/^[0-9a-f]+$/.test(cleanActual)
  ) {
    return false;
  }
  const a = Buffer.from(cleanExpected, "hex");
  const b = Buffer.from(cleanActual, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyUrbanPiperSignature(params: {
  rawBody: string;
  signature: string | null | undefined;
  secret?: string;
}): boolean {
  const secret = resolveUrbanPiperWebhookSecret(params.secret);
  if (!secret || !params.rawBody || !params.signature) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(params.rawBody, "utf8")
    .digest("hex");
  return timingSafeHexEqual(expected, params.signature);
}

export function computeUrbanPiperSignature(
  rawBody: string,
  secret?: string,
): string {
  const resolved = resolveUrbanPiperWebhookSecret(secret);
  if (!resolved) {
    throw new UrbanPiperError(
      "UrbanPiper webhook secret is not configured.",
      503,
    );
  }
  return crypto
    .createHmac("sha256", resolved)
    .update(rawBody, "utf8")
    .digest("hex");
}

export interface NormalizedUrbanPiperItem {
  externalItemId: string;
  title?: string;
  quantity: number;
  unitPrice?: number;
  notes?: string;
}

export interface NormalizedUrbanPiperOrderPlacement {
  eventType: "order.placed";
  externalOrderId: string;
  externalStoreId: string;
  channel: OrderChannel;
  source: OrderSource;
  customerName: string;
  packagingFee: number;
  placeOfSupplyStateCode?: string;
  notes?: string;
  items: NormalizedUrbanPiperItem[];
}

export interface NormalizedUrbanPiperOrderCancellation {
  eventType: "order.cancelled";
  externalOrderId: string;
  reason: string;
  cancelledBy: string;
}

export type NormalizedUrbanPiperEvent =
  | NormalizedUrbanPiperOrderPlacement
  | NormalizedUrbanPiperOrderCancellation;

function mapAggregatorChannel(raw: unknown): {
  channel: OrderChannel;
  source: OrderSource;
} {
  const normalized = String(raw || "").trim().toLowerCase();
  if (normalized.includes("swiggy")) {
    return { channel: "Swiggy", source: "SWIGGY" };
  }
  if (normalized.includes("zomato")) {
    return { channel: "Zomato", source: "ZOMATO" };
  }
  if (normalized.includes("uber")) {
    return { channel: "UberEats", source: "UBEREATS" };
  }
  if (normalized.includes("door")) {
    return { channel: "DoorDash", source: "DOORDASH" };
  }
  return { channel: "Swiggy", source: "SWIGGY" };
}

/**
 * Normalizes both UrbanPiper canonical nested payloads (`order.details` / `order.items`)
 * and concise webhook envelopes (`event_type: "order.placed" | "order.cancelled"`).
 */
export function normalizeUrbanPiperPayload(
  rawJson: unknown,
): NormalizedUrbanPiperEvent {
  if (!rawJson || typeof rawJson !== "object") {
    throw new UrbanPiperError("UrbanPiper payload must be a JSON object", 400);
  }
  const root = rawJson as Record<string, unknown>;
  const rawEventType = String(
    root.event_type ?? root.event ?? "",
  )
    .trim()
    .toLowerCase();

  const orderNode = (
    root.order && typeof root.order === "object" ? root.order : root
  ) as Record<string, unknown>;
  const detailsNode = (
    orderNode.details && typeof orderNode.details === "object"
      ? orderNode.details
      : orderNode
  ) as Record<string, unknown>;
  const storeNode = (
    orderNode.store && typeof orderNode.store === "object"
      ? orderNode.store
      : root.store && typeof root.store === "object"
        ? root.store
        : {}
  ) as Record<string, unknown>;
  const customerNode = (
    root.customer && typeof root.customer === "object"
      ? root.customer
      : orderNode.customer && typeof orderNode.customer === "object"
        ? orderNode.customer
        : {}
  ) as Record<string, unknown>;

  if (
    rawEventType === "order.cancelled" ||
    rawEventType === "order_cancelled" ||
    String(detailsNode.order_state ?? "").toLowerCase() === "cancelled"
  ) {
    const externalOrderId = String(
      root.external_order_id ??
        root.externalOrderId ??
        detailsNode.ext_platforms_id ??
        detailsNode.external_order_id ??
        detailsNode.id ??
        orderNode.id ??
        "",
    ).trim();
    if (!externalOrderId) {
      throw new UrbanPiperError(
        "Missing externalOrderId in UrbanPiper cancellation payload",
        400,
      );
    }
    const reason = String(
      root.reason ??
        detailsNode.cancellation_reason ??
        detailsNode.reason ??
        "Cancelled by aggregator via UrbanPiper webhook",
    ).trim();
    const cancelledBy = String(
      root.cancelled_by ??
        root.cancelledBy ??
        detailsNode.cancelled_by ??
        "URBANPIPER_WEBHOOK",
    ).trim();

    return {
      eventType: "order.cancelled",
      externalOrderId,
      reason,
      cancelledBy,
    };
  }

  const externalOrderId = String(
    root.external_order_id ??
      root.externalOrderId ??
      detailsNode.ext_platforms_id ??
      detailsNode.external_order_id ??
      detailsNode.id ??
      orderNode.id ??
      "",
  ).trim();
  const externalStoreId = String(
    root.external_store_id ??
      root.externalStoreId ??
      storeNode.merchant_ref_id ??
      storeNode.id ??
      detailsNode.store_id ??
      detailsNode.external_store_id ??
      "",
  ).trim();

  if (!externalOrderId || !externalStoreId) {
    throw new UrbanPiperError(
      "Missing externalOrderId or externalStoreId in UrbanPiper order payload",
      400,
    );
  }

  const rawChannel =
    detailsNode.channel ??
    root.channel ??
    (Array.isArray(detailsNode.ext_platforms) &&
    detailsNode.ext_platforms[0] &&
    typeof detailsNode.ext_platforms[0] === "object"
      ? (detailsNode.ext_platforms[0] as Record<string, unknown>).name
      : "");
  const { channel, source } = mapAggregatorChannel(rawChannel);

  const rawItems = Array.isArray(orderNode.items)
    ? orderNode.items
    : Array.isArray(root.items)
      ? root.items
      : [];

  if (rawItems.length === 0) {
    throw new UrbanPiperError(
      "UrbanPiper order payload must contain at least one item",
      400,
    );
  }

  const items: NormalizedUrbanPiperItem[] = rawItems.map((entry) => {
    const item = (entry && typeof entry === "object" ? entry : {}) as Record<
      string,
      unknown
    >;
    const externalItemId = String(
      item.merchant_id ??
        item.external_item_id ??
        item.externalItemId ??
        item.sku ??
        item.id ??
        "",
    ).trim();
    if (!externalItemId) {
      throw new UrbanPiperError(
        "Each UrbanPiper line item must include externalItemId / merchant_id",
        400,
      );
    }
    const quantity = Math.max(1, Math.floor(Number(item.quantity ?? 1) || 1));
    const parsedPrice = Number(item.price ?? item.unit_price ?? item.unitPrice);
    return {
      externalItemId,
      title: typeof item.title === "string" ? item.title : typeof item.name === "string" ? item.name : undefined,
      quantity,
      unitPrice: Number.isFinite(parsedPrice) ? parsedPrice : undefined,
      notes:
        typeof item.instructions === "string"
          ? item.instructions
          : typeof item.notes === "string"
            ? item.notes
            : undefined,
    };
  });

  const packagingFeeRaw = Number(
    detailsNode.packaging_charge ??
      detailsNode.packagingFee ??
      root.packaging_fee ??
      root.packagingFee ??
      0,
  );
  const packagingFee =
    Number.isFinite(packagingFeeRaw) && packagingFeeRaw >= 0
      ? Math.round(packagingFeeRaw * 100) / 100
      : 0;

  const customerName = String(
    customerNode.name ??
      detailsNode.customer_name ??
      root.customer_name ??
      root.customerName ??
      `${channel} Guest`,
  ).trim();

  const placeOfSupplyStateCode =
    typeof detailsNode.place_of_supply_state_code === "string"
      ? detailsNode.place_of_supply_state_code
      : typeof root.placeOfSupplyStateCode === "string"
        ? root.placeOfSupplyStateCode
        : undefined;

  const notes =
    typeof detailsNode.instructions === "string"
      ? detailsNode.instructions
      : typeof root.notes === "string"
        ? root.notes
        : undefined;

  return {
    eventType: "order.placed",
    externalOrderId,
    externalStoreId,
    channel,
    source,
    customerName,
    packagingFee,
    placeOfSupplyStateCode,
    notes,
    items,
  };
}

function mapDarKitStatusToUrbanPiper(status: string): string {
  const normalized = status.trim().toUpperCase();
  if (normalized === "ORDER_ACCEPTED" || normalized === "PREPARING") {
    return "Acknowledged";
  }
  if (normalized === "FOOD_READY" || normalized === "READY_FOR_PICKUP") {
    return "Food Ready";
  }
  if (normalized === "ORDER_DISPATCHED" || normalized === "DISPATCHED") {
    return "Dispatched";
  }
  if (normalized === "CANCELLED") {
    return "Cancelled";
  }
  return "Acknowledged";
}

export interface UrbanPiperDeliveryAck {
  ok: true;
  sandbox: boolean;
  externalRef: string;
  urbanPiperStatus?: string;
}

export async function pushUrbanPiperOrderStatus(params: {
  externalOrderId: string;
  newStatus: string;
  details?: string;
}): Promise<UrbanPiperDeliveryAck> {
  const upStatus = mapDarKitStatusToUrbanPiper(params.newStatus);

  if (isUrbanPiperLiveConfigured()) {
    const baseUrl = (
      process.env.URBANPIPER_BASE_URL?.trim() || "https://api.urbanpiper.com"
    ).replace(/\/+$/, "");
    const username = process.env.URBANPIPER_USERNAME?.trim() || "darkitos";
    const apiKey = process.env.URBANPIPER_API_KEY!.trim();

    const res = await fetch(
      `${baseUrl}/external/api/v1/orders/${encodeURIComponent(params.externalOrderId)}/status/`,
      {
        method: "PUT",
        headers: {
          Authorization: `apikey ${username}:${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          new_status: upStatus,
          message: params.details || `Status updated to ${upStatus} by DarKitOS`,
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new UrbanPiperError(
        `UrbanPiper status push failed (${res.status}): ${errText.slice(0, 200)}`,
        res.status,
      );
    }

    const body = (await res.json().catch(() => ({}))) as {
      reference?: string;
      status?: string;
    };

    return {
      ok: true,
      sandbox: false,
      externalRef:
        body.reference || `up_live_${params.externalOrderId}_${upStatus}`,
      urbanPiperStatus: upStatus,
    };
  }

  const hash = crypto
    .createHash("sha256")
    .update(`status:${params.externalOrderId}:${upStatus}`)
    .digest("hex")
    .slice(0, 12);

  return {
    ok: true,
    sandbox: true,
    externalRef: `up_sbx_status_${hash}`,
    urbanPiperStatus: upStatus,
  };
}

export async function submitUrbanPiperDisputeClaim(params: {
  externalOrderId: string;
  claimAmount: number;
  reason: string;
  evidence?: Record<string, unknown>;
}): Promise<UrbanPiperDeliveryAck> {
  if (isUrbanPiperLiveConfigured()) {
    const baseUrl = (
      process.env.URBANPIPER_BASE_URL?.trim() || "https://api.urbanpiper.com"
    ).replace(/\/+$/, "");
    const username = process.env.URBANPIPER_USERNAME?.trim() || "darkitos";
    const apiKey = process.env.URBANPIPER_API_KEY!.trim();

    const res = await fetch(
      `${baseUrl}/external/api/v1/orders/${encodeURIComponent(params.externalOrderId)}/disputes/`,
      {
        method: "POST",
        headers: {
          Authorization: `apikey ${username}:${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          claim_amount_inr: params.claimAmount,
          reason: params.reason,
          evidence: params.evidence ?? {},
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new UrbanPiperError(
        `UrbanPiper dispute claim failed (${res.status}): ${errText.slice(0, 200)}`,
        res.status,
      );
    }

    const body = (await res.json().catch(() => ({}))) as {
      claim_id?: string;
      reference?: string;
    };

    return {
      ok: true,
      sandbox: false,
      externalRef:
        body.claim_id || body.reference || `up_live_claim_${params.externalOrderId}`,
    };
  }

  const hash = crypto
    .createHash("sha256")
    .update(`claim:${params.externalOrderId}:${params.claimAmount}`)
    .digest("hex")
    .slice(0, 12);

  return {
    ok: true,
    sandbox: true,
    externalRef: `up_sbx_claim_${hash}`,
  };
}
