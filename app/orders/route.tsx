import { NextResponse } from "next/server";

import type {
  Order,
  OrderSource,
  OrderChannel,
  DbaBrand,
} from "@/lib/db";

import {
  addOrder,
  getInventory,
  getOrders,
} from "@/lib/store";

export const dynamic = "force-dynamic";

function isValidBrand(
  value: unknown,
): value is DbaBrand {
  return [
    "BurgerForge",
    "TacoMatrix",
    "WingProtocol",
    "GreenBowl",
  ].includes(value as DbaBrand);
}

function isValidChannel(
  value: unknown,
): value is OrderChannel {
  return [
    "Swiggy",
    "Zomato",
    "DoorDash",
    "UberEats",
    "GrubHub",
    "Direct Web",
  ].includes(value as OrderChannel);
}

function isValidSource(
  value: unknown,
): value is OrderSource {
  return [
    "MANUAL",
    "SWIGGY",
    "ZOMATO",
    "DOORDASH",
    "UBEREATS",
    "GRUBHUB",
    "DIRECT_WEB",
  ].includes(value as OrderSource);
}

export async function GET() {
  return NextResponse.json({
    success: true,
    orders: getOrders(),
    inventory: getInventory(),
  });
}

/*
 * Compatibility POST endpoint.
 *
 * The canonical order-processing engine lives at:
 *
 * /api/orders
 *
 * This route intentionally does NOT maintain its
 * own global order or inventory arrays.
 */
export async function POST(
  request: Request,
) {
  try {
    const body =
      await request.json();

    const brandId =
      body.brandId ??
      "BurgerForge";

    const channel =
      body.channel ??
      "Direct Web";

    const source =
      body.source ??
      "MANUAL";

    if (!isValidBrand(brandId)) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Invalid brand: ${String(
              brandId,
            )}`,
        },
        { status: 400 },
      );
    }

    if (!isValidChannel(channel)) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Invalid channel: ${String(
              channel,
            )}`,
        },
        { status: 400 },
      );
    }

    if (!isValidSource(source)) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Invalid source: ${String(
              source,
            )}`,
        },
        { status: 400 },
      );
    }

    if (
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Order must contain at least one item.",
        },
        { status: 400 },
      );
    }

    /*
     * This compatibility route now creates the
     * canonical Order shape.
     *
     * Inventory depletion is deliberately NOT
     * performed here.
     *
     * That responsibility belongs to
     * /api/orders, preventing duplicate
     * inventory mutations.
     */
    const now =
      new Date().toISOString();

    const newOrder: Order = {
      id:
        body.id
          ? String(body.id)
          : `ORD-${Date.now()}`,

      externalOrderId:
        body.externalOrderId,

      brandId,

      kitchenId:
        body.kitchenId ||
        "K1",

      channel,

      source,

      status: "PENDING",

      items: body.items,

      customerName:
        body.customerName,

      driverName:
        body.driverName,

      courierEtaMins:
        body.courierEtaMins,

      createdAt: now,

      updatedAt: now,

      receivedAt: now,

      inventoryWarnings: [],

      inventoryUnavailable: [],

      events: [],
    };

    /*
     * IMPORTANT:
     *
     * Do not process inventory here.
     *
     * The compatibility endpoint cannot safely
     * duplicate the canonical transaction logic.
     *
     * Callers that require full order processing
     * should use /api/orders.
     */
    addOrder(newOrder);

    return NextResponse.json(
      {
        success: true,
        order: newOrder,
        orders: getOrders(),
        inventory:
          getInventory(),
        canonicalEndpoint:
          "/api/orders",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "POST /orders failed:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to process order";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
