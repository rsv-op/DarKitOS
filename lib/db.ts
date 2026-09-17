
// lib/db.ts
// Dark-Cloud Kitchen OS: Zero-Cost Native IndexedDB Engine (Universal Adapter)

const DB_NAME = 'DarkCloudKitchenOS';
const DB_VERSION = 1;

// --- TYPE DEFINITIONS ---
export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  brand: string;
  items: OrderItem[];
  total: number;
  status: 'PENDING' | 'PREPPING' | 'COMPLETED' | 'CANCELLED' | string;
  timestamp: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  currentStock: number;
  threshold: number;
  unit: string;
}

// --- CORE ENGINE ---
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // SSR/Vercel Edge Guard: Prevent server crashes during static generation
    if (typeof window === 'undefined') {
      return reject(new Error('IndexedDB is not supported on the server'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('orders')) {
        db.createObjectStore('orders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('inventory')) {
        db.createObjectStore('inventory', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
};

// --- STANDALONE EXPORTS (For app/page.tsx) ---
export const getOrders = async (): Promise<Order[]> => {
  if (typeof window === 'undefined') return [];
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('orders', 'readonly');
      const store = transaction.objectStore('orders');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get orders:', error);
    return [];
  }
};

export const getInventory = async (): Promise<InventoryItem[]> => {
  if (typeof window === 'undefined') return [];
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('inventory', 'readonly');
      const store = transaction.objectStore('inventory');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get inventory:', error);
    return [];
  }
};

export const addOrder = async (order: Order): Promise<void> => {
  if (typeof window === 'undefined') return;
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('orders', 'readwrite');
      const store = transaction.objectStore('orders');
      const request = store.put(order);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to add order:', error);
  }
};

export const updateOrderStatus = async (id: string, status: string): Promise<void> => {
  if (typeof window === 'undefined') return;
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('orders', 'readwrite');
      const store = transaction.objectStore('orders');
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const data = getReq.result;
        if (data) {
          data.status = status;
          store.put(data);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch (error) {
    console.error('Failed to update order:', error);
  }
};

export const updateInventoryItem = async (item: InventoryItem): Promise<void> => {
  if (typeof window === 'undefined') return;
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('inventory', 'readwrite');
      const store = transaction.objectStore('inventory');
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to update inventory:', error);
  }
};

// --- NAMESPACE EXPORT (For app/inventory & app/orders) ---
// We map both flat functions and nested objects to guarantee compatibility 
// with however the legacy pages invoke the DB methods.
export const kitchenDB = {
  getOrders,
  getInventory,
  addOrder,
  updateOrderStatus,
  updateInventoryItem,
  orders: {
    getAll: getOrders,
    add: addOrder,
    updateStatus: updateOrderStatus
  },
  inventory: {
    getAll: getInventory,
    update: updateInventoryItem
  }
};
