import { NextResponse } from "next/server";
import type { Order, OrderStatus } from "@/lib/db";
import { processOrderDepletion } from "@/lib/db";
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

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "An order must contain at least one item",
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const newOrder: Order = {
      id: body.id ? String(body.id) : `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      brandId: body.brandId || "BurgerForge",
      channel: body.channel || "Direct Web",
      status: "PENDING",
      items: body.items,
      customerName: body.customerName,
      driverName: body.driverName,
      courierEtaMins: body.courierEtaMins,
      createdAt: now,
      updatedAt: now,
      prepStartedAt: undefined,
      prepCompletedAt: undefined,
      dispatchedAt: undefined,
    };

    const {
      updatedInventory,
      depletedItems,
      lowStockAlerts,
    } = processOrderDepletion(newOrder, getInventory());

    replaceInventory(updatedInventory);
    addOrder(newOrder);

    return NextResponse.json({
      success: true,
      order: newOrder,
      depletedItems,
      lowStockAlerts,
      currentInventory: getInventory(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process order";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const orderId = String(body.orderId || "");
    const requestedStatus = body.status as OrderStatus | undefined;

    if (!orderId || !requestedStatus) {
      return NextResponse.json(
        {
          success: false,
          error: "orderId and status are required",
        },
        { status: 400 }
      );
    }

    const order = findOrder(orderId);

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: "Order not found",
        },
        { status: 404 }
      );
    }

    const allowedTransitions = VALID_TRANSITIONS[order.status];

    if (!allowedTransitions.includes(requestedStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid order transition: ${order.status} → ${requestedStatus}`,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    const updates: Partial<Order> = {
      status: requestedStatus,
      updatedAt: now,
    };

    if (requestedStatus === "PREPARING" && !order.prepStartedAt) {
      updates.prepStartedAt = now;
    }

    if (requestedStatus === "READY_FOR_PICKUP") {
      updates.prepCompletedAt = now;
    }

    if (requestedStatus === "DISPATCHED") {
      updates.dispatchedAt = now;

      if (body.driverName !== undefined) {
        updates.driverName = String(body.driverName);
      }
    }

    const updatedOrder = updateOrder(orderId, updates);

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      orders: getOrders(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update order";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
