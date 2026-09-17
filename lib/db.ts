// File: lib/db.ts

/**
 * Dark/Cloud Kitchen OS - Zero-Cost Local Operational Ledger
 * Architecture: Native Browser IndexedDB (Zero Dependency)
 * Role: Provides robust, offline-capable, zero-latency state management for 
 *       multi-brand orders, inventory depletion, and wastage tracking.
 */

const DB_NAME = 'CloudKitchenOS_Matrix';
const DB_VERSION = 1;

// ─────────────────────────────────────────────────────────────────
// SCHEMA DEFINITIONS
// ─────────────────────────────────────────────────────────────────

export type OrderStatus = 'RECEIVED' | 'PREPPING' | 'READY' | 'DISPATCHED';

export interface OrderItem {
  name: string;
  quantity: number;
  // Algorithmic depletion mapping: which inventory IDs to deduct and by how much per unit
  depletionMap?: { inventoryId: string; amount: number }[];
}

export interface Order {
  id: string;
  brandId: string;
  brandName: string;
  items: OrderItem[];
  status: OrderStatus;
  totalValue: number;
  timestamp: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  currentStock: number;
  unit: 'kg' | 'liters' | 'units' | 'grams';
  reorderThreshold: number;
  lastUpdated: number;
}

export interface Brand {
  id: string;
  name: string;
  themeColor: string;
}

// ─────────────────────────────────────────────────────────────────
// CORE INDEXED DB ENGINE
// ─────────────────────────────────────────────────────────────────

class KitchenDBEngine {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Store 1: The Unified Order Queue
        if (!db.objectStoreNames.contains('orders')) {
          const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
          orderStore.createIndex('status', 'status', { unique: false });
          orderStore.createIndex('brandId', 'brandId', { unique: false });
          orderStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store 2: The Depletion Matrix (Inventory)
        if (!db.objectStoreNames.contains('inventory')) {
          const invStore = db.createObjectStore('inventory', { keyPath: 'id' });
          invStore.createIndex('name', 'name', { unique: false });
        }

        // Store 3: Multi-Brand Matrix
        if (!db.objectStoreNames.contains('brands')) {
          db.createObjectStore('brands', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // ── Generic Operations ──────────────────────────────────────────

  private async executeTransaction<T>(
    storeName: string, 
    mode: IDBTransactionMode, 
    operation: (store: IDBObjectStore) => IDBRequest
  ): Promise<T> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  }

  // ── Orders API ──────────────────────────────────────────────────

  async addOrder(order: Order): Promise<void> {
    await this.executeTransaction('orders', 'readwrite', (store) => store.put(order));
  }

  async getActiveOrders(): Promise<Order[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('orders', 'readonly');
      const store = transaction.objectStore('orders');
      const request = store.getAll();

      request.onsuccess = () => {
        const allOrders = request.result as Order[];
        // Filter out dispatched orders for the active queue
        const active = allOrders
          .filter(o => o.status !== 'DISPATCHED')
          .sort((a, b) => b.timestamp - a.timestamp);
        resolve(active);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateOrderStatus(orderId: string, newStatus: OrderStatus): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('orders', 'readwrite');
      const store = transaction.objectStore('orders');
      const getRequest = store.get(orderId);

      getRequest.onsuccess = () => {
        const order = getRequest.result as Order;
        if (order) {
          order.status = newStatus;
          store.put(order).onsuccess = () => resolve();
        } else {
          reject(new Error('Order not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // ── Inventory API ───────────────────────────────────────────────

  async initDefaultInventory(): Promise<void> {
    const existing = await this.executeTransaction<InventoryItem[]>('inventory', 'readonly', (store) => store.getAll());
    if (existing.length > 0) return;

    // Seed data for the prototype
    const seed: InventoryItem[] = [
      { id: 'inv_1', name: 'Premium Basmati Rice', currentStock: 50, unit: 'kg', reorderThreshold: 15, lastUpdated: Date.now() },
      { id: 'inv_2', name: 'Tomato Base Puree', currentStock: 20, unit: 'liters', reorderThreshold: 5, lastUpdated: Date.now() },
      { id: 'inv_3', name: 'Custom Burger Buns', currentStock: 200, unit: 'units', reorderThreshold: 50, lastUpdated: Date.now() },
      { id: 'inv_4', name: 'Raw Chicken Breast', currentStock: 35, unit: 'kg', reorderThreshold: 10, lastUpdated: Date.now() }
    ];

    const db = await this.getDB();
    const transaction = db.transaction('inventory', 'readwrite');
    const store = transaction.objectStore('inventory');
    seed.forEach(item => store.put(item));
  }

  async getInventory(): Promise<InventoryItem[]> {
    return this.executeTransaction<InventoryItem[]>('inventory', 'readonly', (store) => store.getAll());
  }

  async deductInventory(inventoryId: string, amount: number): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('inventory', 'readwrite');
      const store = transaction.objectStore('inventory');
      const getReq = store.get(inventoryId);

      getReq.onsuccess = () => {
        const item = getReq.result as InventoryItem;
        if (item) {
          item.currentStock = Math.max(0, item.currentStock - amount);
          item.lastUpdated = Date.now();
          store.put(item).onsuccess = () => resolve();
        } else {
          resolve(); // Ignore if mapping doesn't exist
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }
}

// Export a singleton instance for global client-side use
export const kitchenDB = new KitchenDBEngine();
