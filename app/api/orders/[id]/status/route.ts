import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getOrders,
  updateOrder,
  getInventory,
  replaceInventory,
} from "@/lib/store";

const VALID_TRANSITIONS = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["DRIVER_ASSIGNED", "CANCELLED"],
  DRIVER_ASSIGNED: ["PICKED_UP"],
  PICKED_UP: ["DISPATCHED"],
  DISPATCHED: [],
  CANCELLED: [],
} as const;

function appendEvent(order: any, type: string, actor: string, details?: string) {
  return [
    ...order.events,
    {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      actor,
      timestamp: new Date().toISOString(),
      ...(details ? { details } : {}),
    },
  ];
}

function getRequiredIngredients(order: any) {
  // This should reflect the canonical recipe mapping from your menu items.
  // Example:
  // For each menu item in order.items:
  //   resolve the item recipe
  //   multiply ingredient qty by quantity
  // return [{ ingredientId, quantity }]
  return [
    { ingredientId: "ing-bun", quantity: 2 },
    { ingredientId: "ing-patty", quantity: 1 },
  ];
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const nextStatus = body?.status;

  if (!nextStatus || typeof nextStatus !== "string") {
    return NextResponse.json(
      { error: "status is required" },
      { status: 400 }
    );
  }

  const orders = getOrders();
  const order = orders.find((entry) => entry.id === params.id);

  if (!order) {
    return NextResponse.json(
      { error: "Order not found" },
      { status: 404 }
    );
  }

  const allowedTransitions =
    VALID_TRANSITIONS[
      order.status as keyof typeof VALID_TRANSITIONS
    ];

  if (!allowedTransitions?.includes(nextStatus)) {
    return NextResponse.json(
      {
        error: `Invalid transition: ${order.status} -> ${nextStatus}`,
      },
      { status: 409 }
    );
  }

  // Inventory gate: prep requires sufficient stock
  if (nextStatus === "PREPARING") {
    const inventory = getInventory();
    const required = getRequiredIngredients(order);

    const insufficient = required.filter(({ ingredientId, quantity }) => {
      const item = inventory.find((entry) => entry.id === ingredientId);
      return !item || item.currentStock < quantity;
    });

    if (insufficient.length > 0) {
      return NextResponse.json(
        {
          error: "Insufficient inventory for preparation",
          insufficient,
        },
        { status: 409 }
      );
    }

    const updatedInventory = inventory.map((entry) => {
      const match = required.find((req) => req.ingredientId === entry.id);
      if (!match) return entry;

      return {
        ...entry,
        currentStock: entry.currentStock - match.quantity,
      };
    });

    replaceInventory(updatedInventory);
  }

  const updatedOrder = updateOrder(params.id, (currentOrder) => {
    const timestamp = new Date().toISOString();

    const nextOrder = {
      ...currentOrder,
      status: nextStatus,
      updatedAt: timestamp,
      events: appendEvent(
        currentOrder,
        nextStatus,
        session.userId,
        `status change: ${currentOrder.status} -> ${nextStatus}`
      ),
    };

    if (nextStatus === "READY_FOR_PICKUP") {
      nextOrder.readyAt = currentOrder.readyAt ?? timestamp;
    }

    if (nextStatus === "DRIVER_ASSIGNED") {
      nextOrder.driverAssignedAt = currentOrder.driverAssignedAt ?? timestamp;
    }

    if (nextStatus === "PICKED_UP") {
      nextOrder.pickedUpAt = currentOrder.pickedUpAt ?? timestamp;
    }

    if (nextStatus === "DISPATCHED") {
      nextOrder.dispatchedAt = currentOrder.dispatchedAt ?? timestamp;
    }

    if (nextStatus === "CANCELLED") {
      nextOrder.cancelledBy = session.userId;
    }

    return nextOrder;
  });

  return NextResponse.json({
    success: true,
    order: updatedOrder,
  });
}
