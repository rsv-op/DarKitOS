```tsx
// File: app/page.tsx
"use client";

import React, { useState } from "react";

type Station = "owner" | "cook" | "dispatch";
type Brand = "BurgerForge" | "TacoMatrix" | "WingProtocol" | "GreenBowl";

interface MockOrder {
  id: string;
  brand: Brand;
  channel: "DoorDash" | "UberEats" | "GrubHub" | "Direct Web";
  items: { name: string; qty: number; notes?: string }[];
  status: "PENDING" | "PREPARING" | "READY" | "DISPATCHED";
  elapsedMins: number;
}

interface InventoryItem {
  sku: string;
  name: string;
  stock: number;
  threshold: number;
  unit: string;
}

const INITIAL_INVENTORY: InventoryItem[] = [
  { sku: "BEEF-01", name: "Angus Beef Patties", stock: 120, threshold: 30, unit: "units" },
  { sku: "BUN-01", name: "Brioche Buns", stock: 18, threshold: 25, unit: "units" },
  { sku: "TACO-01", name: "Birria Beef", stock: 45, threshold: 10, unit: "lbs" },
  { sku: "WING-01", name: "Jumbo Chicken Wings", stock: 310, threshold: 100, unit: "units" },
  { sku: "TUNA-01", name: "Sashimi Ahi Tuna", stock: 24, threshold: 8, unit: "lbs" },
];

const INITIAL_ORDERS: MockOrder[] = [
  {
    id: "ORD-8801",
    brand: "BurgerForge",
    channel: "DoorDash",
    items: [
      { name: "Double Smash Burger", qty: 2, notes: "Extra Pickles" },
      { name: "Truffle Fries", qty: 1 },
    ],
    status: "PREPARING",
    elapsedMins: 4,
  },
  {
    id: "ORD-8802",
    brand: "TacoMatrix",
    channel: "UberEats",
    items: [{ name: "Birria Taco Trio", qty: 1, notes: "Consomé extra" }],
    status: "READY",
    elapsedMins: 2,
  },
  {
    id: "ORD-8803",
    brand: "WingProtocol",
    channel: "GrubHub",
    items: [{ name: "12pc Ghost Pepper Wings", qty: 1 }],
    status: "PENDING",
    elapsedMins: 1,
  },
  {
    id: "ORD-8804",
    brand: "GreenBowl",
    channel: "Direct Web",
    items: [{ name: "Ahi Tuna Poke Bowl", qty: 2 }],
    status: "DISPATCHED",
    elapsedMins: 15,
  },
];

export default function StandaloneShowcaseOS() {
  const [station, setStation] = useState<Station>("owner");
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(true);
  const [orders, setOrders] = useState<MockOrder[]>(INITIAL_ORDERS);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [selectedBrand, setSelectedBrand] = useState<Brand>("BurgerForge");
  const [selectedItem, setSelectedItem] = useState("Double Smash Burger");
  const [qty, setQty] = useState(1);

  const handleInject = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = "ORD-" + Math.floor(1000 + Math.random() * 9000);
    const newOrder: MockOrder = {
      id: newId,
      brand: selectedBrand,
      channel: "Direct Web",
      items: [{ name: selectedItem, qty }],
      status: "PENDING",
      elapsedMins: 0,
    };

    setOrders([newOrder, ...orders]);

    setInventory((prev) =>
      prev.map((item) => {
        if (selectedItem.includes("Burger") && item.sku === "BEEF-01") {
          return { ...item, stock: Math.max(0, item.stock - 2 * qty) };
        }
        if (selectedItem.includes("Burger") && item.sku === "BUN-01") {
          return { ...item, stock: Math.max(0, item.stock - 1 * qty) };
        }
        if (selectedItem.includes("Wings") && item.sku === "WING-01") {
          return { ...item, stock: Math.max(0, item.stock - 12 * qty) };
        }
        return item;
      })
    );
  };

  const advanceOrderStatus = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const nextStatus =
          o.status === "PENDING"
            ? "PREPARING"
            : o.status === "PREPARING"
            ? "READY"
            : "DISPATCHED";
        return { ...o, status: nextStatus };
      })
    );
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4 font-mono">
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl max-w-sm w-full text-center">
          <h1 className="text-xl font-bold mb-2 text-sky-400">Dark-Cloud OS Gateway</h1>
          <p className="text-xs text-gray-400 mb-6">Enter PIN 9999 for Master Access</p>
          <input
            type="password"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full bg-gray-950 border border-sky-500/30 text-center text-2xl tracking-widest p-3 rounded-lg mb-4 text-white outline-none"
            placeholder="••••"
          />
          <button
            onClick={() => pin === "9999" && setAuthenticated(true)}
            className="w-full bg-sky-500 text-gray-950 font-bold py-3 rounded-lg text-sm uppercase"
          >
            Authenticate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-center border-b border-gray-800 pb-4 mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-xl font-bold font-mono tracking-tight">Dark-Cloud Kitchen OS</h1>
            <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded font-mono">
              UI/UX Showcase (0-API Standalone)
            </span>
          </div>
          <p className="text-gray-400 text-xs mt-0.5">4 DBA Brands · 1 Physical Kitchen Facility</p>
        </div>

        <div className="flex bg-gray-900 p-1 rounded-xl border border-gray-800 font-mono text-xs">
          {(["owner", "cook", "dispatch"] as Station[]).map((st) => (
            <button
              key={st}
              onClick={() => setStation(st)}
              className={`px-4 py-2 rounded-lg font-bold uppercase transition-all ${
                station === st
                  ? "bg-sky-500 text-gray-950 shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {st} Station
            </button>
          ))}
        </div>
      </header>

      {station === "owner" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 border border-gray-800 p-5 rounded-xl">
              <div className="text-xs text-gray-400 font-mono uppercase">Active Orders</div>
              <div className="text-3xl font-mono font-bold text-white mt-1">
                {orders.filter((o) => o.status !== "DISPATCHED").length}
              </div>
              <div className="text-[11px] text-emerald-400 font-mono mt-1">Live KDS Syncing</div>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-5 rounded-xl">
              <div className="text-xs text-gray-400 font-mono uppercase">Avg Prep Speed</div>
              <div className="text-3xl font-mono font-bold text-amber-400 mt-1">5.8 mins</div>
              <div className="text-[11px] text-emerald-400 font-mono mt-1">SLA Target: &lt; 8.0 mins</div>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-5 rounded-xl">
              <div className="text-xs text-gray-400 font-mono uppercase">Daily Gross Revenue</div>
              <div className="text-3xl font-mono font-bold text-emerald-400 mt-1">
                \${(orders.length * 28.5 + 1420).toFixed(2)}
              </div>
              <div className="text-[11px] text-gray-400 font-mono mt-1">4 DBA Brands Combined</div>
            </div>

            <div className="bg-gray-900 border border-red-900/40 bg-red-950/10 p-5 rounded-xl">
              <div className="text-xs text-red-400 font-mono uppercase">Low Stock Alerts</div>
              <div className="text-3xl font-mono font-bold text-red-400 mt-1">
                {inventory.filter((i) => i.stock <= i.threshold).length} Items
              </div>
              <div className="text-[11px] text-red-300 font-mono mt-1">Immediate Reorder Triggered</div>
            </div>
          </div>

          <div className="bg-gray-900 border border-sky-500/30 p-5 rounded-xl">
            <h3 className="text-xs font-mono font-bold uppercase text-sky-400 mb-3">
              ⚡ UI/UX Order Injector & Real-time Depletion Test
            </h3>
            <form onSubmit={handleInject} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value as Brand)}
                className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-xs font-mono text-white outline-none"
              >
                <option value="BurgerForge">BurgerForge</option>
                <option value="TacoMatrix">TacoMatrix</option>
                <option value="WingProtocol">WingProtocol</option>
                <option value="GreenBowl">GreenBowl</option>
              </select>

              <select
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
                className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-xs font-mono text-white outline-none"
              >
                <option value="Double Smash Burger">Double Smash Burger</option>
                <option value="Birria Taco Trio">Birria Taco Trio</option>
                <option value="12pc Ghost Pepper Wings">12pc Ghost Pepper Wings</option>
                <option value="Ahi Tuna Poke Bowl">Ahi Tuna Poke Bowl</option>
              </select>

              <input
                type="number"
                min={1}
                max={5}
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value) || 1)}
                className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg text-xs font-mono text-white outline-none"
              />

              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-mono font-bold p-2.5 rounded-lg text-xs uppercase"
              >
                Inject Order & Deplete Stock
              </button>
            </form>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-5 rounded-xl">
            <h3 className="text-xs font-mono font-bold uppercase text-gray-300 mb-4">
              Real-time Inventory Ledger
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 uppercase">
                    <th className="pb-2">SKU</th>
                    <th className="pb-2">Ingredient</th>
                    <th className="pb-2">Stock Level</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {inventory.map((item) => {
                    const isLow = item.stock <= item.threshold;
                    return (
                      <tr key={item.sku}>
                        <td className="py-2.5 text-gray-400">{item.sku}</td>
                        <td className="py-2.5 text-white font-semibold">{item.name}</td>
                        <td className={`py-2.5 font-bold ${isLow ? "text-red-400" : "text-emerald-400"}`}>
                          {item.stock} {item.unit}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isLow
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            {isLow ? "REORDER LOW" : "OK"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {station === "cook" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {orders
            .filter((o) => o.status !== "DISPATCHED")
            .map((order) => (
              <div
                key={order.id}
                className="bg-gray-900 border border-gray-800 p-5 rounded-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-mono font-bold text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded bg-sky-500/10">
                      {order.brand}
                    </span>
                    <span className="text-xs font-mono text-gray-400">{order.id}</span>
                  </div>

                  <ul className="space-y-2 mb-6 text-sm">
                    {order.items.map((it, idx) => (
                      <li key={idx} className="flex justify-between">
                        <span className="font-bold text-white">{it.qty}x {it.name}</span>
                        {it.notes && <span className="text-xs text-amber-400 font-mono">⚠️ {it.notes}</span>}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => advanceOrderStatus(order.id)}
                  className={`w-full py-2.5 rounded-lg font-mono text-xs font-bold uppercase ${
                    order.status === "PENDING"
                      ? "bg-amber-500 text-gray-950 hover:bg-amber-400"
                      : "bg-emerald-500 text-gray-950 hover:bg-emerald-400"
                  }`}
                >
                  {order.status === "PENDING" ? "Start Cook →" : "Mark Ready ✓"}
                </button>
              </div>
            ))}
        </div>
      )}

      {station === "dispatch" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="bg-gray-950 border-b border-gray-800 text-gray-400 uppercase">
                <th className="p-4">Order Ref</th>
                <th className="p-4">Brand</th>
                <th className="p-4">Channel</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="p-4 font-bold text-sky-400">{o.id}</td>
                  <td className="p-4 text-white">{o.brand}</td>
                  <td className="p-4 text-gray-400">{o.channel}</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded text-[10px] font-bold ${
                        o.status === "READY"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {o.status === "READY" ? (
                      <button
                        onClick={() => advanceOrderStatus(o.id)}
                        className="bg-emerald-500 text-gray-950 font-bold px-3 py-1.5 rounded text-xs uppercase"
                      >
                        Hand Off →
                      </button>
                    ) : (
                      <span className="text-gray-600 italic">In Progress</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

```typescript
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
    const generatedId = "ORD-" + Math.floor(1000 + Math.random() * 9000);

    const newOrder: Order = {
      id: body.id ? String(body.id) : generatedId,
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

```typescript
// File: app/api/inventory/route.ts
import { NextResponse } from 'next/server';
import { INVENTORY_DB, InventoryItem } from '@/lib/db';

export const dynamic = 'force-dynamic';

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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update inventory';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
```

```typescript
// File: lib/db.ts

export type DbaBrand = 'BurgerForge' | 'TacoMatrix' | 'WingProtocol' | 'GreenBowl';
export type OrderChannel = 'DoorDash' | 'UberEats' | 'GrubHub' | 'Direct Web';
export type StationRole = 'cook' | 'dispatch' | 'owner';
export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY_FOR_PICKUP' | 'DISPATCHED' | 'CANCELLED';
export type KitchenStation = 'Grill' | 'Fryer' | 'Assembly' | 'Cold Prep';

export interface BrandConfig {
  id: DbaBrand;
  name: string;
  code: string;
  active: boolean;
  colorTheme: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: 'Protein' | 'Produce' | 'Dairy' | 'Packaging' | 'Sauce' | 'Dry Good';
  currentStock: number;
  unit: 'oz' | 'lbs' | 'units' | 'count';
  reorderThreshold: number;
  costPerUnit: number;
  lastRestocked: string;
}

export interface RecipeIngredient {
  inventoryItemId: string;
  quantityRequired: number;
}

export interface MenuItem {
  id: string;
  brandId: DbaBrand;
  name: string;
  price: number;
  station: KitchenStation;
  recipe: RecipeIngredient[];
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  notes?: string;
  station: KitchenStation;
}

export interface Order {
  id: string;
  brandId: DbaBrand;
  channel: OrderChannel;
  status: OrderStatus;
  items: OrderItem[];
  customerName?: string;
  driverName?: string;
  courierEtaMins?: number;
  createdAt: string;
  updatedAt: string;
  prepStartedAt?: string;
  prepCompletedAt?: string;
  dispatchedAt?: string;
}

export const BRANDS_DB: Record<DbaBrand, BrandConfig> = {
  BurgerForge: { id: 'BurgerForge', name: 'BurgerForge', code: 'BF', active: true, colorTheme: 'amber' },
  TacoMatrix: { id: 'TacoMatrix', name: 'TacoMatrix', code: 'TM', active: true, colorTheme: 'emerald' },
  WingProtocol: { id: 'WingProtocol', name: 'WingProtocol', code: 'WP', active: true, colorTheme: 'red' },
  GreenBowl: { id: 'GreenBowl', name: 'GreenBowl', code: 'GB', active: true, colorTheme: 'cyan' },
};

export const INVENTORY_DB: InventoryItem[] = [
  { id: 'INV-001', sku: 'BEEF-PATTY', name: 'Angus Beef Patties', category: 'Protein', currentStock: 140, unit: 'units', reorderThreshold: 30, costPerUnit: 1.20, lastRestocked: new Date().toISOString() },
  { id: 'INV-002', sku: 'BRIOCHE-BUN', name: 'Brioche Buns', category: 'Packaging', currentStock: 18, unit: 'units', reorderThreshold: 25, costPerUnit: 0.40, lastRestocked: new Date().toISOString() },
  { id: 'INV-003', sku: 'BIRRIA-BEEF', name: 'Slow-Cooked Birria Beef', category: 'Protein', currentStock: 45, unit: 'lbs', reorderThreshold: 10, costPerUnit: 4.50, lastRestocked: new Date().toISOString() },
  { id: 'INV-004', sku: 'CORN-TORTILLA', name: 'Corn Tortillas', category: 'Dry Good', currentStock: 220, unit: 'units', reorderThreshold: 50, costPerUnit: 0.10, lastRestocked: new Date().toISOString() },
  { id: 'INV-005', sku: 'WING-RAW', name: 'Jumbo Chicken Wings', category: 'Protein', currentStock: 350, unit: 'units', reorderThreshold: 100, costPerUnit: 0.55, lastRestocked: new Date().toISOString() },
  { id: 'INV-006', sku: 'GHOST-SAUCE', name: 'Ghost Pepper Glaze', category: 'Sauce', currentStock: 12, unit: 'oz', reorderThreshold: 20, costPerUnit: 0.85, lastRestocked: new Date().toISOString() },
  { id: 'INV-007', sku: 'AHI-TUNA', name: 'Sashimi Grade Ahi Tuna', category: 'Protein', currentStock: 28, unit: 'lbs', reorderThreshold: 8, costPerUnit: 12.00, lastRestocked: new Date().toISOString() },
  { id: 'INV-008', sku: 'AVOCADO-FRESH', name: 'Hass Avocados', category: 'Produce', currentStock: 65, unit: 'units', reorderThreshold: 15, costPerUnit: 0.90, lastRestocked: new Date().toISOString() },
];

export const MENU_CATALOG: MenuItem[] = [
  {
    id: 'MENU-BF-01',
    brandId: 'BurgerForge',
    name: 'Double Smash Burger',
    price: 12.99,
    station: 'Grill',
    recipe: [
      { inventoryItemId: 'INV-001', quantityRequired: 2 },
      { inventoryItemId: 'INV-002', quantityRequired: 1 },
    ],
  },
  {
    id: 'MENU-BF-02',
    brandId: 'BurgerForge',
    name: 'Truffle Fries',
    price: 6.49,
    station: 'Fryer',
    recipe: [],
  },
  {
    id: 'MENU-TM-01',
    brandId: 'TacoMatrix',
    name: 'Birria Taco Trio',
    price: 14.50,
    station: 'Assembly',
    recipe: [
      { inventoryItemId: 'INV-003', quantityRequired: 0.5 },
      { inventoryItemId: 'INV-004', quantityRequired: 3 },
    ],
  },
  {
    id: 'MENU-WP-01',
    brandId: 'WingProtocol',
    name: '12pc Ghost Pepper Wings',
    price: 16.99,
    station: 'Fryer',
    recipe: [
      { inventoryItemId: 'INV-005', quantityRequired: 12 },
      { inventoryItemId: 'INV-006', quantityRequired: 4 },
    ],
  },
  {
    id: 'MENU-GB-01',
    brandId: 'GreenBowl',
    name: 'Ahi Tuna Poke Bowl',
    price: 17.25,
    station: 'Cold Prep',
    recipe: [
      { inventoryItemId: 'INV-007', quantityRequired: 0.4 },
      { inventoryItemId: 'INV-008', quantityRequired: 1 },
    ],
  },
];

export function processOrderDepletion(order: Order, inventory: InventoryItem[]): {
  updatedInventory: InventoryItem[];
  depletedItems: { itemId: string; name: string; amountDepleted: number; remainingStock: number }[];
  lowStockAlerts: InventoryItem[];
} {
  const updatedInventory = [...inventory.map((item) => ({ ...item }))];
  const depletedItems: { itemId: string; name: string; amountDepleted: number; remainingStock: number }[] = [];

  for (const orderItem of order.items) {
    const menuItem = MENU_CATALOG.find((m) => m.id === orderItem.menuItemId || m.name === orderItem.name);
    if (!menuItem) continue;

    for (const ing of menuItem.recipe) {
      const invIndex = updatedInventory.findIndex((i) => i.id === ing.inventoryItemId);
      if (invIndex !== -1) {
        const totalDepletion = ing.quantityRequired * orderItem.quantity;
        updatedInventory[invIndex].currentStock = Math.max(0, updatedInventory[invIndex].currentStock - totalDepletion);

        depletedItems.push({
          itemId: updatedInventory[invIndex].id,
          name: updatedInventory[invIndex].name,
          amountDepleted: totalDepletion,
          remainingStock: updatedInventory[invIndex].currentStock,
        });
      }
    }
  }

  const lowStockAlerts = updatedInventory.filter((item) => item.currentStock <= item.reorderThreshold);

  return { updatedInventory, depletedItems, lowStockAlerts };
}
```

```typescript
// File: middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get('dark_cloud_session')?.value;

  if (!authCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```
