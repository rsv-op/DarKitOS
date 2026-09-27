import { NextResponse } from "next/server";

import {
  BRANDS_DB,
  KITCHENS_DB,
  MENU_CATALOG,
  evaluateOrderInventory,
  processOrderDepletion,
} from "@/lib/db";

import type {
  DbaBrand,
  Order,
  OrderChannel,
  OrderEvent,
  OrderEventType,
  OrderSource,
  OrderStatus,
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

const VALID_STATUSES: OrderStatus[] = [
  "PENDING",
  "PREPARING",
  "READY_FOR_PICKUP",
  "DRIVER_ASSIGNED",
  "PICKED_UP",
  "DISPATCHED",
  "CANCELLED",
];

const VALID_CHANNELS: OrderChannel[] = [
  "Swiggy",
  "Zomato",
  "DoorDash",
  "UberEats",
  "GrubHub",
  "Direct Web",
];

const VALID_SOURCES: OrderSource[] = [
  "MANUAL",
  "SWIGGY",
  "ZOMATO",
  "DOORDASH",
  "UBEREATS",
  "GRUBHUB",
  "DIRECT_WEB",
];

const VALID_BRANDS: DbaBrand[] = BRANDS_DB.map(
  (brand) => brand.id
) as DbaBrand[];

const VALID_KITCHENS = KITCHENS_DB.map((kitchen) => kitchen.id);

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["DRIVER_ASSIGNED", "CANCELLED"],
  DRIVER_ASSIGNED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: [],
  CANCELLED: [],
};

const ACTIONS = ["DRIVER_ASSIGNED", "PICKED_UP"] as const;

type OrderAction = (typeof ACTIONS)[number];

type OrderItemInput = {
  id?: unknown;
  menuItemId?: unknown;
  name?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  station?: unknown;
  notes?: unknown;
};

type CreateOrderBody = {
  id?: unknown;
  externalOrderId?: unknown;
  brandId?: unknown;
  kitchenId?: unknown;
  channel?: unknown;
  source?: unknown;
  items?: unknown;
  customerName?: unknown;
  driverName?: unknown;
  courierEtaMins?: unknown;
};

type UpdateOrderBody = {
  status?: unknown;
  action?: unknown;
  driverName?: unknown;
  cancellationSource?: unknown;
  cancellationReason?: unknown;
  cancelledBy?: unknown;
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;
}

function createEvent(
  type: OrderEventType,
  actor: string,
  details?: string
): OrderEvent {
  return {
    id: createId("EVT"),
    type,
    timestamp: new Date().toISOString(),
    actor,
    details,
  };
}

function isValidBrand(value: unknown): value is DbaBrand {
  return (
    typeof value === "string" &&
    VALID_BRANDS.includes(value as DbaBrand)
  );
}

function isValidKitchen(value: unknown): value is string {
  return (
    typeof value === "string" &&
    VALID_KITCHENS.includes(value)
  );
}

function isValidChannel(value: unknown): value is OrderChannel {
  return (
    typeof value === "string" &&
    VALID_CHANNELS.includes(value as OrderChannel)
  );
}

function isValidSource(value: unknown): value is OrderSource {
  return (
    typeof value === "string" &&
    VALID_SOURCES.includes(value as OrderSource)
  );
}

function isValidStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    VALID_STATUSES.includes(value as OrderStatus)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  );
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  );
}

function validateOrderItems(items: unknown): {
  valid: boolean;
  error?: string;
  normalizedItems?: Order["items"];
} {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      valid: false,
      error: "Order must contain at least one item",
    };
  }

  const normalizedItems: Order["items"] = [];

  for (let index = 0; index < items.length; index += 1) {
    const raw = items[index] as OrderItemInput;

    if (!raw || typeof raw !== "object") {
      return {
        valid: false,
        error: `Invalid order item at index ${index}`,
      };
    }

    if (!isNonEmptyString(raw.menuItemId)) {
      return {
        valid: false,
        error: `Missing menuItemId at item ${index}`,
      };
    }

    const menuItem = MENU_CATALOG.find(
      (item) => item.id === raw.menuItemId
    );

    if (!menuItem) {
      return {
        valid: false,
        error: `Unknown menu item: ${raw.menuItemId}`,
      };
    }

    if (!isPositiveInteger(raw.quantity)) {
      return {
        valid: false,
        error: `Invalid quantity for ${menuItem.name}. Quantity must be a positive integer.`,
      };
    }

    if (raw.unitPrice !== undefined) {
      if (!isFiniteNonNegativeNumber(raw.unitPrice)) {
        return {
          valid: false,
          error: `Invalid unit price for ${menuItem.name}`,
        };
      }
    }

    if (
      raw.name !== undefined &&
      !isNonEmptyString(raw.name)
    ) {
      return {
        valid: false,
        error: `Invalid item name for ${menuItem.name}`,
      };
    }

    if (
      raw.notes !== undefined &&
      typeof raw.notes !== "string"
    ) {
      return {
        valid: false,
        error: `Invalid notes for ${menuItem.name}`,
      };
    }

    normalizedItems.push({
  id: isNonEmptyString(raw.id)
    ? raw.id
    : createId("ITEM"),
  menuItemId: menuItem.id,
  name: menuItem.name,
  quantity: raw.quantity,
  station: menuItem.station,
  notes:
    typeof raw.notes === "string"
      ? raw.notes.trim()
      : undefined,
});
  
  return {
    valid: true,
    normalizedItems,
  };
}

function jsonError(
  message: string,
  status = 400,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details || {}),
    },
    { status }
  );
}

function getStatusTimestamp(
  status: OrderStatus
): keyof Pick<
  Order,
  | "acceptedAt"
  | "prepStartedAt"
  | "prepCompletedAt"
  | "readyAt"
  | "dispatchedAt"
> | null {
  switch (status) {
    case "PREPARING":
      return "prepStartedAt";

    case "READY_FOR_PICKUP":
      return "readyAt";

    case "DISPATCHED":
      return "dispatchedAt";

    default:
      return null;
  }
}

function getStatusEvent(
  status: OrderStatus
): OrderEventType | null {
  switch (status) {
    case "PREPARING":
      return "PREPARING";

    case "READY_FOR_PICKUP":
      return "READY_FOR_PICKUP";

    case "DISPATCHED":
      return "DISPATCHED";

    default:
      return null;
  }
}

function getActor(
  body: UpdateOrderBody,
  fallback: string
): string {
  return isNonEmptyString(body.cancelledBy)
    ? body.cancelledBy.trim()
    : fallback;
}

function getCancellationSource(
  value: unknown
): NonNullable<Order["cancellationSource"]> | null {
  const allowed = [
    "CUSTOMER",
    "KITCHEN",
    "AGGREGATOR",
    "SYSTEM",
    "MANUAL",
  ] as const;

  if (
    typeof value === "string" &&
    allowed.includes(
      value as (typeof allowed)[number]
    )
  ) {
    return value as NonNullable<Order["cancellationSource"]>;
  }

  return null;
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
    const body = (await request.json()) as CreateOrderBody;

    const brandId = body.brandId ?? "BurgerForge";
    const kitchenId = body.kitchenId ?? "K1";
    const channel = body.channel ?? "Direct Web";
    const source = body.source ?? "MANUAL";

    if (!isValidBrand(brandId)) {
      return jsonError(
        `Invalid brandId: ${String(brandId)}`
      );
    }

    if (!isValidKitchen(kitchenId)) {
      return jsonError(
        `Invalid kitchenId: ${String(kitchenId)}`
      );
    }

    if (!isValidChannel(channel)) {
      return jsonError(
        `Invalid channel: ${String(channel)}`
      );
    }

    if (!isValidSource(source)) {
      return jsonError(
        `Invalid source: ${String(source)}`
      );
    }

    const validation = validateOrderItems(body.items);

    if (!validation.valid || !validation.normalizedItems) {
      return jsonError(
        validation.error || "Invalid order items"
      );
    }

    const orderId = isNonEmptyString(body.id)
      ? body.id.trim()
      : createId("ORD");

    if (findOrder(orderId)) {
      return jsonError(
        `Order ${orderId} already exists`,
        409
      );
    }

    const externalOrderId = isNonEmptyString(
      body.externalOrderId
    )
      ? body.externalOrderId.trim()
      : undefined;

    const now = new Date().toISOString();

    const baseOrder: Order = {
      id: orderId,
      externalOrderId,
      brandId,
      kitchenId,
      channel,
      source,
      status: "PENDING",
      items: validation.normalizedItems,
      customerName: isNonEmptyString(body.customerName)
        ? body.customerName.trim()
        : undefined,
      driverName: isNonEmptyString(body.driverName)
        ? body.driverName.trim()
        : undefined,
      courierEtaMins:
        typeof body.courierEtaMins === "number" &&
        Number.isFinite(body.courierEtaMins) &&
        body.courierEtaMins >= 0
          ? body.courierEtaMins
          : undefined,
      createdAt: now,
      updatedAt: now,
      receivedAt: now,
      inventoryWarnings: [],
      inventoryUnavailable: [],
      events: [
        createEvent(
          "RECEIVED",
          "ORDER_API",
          `Order received from ${source}`
        ),
      ],
    };

    const inventory = getInventory();

    const inventoryEvaluation = evaluateOrderInventory(
      baseOrder,
      inventory
    );

    const inventoryCheckedEvent = createEvent(
      "INVENTORY_CHECKED",
      "ORDER_API",
      `Inventory decision: ${inventoryEvaluation.decision}`
    );

    baseOrder.events.push(inventoryCheckedEvent);
    baseOrder.inventoryDecision =
      inventoryEvaluation.decision;
    baseOrder.inventoryWarnings =
      inventoryEvaluation.lowStockItems;
    baseOrder.inventoryUnavailable =
      inventoryEvaluation.insufficientStockItems;

    if (
      inventoryEvaluation.insufficientStockItems.length > 0
    ) {
      baseOrder.events.push(
        createEvent(
          "INVENTORY_UNAVAILABLE",
          "ORDER_API",
          inventoryEvaluation.insufficientStockItems.join(
            ", "
          )
        )
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Order cannot be accepted because required inventory is insufficient.",
          order: baseOrder,
          inventoryDecision:
            inventoryEvaluation.decision,
          inventoryUnavailable:
            inventoryEvaluation.insufficientStockItems,
          lowStockItems:
            inventoryEvaluation.lowStockItems,
        },
        { status: 409 }
      );
    }

    const depletion = processOrderDepletion(
      baseOrder,
      inventory
    );

    replaceInventory(depletion.updatedInventory);

    if (depletion.lowStockAlerts.length > 0) {
      baseOrder.inventoryWarnings =
        depletion.lowStockAlerts;

      baseOrder.events.push(
        createEvent(
          "INVENTORY_WARNING",
          "INVENTORY_ENGINE",
          depletion.lowStockAlerts.join(", ")
        )
      );
    }

    baseOrder.acceptedAt = now;

    baseOrder.events.push(
      createEvent(
        "ACCEPTED",
        "ORDER_API",
        "Order accepted and inventory reserved/depleted"
      )
    );

    addOrder(baseOrder);

    return NextResponse.json(
      {
        success: true,
        order: baseOrder,
        orders: getOrders(),
        inventory: getInventory(),
        depletedItems: depletion.depletedItems,
        lowStockItems: depletion.lowStockAlerts,
        inventoryDecision:
          inventoryEvaluation.decision,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create order";

    return jsonError(message, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as UpdateOrderBody;

    if (!isNonEmptyString(body.status) && !isNonEmptyString(body.action)) {
      return jsonError(
        "PATCH requires either status or action"
      );
    }

    const orderIdFromBody = (body as UpdateOrderBody & {
      orderId?: unknown;
      id?: unknown;
    }).orderId;

    const alternateId = (body as UpdateOrderBody & {
      orderId?: unknown;
      id?: unknown;
    }).id;

    const orderId = isNonEmptyString(orderIdFromBody)
      ? orderIdFromBody
      : isNonEmptyString(alternateId)
        ? alternateId
        : undefined;

    if (!orderId) {
      return jsonError("Missing orderId");
    }

    const order = findOrder(orderId);

    if (!order) {
      return jsonError(
        `Order ${orderId} not found`,
        404
      );
    }

    const actor = getActor(body, "SYSTEM");

    /*
     * Explicit action: assign driver.
     */
    if (body.action === "DRIVER_ASSIGNED") {
      if (order.status !== "READY_FOR_PICKUP") {
        return jsonError(
          `Cannot assign driver while order is ${order.status}`,
          409
        );
      }

      if (!isNonEmptyString(body.driverName)) {
        return jsonError(
          "driverName is required when assigning a driver"
        );
      }

      const now = new Date().toISOString();

      const updated = updateOrder(orderId, {
        status: "DRIVER_ASSIGNED",
        driverName: body.driverName.trim(),
        driverAssignedAt: now,
        updatedAt: now,
        events: [
          ...order.events,
          createEvent(
            "DRIVER_ASSIGNED",
            actor,
            `Driver assigned: ${body.driverName.trim()}`
          ),
        ],
      });

      return NextResponse.json({
        success: true,
        order: updated,
        orders: getOrders(),
        inventory: getInventory(),
      });
    }

    /*
     * Explicit action: pickup.
     */
    if (body.action === "PICKED_UP") {
      if (order.status !== "DRIVER_ASSIGNED") {
        return jsonError(
          `Cannot mark pickup while order is ${order.status}`,
          409
        );
      }

      if (!order.driverAssignedAt) {
        return jsonError(
          "Order cannot be picked up before driver assignment",
          409
        );
      }

      const now = new Date().toISOString();

      const updated = updateOrder(orderId, {
        status: "PICKED_UP",
        pickedUpAt: now,
        updatedAt: now,
        events: [
          ...order.events,
          createEvent(
            "PICKED_UP",
            actor,
            order.driverName
              ? `Picked up by ${order.driverName}`
              : "Order picked up"
          ),
        ],
      });

      return NextResponse.json({
        success: true,
        order: updated,
        orders: getOrders(),
        inventory: getInventory(),
      });
    }

    /*
     * No arbitrary action names.
     */
    if (
      body.action !== undefined &&
      !ACTIONS.includes(body.action as OrderAction)
    ) {
      return jsonError(
        `Unsupported order action: ${String(body.action)}`
      );
    }

    /*
     * Standard lifecycle status transition.
     */
    if (!isValidStatus(body.status)) {
      return jsonError(
        `Invalid order status: ${String(body.status)}`
      );
    }

    const nextStatus = body.status;

    if (nextStatus === order.status) {
      return NextResponse.json({
        success: true,
        order,
        orders: getOrders(),
        inventory: getInventory(),
        unchanged: true,
      });
    }

    if (!VALID_TRANSITIONS[order.status].includes(nextStatus)) {
      return jsonError(
        `Invalid lifecycle transition: ${order.status} → ${nextStatus}`,
        409
      );
    }

    const now = new Date().toISOString();

    if (nextStatus === "CANCELLED") {
      const cancellationSource =
        getCancellationSource(body.cancellationSource);

      if (!cancellationSource) {
        return jsonError(
          "cancellationSource is required and must be CUSTOMER, KITCHEN, AGGREGATOR, SYSTEM, or MANUAL"
        );
      }

      if (!isNonEmptyString(body.cancellationReason)) {
        return jsonError(
          "cancellationReason is required when cancelling an order"
        );
      }

      const updated = updateOrder(orderId, {
        status: "CANCELLED",
        cancellationSource,
        cancellationReason:
          body.cancellationReason.trim(),
        cancelledBy: actor,
        updatedAt: now,
        events: [
          ...order.events,
          createEvent(
            "CANCELLED",
            actor,
            `${cancellationSource}: ${body.cancellationReason.trim()}`
          ),
        ],
      });

      return NextResponse.json({
        success: true,
        order: updated,
        orders: getOrders(),
        inventory: getInventory(),
      });
    }

    /*
     * Driver-assigned and pickup transitions must use
     * their explicit actions so required metadata cannot
     * be skipped.
     */
    if (
      nextStatus === "DRIVER_ASSIGNED" ||
      nextStatus === "PICKED_UP"
    ) {
      return jsonError(
        `${nextStatus} must be performed using the corresponding order action`,
        409
      );
    }

    const eventType = getStatusEvent(nextStatus);

    if (!eventType) {
      return jsonError(
        `Unsupported lifecycle status transition: ${nextStatus}`
      );
    }

    const timestampField =
      getStatusTimestamp(nextStatus);

    const timestampUpdate = timestampField
      ? { [timestampField]: now }
      : {};

    const updated = updateOrder(orderId, {
      status: nextStatus,
      updatedAt: now,
      ...timestampUpdate,
      events: [
        ...order.events,
        createEvent(
          eventType,
          actor,
          `Order moved to ${nextStatus}`
        ),
      ],
    });

    return NextResponse.json({
      success: true,
      order: updated,
      orders: getOrders(),
      inventory: getInventory(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update order";

    return jsonError(message, 500);
  }
}
