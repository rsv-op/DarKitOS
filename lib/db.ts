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

export interface StationAuthPin {
  pin: string;
  role: StationRole;
  stationName: string;
}

// ─────────────────────────────────────────────────────────────────
// INITIAL SEED DATA
// ─────────────────────────────────────────────────────────────────

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
  // BurgerForge
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
  // TacoMatrix
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
  // WingProtocol
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
  // GreenBowl
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

// ─────────────────────────────────────────────────────────────────
// ALGORITHMIC DEPLETION & INVENTORY ENGINE
// ─────────────────────────────────────────────────────────────────

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
