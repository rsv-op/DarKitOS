import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { addOrder, getOrders, Order } from "@/lib/store";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const orders = getOrders();
  return NextResponse.json(orders);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const {
    brandId,
    kitchenId,
    channel,
    totalAmount,
    itemCount,
  } = body;

  if (!brandId || !kitchenId) {
    return NextResponse.json(
      { error: "Missing brandId or kitchenId" },
      { status: 400 }
    );
  }

  const order: Order = {
    id: `ORD-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    brandId,
    kitchenId,
    channel: channel || "DEV_INJECT",
    status: "PENDING",
    items: [],
    totalAmount: totalAmount || 0,
    itemCount: itemCount || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    events: [
      {
        id: `evt-${Date.now()}`,
        type: "RECEIVED",
        timestamp: new Date().toISOString(),
        actor: session.userId,
        details: "Order received from injection",
      },
    ],
  };

  addOrder(order);

  return NextResponse.json(
    { success: true, order },
    { status: 201 }
  );
}
