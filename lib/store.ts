import type {
  InventoryItem,
  Order,
} from "@/lib/db";

import {
  INVENTORY_DB,
} from "@/lib/db";

/**
 * Storage boundary for Dark Cloud Kitchen OS.
 *
 * MVP implementation is intentionally in-memory.
 *
 * Application code must use this repository boundary rather
 * than directly manipulating the underlying state.
 *
 * The implementation can later be replaced with a relational
 * persistence provider without changing Cook, Dispatch, Owner,
 * or API consumers.
 */

export type KitchenState = {
  orders: Order[];
  inventory: InventoryItem[];
};

export type StoreSnapshot = {
  orders: Order[];
  inventory: InventoryItem[];
};

type GlobalKitchenStore =
  typeof globalThis & {
    __darkCloudKitchenStore?: KitchenState;
  };

const globalStore =
  globalThis as GlobalKitchenStore;

function cloneOrder(
  order: Order
): Order {
  return {
    ...order,

    items: order.items.map(
      (item) => ({
        ...item,
      })
    ),

    events: order.events.map(
      (event) => ({
        ...event,
      })
    ),

    inventoryWarnings:
      order.inventoryWarnings
        ? [
            ...order.inventoryWarnings,
          ]
        : undefined,

    inventoryUnavailable:
      order.inventoryUnavailable
        ? [
            ...order.inventoryUnavailable,
          ]
        : undefined,
  };
}

function cloneInventoryItem(
  item: InventoryItem
): InventoryItem {
  return {
    ...item,
  };
}

function cloneState(
  state: KitchenState
): KitchenState {
  return {
    orders: state.orders.map(
      cloneOrder
    ),

    inventory:
      state.inventory.map(
        cloneInventoryItem
      ),
  };
}

if (
  !globalStore.__darkCloudKitchenStore
) {
  globalStore.__darkCloudKitchenStore =
    {
      orders: [],

      inventory:
        INVENTORY_DB.map(
          cloneInventoryItem
        ),
    };
}

export const kitchenStore =
  globalStore.__darkCloudKitchenStore;

/**
 * Returns the current orders.
 *
 * A detached collection is returned so callers cannot
 * accidentally mutate repository state without going
 * through a repository operation.
 */
export function getOrders(): Order[] {
  return kitchenStore.orders.map(
    cloneOrder
  );
}

/**
 * Returns the current inventory.
 *
 * A detached collection is returned so callers cannot
 * accidentally mutate repository state without going
 * through a repository operation.
 */
export function getInventory(): InventoryItem[] {
  return kitchenStore.inventory.map(
    cloneInventoryItem
  );
}

/**
 * Returns a detached snapshot of the complete state.
 */
export function getStoreSnapshot(): StoreSnapshot {
  return cloneState(
    kitchenStore
  );
}

/**
 * Adds a new order to the store.
 *
 * Newest orders are placed first so operational screens
 * can consume the collection directly.
 */
export function addOrder(
  order: Order
): void {
  kitchenStore.orders.unshift(
    cloneOrder(order)
  );
}

/**
 * Replaces the complete order collection.
 */
export function replaceOrders(
  orders: Order[]
): void {
  kitchenStore.orders =
    orders.map(cloneOrder);
}

/**
 * Replaces the complete inventory collection.
 */
export function replaceInventory(
  inventory: InventoryItem[]
): void {
  kitchenStore.inventory =
    inventory.map(
      cloneInventoryItem
    );
}

/**
 * Finds one order by canonical internal ID.
 *
 * Returns a detached order so the caller cannot mutate
 * repository state directly.
 */
export function findOrder(
  orderId: string
): Order | undefined {
  const order =
    kitchenStore.orders.find(
      (candidate) =>
        candidate.id === orderId
    );

  return order
    ? cloneOrder(order)
    : undefined;
}

/**
 * Updates an existing order.
 *
 * The repository owns updatedAt so callers do not need
 * to maintain it independently.
 */
export function updateOrder(
  orderId: string,
  updates: Partial<Order>
): Order | undefined {
  const index =
    kitchenStore.orders.findIndex(
      (order) =>
        order.id === orderId
    );

  if (index === -1) {
    return undefined;
  }

  const existing =
    kitchenStore.orders[index];

  const updated: Order = {
    ...existing,

    ...updates,

    items: updates.items
      ? updates.items.map(
          (item) => ({
            ...item,
          })
        )
      : existing.items.map(
          (item) => ({
            ...item,
          })
        ),

    events: updates.events
      ? updates.events.map(
          (event) => ({
            ...event,
          })
        )
      : existing.events.map(
          (event) => ({
            ...event,
          })
        ),

    inventoryWarnings:
      updates.inventoryWarnings !==
      undefined
        ? [
            ...updates.inventoryWarnings,
          ]
        : existing.inventoryWarnings
          ? [
              ...existing.inventoryWarnings,
            ]
          : undefined,

    inventoryUnavailable:
      updates.inventoryUnavailable !==
      undefined
        ? [
            ...updates.inventoryUnavailable,
          ]
        : existing.inventoryUnavailable
          ? [
              ...existing.inventoryUnavailable,
            ]
          : undefined,

    updatedAt:
      new Date().toISOString(),
  };

  kitchenStore.orders[index] =
    cloneOrder(updated);

  return cloneOrder(updated);
}

/**
 * Applies an operation against the live repository state.
 *
 * A detached snapshot is captured first.
 *
 * If the operation throws, the repository is restored to
 * the previous state. This provides rollback semantics for
 * the MVP in-memory implementation.
 *
 * This is not a database transaction.
 * A future persistent implementation can replace this
 * function with a real database transaction while preserving
 * the application-facing repository boundary.
 */
export function transaction<T>(
  operation: (
    state: KitchenState
  ) => T
): T {
  const previousState =
    cloneState(
      kitchenStore
    );

  try {
    return operation(
      kitchenStore
    );
  } catch (error) {
    kitchenStore.orders =
      previousState.orders;

    kitchenStore.inventory =
      previousState.inventory;

    throw error;
  }
}

/**
 * Replaces the complete repository state.
 *
 * Input is cloned before becoming live state so external
 * references cannot mutate the store.
 */
export function replaceState(
  nextState: KitchenState
): void {
  const clonedState =
    cloneState(
      nextState
    );

  kitchenStore.orders =
    clonedState.orders;

  kitchenStore.inventory =
    clonedState.inventory;
}

/**
 * Resets the MVP store.
 *
 * Intended for controlled development/testing only.
 *
 * Production persistence should never expose a reset
 * operation through a public API.
 */
export function resetStore(): void {
  kitchenStore.orders = [];

  kitchenStore.inventory =
    INVENTORY_DB.map(
      cloneInventoryItem
    );
}
