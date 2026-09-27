import type { InventoryItem, Order } from "@/lib/db";
import { INVENTORY_DB } from "@/lib/db";

/**
 * Storage boundary for Dark Cloud Kitchen OS.
 *
 * IMPORTANT:
 * This is intentionally an in-memory implementation for the MVP.
 *
 * Application code should interact with the exported repository
 * functions rather than directly accessing the underlying arrays.
 *
 * Later, this implementation can be replaced with PostgreSQL,
 * Supabase, Neon, etc. without redesigning Cook, Dispatch, Owner,
 * or the API contracts.
 */

export type KitchenState = {
  orders: Order[];
  inventory: InventoryItem[];
};

export type StoreSnapshot = {
  orders: Order[];
  inventory: InventoryItem[];
};

type GlobalKitchenStore = typeof globalThis & {
  __darkCloudKitchenStore?: KitchenState;
};

const globalStore = globalThis as GlobalKitchenStore;

if (!globalStore.__darkCloudKitchenStore) {
  globalStore.__darkCloudKitchenStore = {
    orders: [],
    inventory: INVENTORY_DB.map((item) => ({
      ...item,
    })),
  };
}

export const kitchenStore =
  globalStore.__darkCloudKitchenStore;

/**
 * Returns the current orders.
 *
 * The returned array is the current in-memory collection.
 * API/service code should prefer repository functions instead
 * of mutating this array directly.
 */
export function getOrders(): Order[] {
  return kitchenStore.orders;
}

/**
 * Returns the current inventory.
 */
export function getInventory(): InventoryItem[] {
  return kitchenStore.inventory;
}

/**
 * Returns a detached snapshot of the current state.
 *
 * Useful for calculations where callers should not accidentally
 * mutate the live store while evaluating a change.
 */
export function getStoreSnapshot(): StoreSnapshot {
  return {
    orders: kitchenStore.orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
      })),
      events: order.events.map((event) => ({
        ...event,
      })),
      inventoryWarnings: order.inventoryWarnings
        ? [...order.inventoryWarnings]
        : undefined,
      inventoryUnavailable: order.inventoryUnavailable
        ? [...order.inventoryUnavailable]
        : undefined,
    })),
    inventory: kitchenStore.inventory.map((item) => ({
      ...item,
    })),
  };
}

/**
 * Adds a new order to the store.
 *
 * Newest orders are placed first so operational screens
 * can consume the collection directly.
 */
export function addOrder(order: Order): void {
  kitchenStore.orders.unshift(order);
}

/**
 * Replaces the complete order collection.
 *
 * Kept behind the repository boundary for future database
 * implementations.
 */
export function replaceOrders(orders: Order[]): void {
  kitchenStore.orders = orders;
}

/**
 * Replaces the complete inventory collection.
 */
export function replaceInventory(
  inventory: InventoryItem[]
): void {
  kitchenStore.inventory = inventory;
}

/**
 * Finds one order by its canonical internal ID.
 */
export function findOrder(
  orderId: string
): Order | undefined {
  return kitchenStore.orders.find(
    (order) => order.id === orderId
  );
}

/**
 * Updates an existing order.
 *
 * The store owns updatedAt so individual callers do not
 * need to remember to maintain it.
 */
export function updateOrder(
  orderId: string,
  updates: Partial<Order>
): Order | undefined {
  const order = findOrder(orderId);

  if (!order) {
    return undefined;
  }

  Object.assign(order, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  return order;
}

/**
 * Atomically applies an in-memory state mutation.
 *
 * This is not a database transaction. It is an MVP transaction
 * boundary that keeps order and inventory changes together.
 *
 * The important architectural point is that callers do not need
 * to know how persistence works underneath.
 *
 * A future database implementation can replace this function
 * with a real database transaction.
 */
export function transaction<T>(
  operation: (
    state: KitchenState
  ) => T
): T {
  return operation(kitchenStore);
}

/**
 * Replaces the entire state in one repository operation.
 *
 * Useful for workflows that calculate a new inventory state
 * and corresponding order state before committing them.
 */
export function replaceState(
  nextState: KitchenState
): void {
  kitchenStore.orders = nextState.orders;
  kitchenStore.inventory = nextState.inventory;
}

/**
 * Resets the MVP store.
 *
 * Intended for controlled development/testing only.
 *
 * Production persistence should never expose a reset operation
 * through a public API.
 */
export function resetStore(): void {
  kitchenStore.orders = [];

  kitchenStore.inventory = INVENTORY_DB.map(
    (item) => ({
      ...item,
    })
  );
}
