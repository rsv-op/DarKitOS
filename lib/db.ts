
/**
 * ═══════════════════════════════════════════════════════════════════
 *  lib/db.ts — Universal Adapter for Dark-Cloud Kitchen OS
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Zero-cost state layer:
 *   • Browser-native IndexedDB — no paid databases, no network calls
 *   • SSR-safe — every entry point guards `typeof window !== 'undefined'`
 *     so Vercel's static build never touches browser APIs
 *   • Promise-based, dependency-free (raw IDB, strict TypeScript)
 *   • Shared by / (Command Center), /orders (Pipeline), /inventory (Matrix)
 *
 *  Cross-tab sync model: pages poll these readers on a 1000ms interval.
 */

// ─────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────

export type OrderStatus = "PENDING" | "PREPPING" | "COMPLETED";

export interface Order {
  id: string;
  brand: string;
  items: string[];
  status: OrderStatus;
  total: number;
  createdAt: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  reorderThreshold: number;
  brand: string;
}

const DB_NAME = "dark-cloud-kitchen-os";
const DB_VERSION = 1;
const STORE_ORDERS = "orders";
const STORE_INVENTORY = "inventory";

// ─────────────────────────────────────────────────────────────────
// LOW-LEVEL HELPERS
// ─────────────────────────────────────────────────────────────────

const isBrowser = (): boolean => typeof window !== "undefined";

function openDB(): Promise<IDBDatabase | null> {
  if (!isBrowser() || !("indexedDB" in window)) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ORDERS))
        db.createObjectStore(STORE_ORDERS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE_INVENTORY))
        db.createObjectStore(STORE_INVENTORY, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(db => {
    if (!db) return Promise.resolve(null as unknown as T);
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = run(t.objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

const uid = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// ─────────────────────────────────────────────────────────────────
// SEED — default inventory for a multi-brand cloud kitchen
// ─────────────────────────────────────────────────────────────────

export async function initDefaultInventory(): Promise<void> {
  if (!isBrowser()) return;
  const existing = await getAllInventory();
  if (existing.length > 0) return; // seed once, never clobber live data
  const seed: InventoryItem[] = [
    { id: uid(), name: "Chicken Breast", unit: "kg", quantity: 12, reorderThreshold: 8, brand: "Cluck & Co" },
    { id: uid(), name: "Sourdough Buns", unit: "pcs", quantity: 40, reorderThreshold: 30, brand: "Cluck & Co" },
    { id: uid(), name: "Truffle Fries", unit: "kg", quantity: 5, reorderThreshold: 6, brand: "Fry Society" },
    { id: uid(), name: "Plant Patty", unit: "pcs", quantity: 60, reorderThreshold: 25, brand: "Verdant" },
    { id: uid(), name: "Mozzarella", unit: "kg", quantity: 3, reorderThreshold: 5, brand: "Verdant" },
    { id: uid(), name: "Cold Brew Concentrate", unit: "L", quantity: 2, reorderThreshold: 4, brand: "Night Owl" },
    { id: uid(), name: "Oat Milk", unit: "L", quantity: 10, reorderThreshold: 6, brand: "Night Owl" },
    { id: uid(), name: "Burger Sauce", unit: "L", quantity: 4, reorderThreshold: 3, brand: "Cluck & Co" },
  ];
  for (const item of seed) await putInventory(item);
}

// ─────────────────────────────────────────────────────────────────
// INVENTORY — read / write / adjust
// ─────────────────────────────────────────────────────────────────

export function getAllInventory(): Promise<InventoryItem[]> {
  return tx<InventoryItem[]>(STORE_INVENTORY, "readonly", s => s.getAll() as IDBRequest<InventoryItem[]>)
    .catch(() => []);
}

export function putInventory(item: InventoryItem): Promise<unknown> {
  return tx(STORE_INVENTORY, "readwrite", s => s.put(item)).catch(() => null);
}

/** Add signed delta (+/-) to an item's quantity. Never goes below 0. */
export async function adjustInventory(id: string, delta: number): Promise<void> {
  const all = await getAllInventory();
  const item = all.find(i => i.id === id);
  if (!item) return;
  await putInventory({ ...item, quantity: Math.max(0, item.quantity + delta) });
}

// ─────────────────────────────────────────────────────────────────
// ORDERS — read / write / status transitions
// ─────────────────────────────────────────────────────────────────

export function getAllOrders(): Promise<Order[]> {
  return tx<Order[]>(STORE_ORDERS, "readonly", s => s.getAll() as IDBRequest<Order[]>)
    .catch(() => []);
}

export function putOrder(order: Order): Promise<unknown> {
  return tx(STORE_ORDERS, "readwrite", s => s.put(order)).catch(() => null);
}

export async function setOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const all = await getAllOrders();
  const order = all.find(o => o.id === id);
  if (!order) return;
  await putOrder({ ...order, status });
}

const BRANDS = ["Cluck & Co", "Fry Society", "Verdant", "Night Owl"];
const MENU: Record<string, string[]> = {
  "Cluck & Co": ["Crispy Chicken Stack", "Sauce-Double Burger", "Chicken Tenders Box"],
  "Fry Society": ["Truffle Fry Bucket", "Loaded Fries", "Fry Flight (3)"],
  "Verdant": ["Plant Smash Burger", "Green Stack", "Mozzarella Melt"],
  "Night Owl": ["Cold Brew Float", "Oat Latte (XL)", "Midnight Mocha"],
};

/** Command Center simulation: injects one randomized mock order. */
export async function createMockOrder(): Promise<Order | null> {
  if (!isBrowser()) return null;
  const brand = BRANDS[Math.floor(Math.random() * BRANDS.length)];
  const menu = MENU[brand];
  const count = 1 + Math.floor(Math.random() * 3);
  const items = Array.from({ length: count }, () => menu[Math.floor(Math.random() * menu.length)]);
  const order: Order = {
    id: uid(),
    brand,
    items,
    status: "PENDING",
    total: Math.round(items.length * (8 + Math.random() * 7) * 100) / 100,
    createdAt: Date.now(),
  };
  await putOrder(order);
  return order;
}
