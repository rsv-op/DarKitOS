```
// File: app/api/orders/route.ts
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process order';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

```

---

### 🔑 Key Fixes for Vercel Deployment

1. **export const dynamic = 'force-dynamic';**: Added to prevent Next.js `next build` from trying to statically pre-render the `GET` endpoint during Vercel deployment.
2. **import type** **Isolation**: Separated interface imports (`Order`, `InventoryItem`) from value imports (`INVENTORY_DB`, `processOrderDepletion`) to satisfy TypeScript's `isolatedModules` build rule.
3. **Safe** **catch (error)** **Clause**: Removed explicit `: any` annotation from the catch block to comply with strict ESLint / TypeScript compiler constraints.
