import { NextResponse } from "next/server";
import type {
  Order,
  OrderEvent,
  OrderEventType,
  OrderStatus,
} from "@/lib/db";
import {
  evaluateOrderInventory,
  processOrderDepletion,
} from "@/lib/db";
import {
  addOrder,
  findOrder,
  getInventory,
  getOrders,
  replaceInventory,
  updateOrder,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: [],
  CANCELLED: [],
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(
    Math.random() * 10000,
  )}`;
}

function createEvent(
  orderId: string,
  type: OrderEventType,
  source: Order["source"],
  actor = "SYSTEM",
  metadata?: Record<string, unknown>,
): OrderEvent {
  return {
    id: createId("evt"),
    orderId,
    type,
    timestamp: new Date().toISOString(),
    source,
    actor,
    metadata,
  };
}

function appendOrderEvent(
  order: Order,
  event: OrderEvent,
): void {
  order.events = [...(order.events ?? []), event];
}

export async function GET() {
  return NextResponse.json({
    success: true,
    orders: getOrders(),
    inventory: getInventory(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid order payload",
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "An order must contain at least one item",
        },
        { status: 400 },
      );
    }

    const brandId = String(body.brandId || "BurgerForge");
    const kitchenId = String(body.kitchenId || "K1");
    const channel = String(body.channel || "Direct Web");
    const source = body.source || "MANUAL";

    const now = new Date().toISOString();
    const orderId = body.id
      ? String(body.id)
      : createId("ORD");

    const receivedAt = body.receivedAt
      ? String(body.receivedAt)
      : now;

    const newOrder: Order = {
      id: orderId,
      externalOrderId: body.externalOrderId
        ? String(body.externalOrderId)
        : undefined,

      brandId,
      kitchenId,

      channel,
      source,

      status: "PENDING",

      items: body.items,

      customerName:
        body.customerName !== undefined
          ? String(body.customerName)
          : undefined,

      driverName:
        body.driverName !== undefined
          ? String(body.driverName)
          : undefined,

      courierEtaMins:
        body.courierEtaMins !== undefined
          ? Number(body.courierEtaMins)
          : undefined,

      createdAt: now,
      updatedAt: now,

      receivedAt,

      acceptedAt: undefined,
      prepStartedAt: undefined,
      prepCompletedAt: undefined,
      readyAt: undefined,
      driverAssignedAt: undefined,
      pickedUpAt: undefined,
      dispatchedAt: undefined,

      cancellationSource: undefined,
      cancellationReason: undefined,
      cancelledBy: undefined,

      inventoryDecision: undefined,
      inventoryWarnings: [],
      inventoryUnavailable: [],

      events: [],
    };

    /*
     * STEP 1
     * Evaluate inventory before modifying stock.
     *
     * This distinguishes:
     * AVAILABLE
     * LOW_STOCK
     * INSUFFICIENT_STOCK
     */
    const inventoryEvaluation = evaluateOrderInventory(
      newOrder,
      getInventory(),
    );

    newOrder.inventoryDecision =
      inventoryEvaluation.inventoryDecision;

    newOrder.inventoryWarnings =
      inventoryEvaluation.lowStockItems;

    newOrder.inventoryUnavailable =
      inventoryEvaluation.insufficientStockItems;

    /*
     * STEP 2
     * Record that the system received the order.
     */
    appendOrderEvent(
      newOrder,
      createEvent(
        orderId,
        "RECEIVED",
        source,
        "SYSTEM",
        {
          channel,
          kitchenId,
          brandId,
          externalOrderId:
            newOrder.externalOrderId,
        },
      ),
    );

    /*
     * STEP 3
     * Record inventory evaluation.
     */
    appendOrderEvent(
      newOrder,
      createEvent(
        orderId,
        "INVENTORY_CHECKED",
        "MANUAL",
        "SYSTEM",
        {
          decision:
            inventoryEvaluation.inventoryDecision,
          lowStockItems:
            inventoryEvaluation.lowStockItems,
          insufficientStockItems:
            inventoryEvaluation.insufficientStockItems,
        },
      ),
    );

    /*
     * INSUFFICIENT_STOCK means the order cannot currently
     * be fulfilled. Do not deplete inventory and do not
     * pretend the order was successfully accepted.
     */
    if (
      inventoryEvaluation.inventoryDecision ===
      "INSUFFICIENT_STOCK"
    ) {
      appendOrderEvent(
        newOrder,
        createEvent(
          orderId,
          "INVENTORY_UNAVAILABLE",
          source,
          "SYSTEM",
          {
            items:
              inventoryEvaluation.insufficientStockItems,
          },
        ),
      );

      newOrder.updatedAt = new Date().toISOString();

      return NextResponse.json(
        {
          success: false,
          error:
            "Order cannot be fulfilled because required inventory is insufficient",
          order: newOrder,
          inventoryDecision:
            inventoryEvaluation.inventoryDecision,
          inventoryWarnings:
            inventoryEvaluation.lowStockItems,
          inventoryUnavailable:
            inventoryEvaluation.insufficientStockItems,
          currentInventory: getInventory(),
        },
        { status: 409 },
      );
    }

    /*
     * LOW_STOCK is a warning, not a rejection.
     */
    if (
      inventoryEvaluation.inventoryDecision ===
      "LOW_STOCK"
    ) {
      appendOrderEvent(
        newOrder,
        createEvent(
          orderId,
          "INVENTORY_WARNING",
          source,
          "SYSTEM",
          {
            items:
              inventoryEvaluation.lowStockItems,
          },
        ),
      );
    }

    /*
     * STEP 4
     * Deplete inventory only after the order has passed
     * the sufficiency check.
     */
    const depletion = processOrderDepletion(
      newOrder,
      getInventory(),
    );

    replaceInventory(depletion.updatedInventory);

    /*
     * STEP 5
     * The order is accepted into the internal OS.
     */
    newOrder.acceptedAt = new Date().toISOString();

    appendOrderEvent(
      newOrder,
      createEvent(
        orderId,
        "ACCEPTED",
        source,
        "SYSTEM",
        {
          inventoryDecision:
            inventoryEvaluation.inventoryDecision,
        },
      ),
    );

    newOrder.updatedAt = new Date().toISOString();

    addOrder(newOrder);

    return NextResponse.json({
      success: true,
      order: newOrder,
      inventoryDecision:
        inventoryEvaluation.inventoryDecision,
      depletedItems: depletion.depletedItems,
      lowStockAlerts: depletion.lowStockAlerts,
      inventoryWarnings:
        inventoryEvaluation.lowStockItems,
      inventoryUnavailable:
        inventoryEvaluation.insufficientStockItems,
      currentInventory: getInventory(),
    });
  } catch (error) {
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

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const orderId = String(body.orderId || "");
    const requestedStatus =
      body.status as OrderStatus | undefined;

    if (!orderId || !requestedStatus) {
      return NextResponse.json(
        {
          success: false,
          error:
            "orderId and status are required",
        },
        { status: 400 },
      );
    }

    const order = findOrder(orderId);

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: "Order not found",
        },
        { status: 404 },
      );
    }

    const allowedTransitions =
      VALID_TRANSITIONS[order.status];

    if (!allowedTransitions.includes(requestedStatus)) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Invalid order transition: ` +
            `${order.status} → ${requestedStatus}`,
        },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();

    const updates: Partial<Order> = {
      status: requestedStatus,
      updatedAt: now,
    };

    let eventType: OrderEventType;
    let eventActor = "SYSTEM";

    switch (requestedStatus) {
      case "PREPARING":
        updates.prepStartedAt =
          order.prepStartedAt || now;
        eventType = "PREPARING";
        eventActor = body.actor
          ? String(body.actor)
          : "COOK";
        break;

      case "READY_FOR_PICKUP":
        updates.prepCompletedAt = now;
        updates.readyAt = now;
        eventType = "READY_FOR_PICKUP";
        eventActor = body.actor
          ? String(body.actor)
          : "COOK";
        break;

      case "DISPATCHED":
        updates.dispatchedAt = now;

        if (body.driverName !== undefined) {
          updates.driverName = String(
            body.driverName,
          );
        }

        eventType = "DISPATCHED";
        eventActor = body.actor
          ? String(body.actor)
          : "DISPATCH";
        break;

      case "CANCELLED":
        updates.cancellationSource =
          body.cancellationSource
            ? String(body.cancellationSource)
            : "MANUAL";

        updates.cancellationReason =
          body.cancellationReason
            ? String(body.cancellationReason)
            : "Order cancelled";

        updates.cancelledBy =
          body.cancelledBy
            ? String(body.cancelledBy)
            : "SYSTEM";

        eventType = "CANCELLED";
        eventActor =
          String(updates.cancelledBy);
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Unsupported order transition",
          },
          { status: 400 },
        );
    }

    const updatedOrder = updateOrder(
      orderId,
      updates,
    );

    if (!updatedOrder) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update order",
        },
        { status: 500 },
      );
    }

    appendOrderEvent(
      updatedOrder,
      createEvent(
        orderId,
        eventType,
        updatedOrder.source,
        eventActor,
        {
          previousStatus: order.status,
          newStatus: requestedStatus,
        },
      ),
    );

    updatedOrder.updatedAt = now;

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      orders: getOrders(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update order";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
