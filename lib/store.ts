import type {
  InventoryItem,
  Order,
} from "@/lib/db";

import { INVENTORY_DB } from "@/lib/db";

export interface KitchenState {
  orders: Order[];
  inventory: InventoryItem[];
}

export interface StoreSnapshot {
  orders: Order[];
  inventory: InventoryItem[];
}

const globalState: KitchenState = {
  orders: [],
  inventory: INVENTORY_DB,
};

function cloneOrder(order: Order): Order {
  return {
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
    orders: state.orders.map(cloneOrder),
    inventory: state.inventory.map(
      cloneInventoryItem
    ),
  };
}

export function getOrders(): Order[] {
  return globalState.orders.map(cloneOrder);
}

export function getInventory(): InventoryItem[] {
  return globalState.inventory.map(
    cloneInventoryItem
  );
}

export function getStoreSnapshot(): StoreSnapshot {
  const snapshot = cloneState(globalState);

  return {
    orders: snapshot.orders,
    inventory: snapshot.inventory,
  };
}

export function addOrder(order: Order): Order {
  const storedOrder = cloneOrder(order);

  globalState.orders.push(storedOrder);

  return cloneOrder(storedOrder);
}

export function replaceOrders(
  orders: Order[]
): void {
  globalState.orders = orders.map(cloneOrder);
}

export function replaceInventory(
  inventory: InventoryItem[]
): void {
  globalState.inventory =
    inventory.map(cloneInventoryItem);
}

export function findOrder(
  orderId: string
): Order | undefined {
  const order = globalState.orders.find(
    (item) => item.id === orderId
  );

  return order
    ? cloneOrder(order)
    : undefined;
}

export function updateOrder(
  orderId: string,
  updater: (order: Order) => Order
): Order {
  const index = globalState.orders.findIndex(
    (order) => order.id === orderId
  );

  if (index === -1) {
    throw new Error(
      `Order not found: ${orderId}`
    );
  }

  const currentOrder =
    cloneOrder(globalState.orders[index]);

  const updatedOrder =
    updater(currentOrder);

  globalState.orders[index] =
    cloneOrder(updatedOrder);

  return cloneOrder(updatedOrder);
}

export function updateInventory(
  updater: (
    inventory: InventoryItem[]
  ) => InventoryItem[]
): InventoryItem[] {
  const currentInventory =
    getInventory();

  const updatedInventory =
    updater(currentInventory);

  replaceInventory(updatedInventory);

  return getInventory();
}

export function transaction<T>(
  callback: (
    state: KitchenState
  ) => T
): T {
  const backup =
    cloneState(globalState);

  try {
    return callback(globalState);
  } catch (error) {
    globalState.orders =
      backup.orders;
    globalState.inventory =
      backup.inventory;

    throw error;
  }
}

export function replaceState(
  state: KitchenState
): void {
  const clonedState =
    cloneState(state);

  globalState.orders =
    clonedState.orders;

  globalState.inventory =
    clonedState.inventory;
}

export function resetStore(): void {
  globalState.orders = [];
  globalState.inventory =
    INVENTORY_DB.map(
      cloneInventoryItem
    );
}
