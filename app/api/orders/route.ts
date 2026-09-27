import { NextResponse } from "next/server";

import {
  type DbaBrand,
  type Order,
  type OrderChannel,
  type OrderEvent,
  type OrderEventType,
  type OrderSource,
  type OrderStatus,
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

const VALID_TRANSITIONS: Record<
  OrderStatus,
  OrderStatus[]
> = {
  PENDING: [
    "PREPARING",
    "CANCELLED",
  ],

  PREPARING: [
    "READY_FOR_PICKUP",
    "CANCELLED",
  ],

  READY_FOR_PICKUP: [
    "DRIVER_ASSIGNED",
    "CANCELLED",
  ],

  DRIVER_ASSIGNED: [
    "PICKED_UP",
    "CANCELLED",
  ],

  PICKED_UP: [
    "DISPATCHED",
    "CANCELLED",
  ],

  DISPATCHED: [],

  CANCELLED: [],
};

const ACTIONS = [
  "DRIVER_ASSIGNED",
  "PICKED_UP",
] as const;

type OrderAction =
  (typeof ACTIONS)[number];

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createEvent(
  orderId: string,
  type: OrderEventType,
  source: OrderSource,
  actor: string,
  metadata?: Record<string, unknown>,
): OrderEvent {
  return {
    id: createId("EVT"),
    orderId,
    type,
    timestamp: new Date().toISOString(),
    source,
    actor,
    metadata,
  };
}

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

function isValidStatus(
  value: unknown,
): value is OrderStatus {
  return [
    "PENDING",
    "PREPARING",
    "READY_FOR_PICKUP",
    "DRIVER_ASSIGNED",
    "PICKED_UP",
    "DISPATCHED",
    "CANCELLED",
  ].includes(value as OrderStatus);
}

export async function GET() {
  return NextResponse.json({
    orders: getOrders(),
    inventory: getInventory(),
  });
}

export async function POST(
  request: Request,
) {
  try {
    const body = await request.json();

    if (
      !body ||
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Order must contain at least one item.",
        },
        { status: 400 },
      );
    }

    const brandId =
      body.brandId ?? "BurgerForge";

    const channel =
      body.channel ?? "Direct Web";

    const source =
      body.source ?? "MANUAL";

    if (!isValidBrand(brandId)) {
      return NextResponse.json(
        {
          error: `Invalid brand: ${String(
            brandId,
          )}`,
        },
        { status: 400 },
      );
    }

    if (!isValidChannel(channel)) {
      return NextResponse.json(
        {
          error: `Invalid channel: ${String(
            channel,
          )}`,
        },
        { status: 400 },
      );
    }

    if (!isValidSource(source)) {
      return NextResponse.json(
        {
          error: `Invalid source: ${String(
            source,
          )}`,
        },
        { status: 400 },
      );
    }

    const now =
      new Date().toISOString();

    const orderId =
      body.id || createId("ORD");

    const receivedAt =
      body.receivedAt || now;

    const newOrder: Order = {
      id: orderId,

      externalOrderId:
        body.externalOrderId,

      brandId,

      kitchenId:
        body.kitchenId || "K1",

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

      createdAt:
        body.createdAt || now,

      updatedAt: now,

      receivedAt,

      inventoryDecision:
        undefined,

      inventoryWarnings: [],

      inventoryUnavailable: [],

      events: [],
    };

    const receivedEvent =
      createEvent(
        newOrder.id,
        "RECEIVED",
        source,
        body.actor || "SYSTEM",
        {
          channel,
          externalOrderId:
            body.externalOrderId,
        },
      );

    newOrder.events.push(
      receivedEvent,
    );

    const inventory =
      getInventory();

    const inventoryEvaluation =
      evaluateOrderInventory(
        newOrder,
        inventory,
      );

    newOrder.inventoryDecision =
      inventoryEvaluation.inventoryDecision;

    newOrder.inventoryWarnings =
      inventoryEvaluation.lowStockItems;

    newOrder.inventoryUnavailable =
      inventoryEvaluation.insufficientStockItems;

    newOrder.events.push(
      createEvent(
        newOrder.id,
        "INVENTORY_CHECKED",
        source,
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

    if (
      inventoryEvaluation.inventoryDecision ===
      "INSUFFICIENT_STOCK"
    ) {
      newOrder.events.push(
        createEvent(
          newOrder.id,
          "INVENTORY_UNAVAILABLE",
          source,
          "SYSTEM",
          {
            items:
              inventoryEvaluation.insufficientStockItems,
          },
        ),
      );

      return NextResponse.json(
        {
          error:
            "Order cannot be accepted because required inventory is insufficient.",
          order: newOrder,
          inventoryDecision:
            inventoryEvaluation.inventoryDecision,
          insufficientStockItems:
            inventoryEvaluation.insufficientStockItems,
        },
        { status: 409 },
      );
    }

    if (
      inventoryEvaluation.inventoryDecision ===
      "LOW_STOCK"
    ) {
      newOrder.events.push(
        createEvent(
          newOrder.id,
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

    const depletion =
      processOrderDepletion(
        newOrder,
        inventory,
      );

    replaceInventory(
      depletion.updatedInventory,
    );

    newOrder.acceptedAt = now;

    newOrder.events.push(
      createEvent(
        newOrder.id,
        "ACCEPTED",
        source,
        body.actor || "SYSTEM",
        {
          inventoryDecision:
            depletion.inventoryDecision,
        },
      ),
    );

    addOrder(newOrder);

    return NextResponse.json(
      {
        order: newOrder,
        orders: getOrders(),
        inventory:
          getInventory(),
        inventoryDecision:
          depletion.inventoryDecision,
        lowStockItems:
          depletion.lowStockAlerts,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "POST /api/orders failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to create order.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
) {
  try {
    const body = await request.json();

    const orderId =
      body?.orderId;

    if (!orderId) {
      return NextResponse.json(
        {
          error:
            "orderId is required.",
        },
        { status: 400 },
      );
    }

    const order =
      findOrder(orderId);

    if (!order) {
      return NextResponse.json(
        {
          error:
            "Order not found.",
        },
        { status: 404 },
      );
    }

    const actor =
      body.actor ||
      "SYSTEM";

    const source: OrderSource =
      body.source &&
      isValidSource(body.source)
        ? body.source
        : order.source;

    /*
     * ACTION: DRIVER_ASSIGNED
     *
     * The order remains operationally
     * associated with the READY_FOR_PICKUP
     * stage until the driver actually picks it up.
     */
    if (
      body.action ===
      "DRIVER_ASSIGNED"
    ) {
      if (
        order.status !==
        "READY_FOR_PICKUP"
      ) {
        return NextResponse.json(
          {
            error:
              "A driver can only be assigned after the order is ready for pickup.",
          },
          { status: 409 },
        );
      }

      if (order.driverAssignedAt) {
        return NextResponse.json(
          {
            error:
              "A driver is already assigned to this order.",
          },
          { status: 409 },
        );
      }

      const driverName =
        String(
          body.driverName ||
            "",
        ).trim();

      if (!driverName) {
        return NextResponse.json(
          {
            error:
              "driverName is required when assigning a driver.",
          },
          { status: 400 },
        );
      }

      const timestamp =
        new Date().toISOString();

      const updatedOrder =
        updateOrder(
          orderId,
          {
            status:
              "DRIVER_ASSIGNED",

            driverName,

            driverAssignedAt:
              timestamp,

            events: [
              ...order.events,

              createEvent(
                order.id,
                "DRIVER_ASSIGNED",
                source,
                actor,
                {
                  driverName,
                },
              ),
            ],
          },
        );

      return NextResponse.json({
        order: updatedOrder,
        orders: getOrders(),
      });
    }

    /*
     * ACTION: PICKED_UP
     */
    if (
      body.action ===
      "PICKED_UP"
    ) {
      if (
        order.status !==
        "DRIVER_ASSIGNED"
      ) {
        return NextResponse.json(
          {
            error:
              "An order can only be picked up after a driver has been assigned.",
          },
          { status: 409 },
        );
      }

      if (!order.driverAssignedAt) {
        return NextResponse.json(
          {
            error:
              "Driver assignment timestamp is missing.",
          },
          { status: 409 },
        );
      }

      if (order.pickedUpAt) {
        return NextResponse.json(
          {
            error:
              "This order has already been picked up.",
          },
          { status: 409 },
        );
      }

      const timestamp =
        new Date().toISOString();

      const updatedOrder =
        updateOrder(
          orderId,
          {
            status:
              "PICKED_UP",

            pickedUpAt:
              timestamp,

            events: [
              ...order.events,

              createEvent(
                order.id,
                "PICKED_UP",
                source,
                actor,
              ),
            ],
          },
        );

      return NextResponse.json({
        order: updatedOrder,
        orders: getOrders(),
      });
    }

    /*
     * STATUS CHANGE
     */
    const requestedStatus =
      body.status;

    if (
      !isValidStatus(
        requestedStatus,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid status or supported action is required.",
        },
        { status: 400 },
      );
    }

    const allowedTransitions =
      VALID_TRANSITIONS[
        order.status
      ];

    if (
      !allowedTransitions.includes(
        requestedStatus,
      )
    ) {
      return NextResponse.json(
        {
          error:
            `Invalid order transition: ${order.status} → ${requestedStatus}`,
        },
        { status: 409 },
      );
    }

    const timestamp =
      new Date().toISOString();

    const updates: Partial<Order> =
      {
        status:
          requestedStatus,
      };

    let eventType:
      OrderEventType =
      requestedStatus;

    if (
      requestedStatus ===
      "PREPARING"
    ) {
      updates.prepStartedAt =
        timestamp;

      eventType =
        "PREPARING";
    }

    if (
      requestedStatus ===
      "READY_FOR_PICKUP"
    ) {
      updates.prepCompletedAt =
        timestamp;

      updates.readyAt =
        timestamp;

      eventType =
        "READY_FOR_PICKUP";
    }

    if (
      requestedStatus ===
      "DISPATCHED"
    ) {
      updates.dispatchedAt =
        timestamp;

      eventType =
        "DISPATCHED";

      if (
        body.driverName
      ) {
        updates.driverName =
          String(
            body.driverName,
          ).trim();
      }
    }

    if (
      requestedStatus ===
      "CANCELLED"
    ) {
      const cancellationSource =
        body.cancellationSource;

      const validCancellationSources =
        [
          "CUSTOMER",
          "KITCHEN",
          "AGGREGATOR",
          "SYSTEM",
          "MANUAL",
        ];

      updates.cancellationSource =
        validCancellationSources.includes(
          cancellationSource,
        )
          ? cancellationSource
          : "MANUAL";

      updates.cancellationReason =
        String(
          body.cancellationReason ||
            "No reason provided",
        ).trim();

      updates.cancelledBy =
        String(
          body.cancelledBy ||
            actor,
        ).trim();

      eventType =
        "CANCELLED";
    }

    updates.events = [
      ...order.events,

      createEvent(
        order.id,
        eventType,
        source,
        actor,
        requestedStatus ===
          "CANCELLED"
          ? {
              cancellationSource:
                updates.cancellationSource,

              cancellationReason:
                updates.cancellationReason,

              cancelledBy:
                updates.cancelledBy,
            }
          : undefined,
      ),
    ];

    const updatedOrder =
      updateOrder(
        orderId,
        updates,
      );

    return NextResponse.json({
      order: updatedOrder,
      orders: getOrders(),
    });
  } catch (error) {
    console.error(
      "PATCH /api/orders failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to update order.",
      },
      { status: 500 },
    );
  }
}
