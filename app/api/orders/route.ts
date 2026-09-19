
import { NextResponse } from 'next/server';
import type { Order, InventoryItem } from '@/lib/db';
import { INVENTORY_DB, processOrderDepletion } from '@/lib/db';

export const dynamic = 'force-dynamic';

let globalOrders: Order[] = [];
let globalInventory: InventoryItem[] = [...INVENTORY_DB];

export async function GET() {
  return NextResponse.json({
    success: true,
    orders: globalOrders,
    inventory: globalInventory,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const generatedId =
      "ORD-" + Math.floor(1000 + Math.random() * 9000);

    const newOrder: Order = {
      id: body.id ? String(body.id) : generatedId,
      brandId: body.brandId || 'BurgerForge',
      channel: body.channel || 'Direct Web',
      status: 'PENDING',
      items: body.items || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const {
      updatedInventory,
      depletedItems,
      lowStockAlerts,
    } = processOrderDepletion(
      newOrder,
      globalInventory
    );

    globalInventory = updatedInventory;
    globalOrders.unshift(newOrder);

    return NextResponse.json({
      success: true,
      order: newOrder,
      depletedItems,
      lowStockAlerts,
      currentInventory: globalInventory,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to process order';

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}
