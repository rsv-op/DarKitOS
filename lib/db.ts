
// lib/db.ts
// Dark-Cloud Kitchen OS: Zero-Cost Native IndexedDB Engine

const DB_NAME = 'DarkCloudKitchenOS';
const DB_VERSION = 1;

// Internal helper to initialize the database
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // SSR/Vercel Edge Guard: Prevent server crashes during build
    if (typeof window === 'undefined') {
      return reject(new Error('IndexedDB is not supported on the server'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Schema: Orders (Unified Dispatch Pipeline)
      if (!db.objectStoreNames.contains('orders')) {
        db.createObjectStore('orders', { keyPath: 'id' });
      }
      
      // Schema: Inventory (Algorithmic Depletion Matrix)
      if (!db.objectStoreNames.contains('inventory')) {
        db.createObjectStore('inventory', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const getOrders = async (): Promise<any[]> => {
  if (typeof window === 'undefined') return []; // Safe SSR fallback
  
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

export const getInventory = async (): Promise<any[]> => {
  if (typeof window === 'undefined') return []; // Safe SSR fallback
  
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

export const addOrder = async (order: any): Promise<void> => {
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

// Supplementary export for the Dispatch Pipeline to update order status
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
