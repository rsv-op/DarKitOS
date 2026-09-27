import { NextResponse } from "next/server";
import type { InventoryItem } from "@/lib/db";
import {
  getInventory,
  replaceInventory,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const inventory = getInventory();

  return NextResponse.json({
    success: true,
    inventory,
    lowStock: inventory.filter(
      (item) => item.currentStock <= item.reorderThreshold
    ),
  });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const itemId = String(body.itemId || "");
    const restockAmount = Number(body.restockAmount);

    if (!itemId) {
      return NextResponse.json(
        {
          success: false,
          error: "itemId is required",
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(restockAmount) || restockAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "restockAmount must be a positive number",
        },
        { status: 400 }
      );
    }

    const inventory = getInventory();

    const itemIndex = inventory.findIndex((item) => item.id === itemId);

    if (itemIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: "Item not found",
        },
        { status: 404 }
      );
    }

    const updatedInventory: InventoryItem[] = inventory.map((item, index) => {
      if (index !== itemIndex) {
        return item;
      }

      return {
        ...item,
        currentStock: item.currentStock + restockAmount,
        lastRestocked: new Date().toISOString(),
      };
    });

    replaceInventory(updatedInventory);

    const updatedItem = updatedInventory[itemIndex];

    return NextResponse.json({
      success: true,
      updatedItem,
      inventory: updatedInventory,
      lowStock: updatedInventory.filter(
        (item) => item.currentStock <= item.reorderThreshold
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update inventory";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
