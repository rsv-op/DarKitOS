```typescript
// File: app/api/orders/route.ts
import { NextResponse } from 'next/server';
import {
  Order,
  INVENTORY_DB,
  processOrderDepletion,
  InventoryItem,
} from '@/lib/db';

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
    const newOrder: Order = {
      id: body.id || `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      brandId: body.brandId || 'BurgerForge',
      channel: body.channel || 'Direct Web',
      status: 'PENDING',
      items: body.items || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { updatedInventory, depletedItems, lowStockAlerts } = processOrderDepletion(
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process order' },
      { status: 500 }
    );
  }
}
```

```typescript
// File: app/api/inventory/route.ts
import { NextResponse } from 'next/server';
import { INVENTORY_DB, InventoryItem } from '@/lib/db';

let globalInventory: InventoryItem[] = [...INVENTORY_DB];

export async function GET() {
  return NextResponse.json({
    success: true,
    inventory: globalInventory,
    lowStock: globalInventory.filter((item) => item.currentStock <= item.reorderThreshold),
  });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { itemId, restockAmount } = body;

    const itemIndex = globalInventory.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    globalInventory[itemIndex].currentStock += restockAmount;
    globalInventory[itemIndex].lastRestocked = new Date().toISOString();

    return NextResponse.json({
      success: true,
      updatedItem: globalInventory[itemIndex],
      inventory: globalInventory,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update inventory' },
      { status: 500 }
    );
  }
}
```
