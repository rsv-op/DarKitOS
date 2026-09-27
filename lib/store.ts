import type { InventoryItem, Order } from "@/lib/db";
import { INVENTORY_DB } from "@/lib/db";

type KitchenState = {
  orders: Order[];
  inventory: InventoryItem[];
};

const globalStore = globalThis as typeof globalThis & {
  __darkCloudKitchenStore?: KitchenState;
};

if (!globalStore.__darkCloudKitchenStore) {
  globalStore.__darkCloudKitchenStore = {
    orders: [],
    inventory: INVENTORY_DB.map((item) => ({ ...item })),
  };
}

export const kitchenStore = globalStore.__darkCloudKitchenStore;

export function getOrders(): Order[] {
  return kitchenStore.orders;
}

export function getInventory(): InventoryItem[] {
  return kitchenStore.inventory;
}

export function addOrder(order: Order): void {
  kitchenStore.orders.unshift(order);
}

export function replaceInventory(inventory: InventoryItem[]): void {
  kitchenStore.inventory = inventory;
}

export function findOrder(orderId: string): Order | undefined {
  return kitchenStore.orders.find((order) => order.id === orderId);
}

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
