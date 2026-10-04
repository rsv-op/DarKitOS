import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { addOrder } from "@/lib/store";
import { MENU_CATALOG } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orders = require("@/lib/store").getOrders();
  return NextResponse.json(orders);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { brandId, kitchenId, channel, itemCount } = body;

  if (!brandId || !kitchenId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const order: Order = {
    id: `ORD-${Date.now()}`,
    brandId,
    kitchenId,
    channel,
    status: "PENDING",
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    events: [
      {
        id: `evt-${Date.now()}`,
        type: "RECEIVED",
        timestamp: new Date().toISOString(),
        actor: session.userId,
      },
    ],
  };

  addOrder(order);

  return NextResponse.json({ success: true, order }, { status: 201 });
}
