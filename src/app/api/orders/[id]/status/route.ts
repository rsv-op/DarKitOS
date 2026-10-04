import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  updateOrder,
  getOrders,
  getInventory,
  replaceInventory,
} from "@/lib/store";

const VALID_TRANSITIONS: Record<
  string,
  string[]
> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: [
    "READY_FOR_PICKUP",
    "CANCELLED",
  ],
  READY_FOR_PICKUP: [
    "DRIVER_ASSIGNED",
    "CANCELLED",
  ],
  DRIVER_ASSIGNED: ["PICKED_UP"],
  PICKED_UP: ["DISPATCHED"],
  DISPATCHED: [],
  CANCELLED: [],
};

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

  if (!nextStatus) {
    return NextResponse.json(
      { error: "status is required" },
      { status: 400 }
    );
  }

  const orders = getOrders();
  const order = orders.find(
    (o) => o.id === params.id
  );

  if (!order) {
    return NextResponse.json(
      { error: "Order not found" },
      { status: 404 }
    );
  }

  const allowedTransitions =
    VALID_TRANSITIONS[order.status];

  if (
    !allowedTransitions?.includes(nextStatus)
  ) {
    return NextResponse.json(
      {
        error: `Invalid transition: ${order.status} -> ${nextStatus}`,
      },
      { status: 409 }
    );
  }

  // Inventory gate: preparation requires sufficient stock
  if (nextStatus === "PREPARING") {
    const inventory = getInventory();

    // For MVP: simple validation that at least 1 unit of each item in kitchen is available
    const kitchenItems = inventory.filter(
      (inv) => inv.kitchenId === order.kitchenId
    );

    const insufficient = kitchenItems.filter(
      (inv) => inv.currentStock < 1
    );

    if (insufficient.length > 0) {
      return NextResponse.json(
        {
          error:
            "Insufficient inventory for preparation",
          insufficientItems: insufficient.map(
            (i) => i.name
          ),
        },
        { status: 409 }
      );
    }

    // Deplete inventory: decrement 1 unit per item for this order
    const updatedInventory = inventory.map(
      (inv) => {
        if (
          order.kitchenId ===
          inv.kitchenId
        ) {
          return {
            ...inv,
            currentStock: Math.max(
              0,
              inv.currentStock - 1
            ),
          };
        }
        return inv;
      }
    );

    replaceInventory(updatedInventory);
  }

  const updatedOrder = updateOrder(
    params.id,
    (currentOrder) => {
      const timestamp =
        new Date().toISOString();

      const nextOrder = {
        ...currentOrder,
        status: nextStatus,
        updatedAt: timestamp,
        events: [
          ...currentOrder.events,
          {
            id: `evt-${Date.now()}`,
            type: nextStatus,
            timestamp,
            actor: session.userId,
            details: `Order transitioned to ${nextStatus}`,
          },
        ],
      };

      if (
        nextStatus === "READY_FOR_PICKUP"
      ) {
        nextOrder.readyAt =
          currentOrder.readyAt ?? timestamp;
      }

      if (
        nextStatus === "DRIVER_ASSIGNED"
      ) {
        nextOrder.driverAssignedAt =
          currentOrder.driverAssignedAt ??
          timestamp;
      }

      if (nextStatus === "PICKED_UP") {
        nextOrder.pickedUpAt =
          currentOrder.pickedUpAt ??
          timestamp;
      }

      if (
        nextStatus === "DISPATCHED"
      ) {
        nextOrder.dispatchedAt =
          currentOrder.dispatchedAt ??
          timestamp;
      }

      if (nextStatus === "CANCELLED") {
        nextOrder.cancelledBy =
          session.userId;
      }

      return nextOrder;
    }
  );

  return NextResponse.json({
    success: true,
    order: updatedOrder,
  });
}and 
