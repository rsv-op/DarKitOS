import { NextRequest, NextResponse } from "next/server";
import type { AggregatorChannel, DbaBrand } from "@/lib/db";
import {
  cancelCanonicalOrder,
  findOrderByExternalId,
  getAggregatorSkuMappings,
  injectCanonicalOrder,
  logOperationalActivity,
} from "@/lib/store";
import {
  UrbanPiperError,
  normalizeUrbanPiperPayload,
  verifyUrbanPiperSignature,
} from "@/lib/urbanpiper";

export const dynamic = "force-dynamic";

function mapSourceToAggregatorChannel(source: string): AggregatorChannel {
  if (source === "SWIGGY") return "SWIGGY";
  if (source === "ZOMATO") return "ZOMATO";
  return "ALL";
}

export async function POST(request: NextRequest) {
  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "Unable to read request body" },
      { status: 400 },
    );
  }

  const signature =
    request.headers.get("x-urbanpiper-signature") ??
    request.headers.get("X-UrbanPiper-Signature");

  if (!verifyUrbanPiperSignature({ rawBody, signature })) {
    return NextResponse.json(
      { error: "Invalid or missing X-UrbanPiper-Signature" },
      { status: 401 },
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  let normalized;
  try {
    normalized = normalizeUrbanPiperPayload(parsedBody);
  } catch (err) {
    const status = err instanceof UrbanPiperError ? err.statusCode : 400;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Malformed payload" },
      { status },
    );
  }

  try {
    if (normalized.eventType === "order.cancelled") {
      const existingOrder = await findOrderByExternalId(
        normalized.externalOrderId,
      );
      if (!existingOrder) {
        return NextResponse.json(
          {
            error: `Order not found for externalOrderId ${normalized.externalOrderId}`,
            externalOrderId: normalized.externalOrderId,
          },
          { status: 404 },
        );
      }

      const cancelResult = await cancelCanonicalOrder({
        orderId: existingOrder.id,
        actor: normalized.cancelledBy || "URBANPIPER_WEBHOOK",
        cancellationReason: normalized.reason,
        cancellationSource: "AGGREGATOR_WEBHOOK",
      });

      return NextResponse.json(
        {
          ok: true,
          eventType: "order.cancelled",
          duplicate: cancelResult.idempotentReplay,
          order: cancelResult.order,
          cancellation: cancelResult.cancellationRecord,
          creditNoteInvoice: cancelResult.creditNoteInvoice,
        },
        { status: 200 },
      );
    }

    // order.placed -> resolve active SKU mappings
    const storeMappings = await getAggregatorSkuMappings({
      externalStoreId: normalized.externalStoreId,
      activeOnly: true,
    });
    const desiredChannel = mapSourceToAggregatorChannel(normalized.source);

    const resolvedItems: Array<{
      menuItemId: string;
      quantity: number;
      notes?: string;
      kitchenId: string;
      brandId: DbaBrand;
      organizationId: string;
    }> = [];
    const unmappedSkus: string[] = [];

    for (const line of normalized.items) {
      const exactMatch =
        storeMappings.find(
          (m) =>
            m.externalItemId === line.externalItemId &&
            m.channel === desiredChannel,
        ) ??
        storeMappings.find(
          (m) =>
            m.externalItemId === line.externalItemId && m.channel === "ALL",
        );

      if (!exactMatch) {
        unmappedSkus.push(line.externalItemId);
        continue;
      }

      resolvedItems.push({
        menuItemId: exactMatch.menuItemId,
        quantity: line.quantity,
        notes: line.notes,
        kitchenId: exactMatch.kitchenId,
        brandId: exactMatch.brandId,
        organizationId: exactMatch.organizationId,
      });
    }

    if (unmappedSkus.length > 0 || resolvedItems.length === 0) {
      await logOperationalActivity({
        organizationId: storeMappings[0]?.organizationId,
        type: "AGGREGATOR_UNMAPPED_SKU",
        category: "INTEGRATION",
        title: `Unmapped UrbanPiper SKU(s) Rejected (${normalized.externalOrderId})`,
        details: `Store ${normalized.externalStoreId} (${normalized.channel}) sent unmapped or inactive SKU(s): ${unmappedSkus.join(", ") || "NONE"}.`,
        actor: "URBANPIPER_WEBHOOK",
        kitchenId: storeMappings[0]?.kitchenId,
        severity: "warning",
      });

      return NextResponse.json(
        {
          error: "Unmapped or inactive UrbanPiper SKU(s)",
          externalOrderId: normalized.externalOrderId,
          externalStoreId: normalized.externalStoreId,
          unmappedSkus,
        },
        { status: 422 },
      );
    }

    const primary = resolvedItems[0];
    const idempotencyKey = `urbanpiper:${normalized.externalOrderId}`;

    const result = await injectCanonicalOrder({
      idempotencyKey,
      externalOrderId: normalized.externalOrderId,
      brandId: primary.brandId,
      kitchenId: primary.kitchenId,
      channel: normalized.channel,
      source: normalized.source,
      paymentStatus: "AGGREGATOR_SETTLED",
      packagingFee: normalized.packagingFee,
      placeOfSupplyStateCode: normalized.placeOfSupplyStateCode,
      customerName: normalized.customerName,
      notes: normalized.notes,
      actor: "URBANPIPER_WEBHOOK",
      items: resolvedItems.map((i) => ({
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        notes: i.notes,
      })),
    });

    return NextResponse.json(
      {
        ok: true,
        eventType: "order.placed",
        duplicate: result.idempotentReplay,
        order: result.order,
        invoice: result.invoice,
        inventoryDecision: result.inventoryDecision,
      },
      { status: result.idempotentReplay ? 200 : 201 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "UrbanPiper webhook processing failed",
      },
      { status: 400 },
    );
  }
}
