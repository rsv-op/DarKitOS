
import { NextResponse } from "next/server";
import type { InventoryItem } from "@/lib/db";
import { INVENTORY_DB } from "@/lib/db";

export const dynamic = "force-dynamic";

let globalInventory: InventoryItem[] = [...INVENTORY_DB];

export async function GET() {
  return NextResponse.json({
    success: true,
    inventory: globalInventory,
    lowStock: globalInventory.filter(
      (item) => item.currentStock <= item.reorderThreshold
    ),
  });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { itemId, restockAmount } = body;

    const itemIndex = globalInventory.findIndex(
      (item) => item.id === itemId
    );

    if (itemIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: "Item not found",
        },
        {
          status: 404,
        }
      );
    }

    globalInventory[itemIndex].currentStock += restockAmount;
    globalInventory[itemIndex].lastRestocked =
      new Date().toISOString();

    return NextResponse.json({
      success: true,
      updatedItem: globalInventory[itemIndex],
      inventory: globalInventory,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update inventory";

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
