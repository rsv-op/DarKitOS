export type DbaBrand =
  | "BurgerForge"
  | "TacoMatrix"
  | "WingProtocol"
  | "GreenBowl";

export type OrderChannel =
  | "Swiggy"
  | "Zomato"
  | "DoorDash"
  | "UberEats"
  | "GrubHub"
  | "Direct Web";

export type OrderSource =
  | "MANUAL"
  | "SWIGGY"
  | "ZOMATO"
  | "DOORDASH"
  | "UBEREATS"
  | "GRUBHUB"
  | "DIRECT_WEB";

export type StationRole = "cook" | "dispatch" | "owner";

export type OrderStatus =
  | "PENDING"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "DISPATCHED"
  | "CANCELLED";

export type KitchenStation =
  | "Grill"
  | "Fryer"
  | "Assembly"
  | "Cold Prep";

export type InventoryDecision =
  | "AVAILABLE"
  | "LOW_STOCK"
  | "INSUFFICIENT_STOCK";

export type CancellationSource =
  | "CUSTOMER"
  | "AGGREGATOR"
  | "KITCHEN"
  | "KITCHEN_OS"
  | "DELIVERY_PARTNER"
  | "SYSTEM"
  | "UNKNOWN";

export type OrderEventType =
  | "RECEIVED"
  | "INVENTORY_CHECKED"
  | "ACCEPTED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "DRIVER_ASSIGNED"
  | "PICKED_UP"
  | "DISPATCHED"
  | "CANCELLED"
  | "INVENTORY_WARNING"
  | "INVENTORY_UNAVAILABLE";

export interface KitchenConfig {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

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
  category:
    | "Protein"
    | "Produce"
    | "Dairy"
    | "Packaging"
    | "Sauce"
    | "Dry Good";
  currentStock: number;
  unit: "oz" | "lbs" | "units" | "count";
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

export interface InventoryDecisionResult {
  decision: InventoryDecision;
  lowStockItems: string[];
  insufficientStockItems: string[];
}

export interface OrderEvent {
  id: string;
  orderId: string;
  type: OrderEventType;
  timestamp: string;
  source: OrderSource;
  actor?: StationRole | "CUSTOMER" | "DELIVERY_PARTNER" | "SYSTEM";
  metadata?: Record<string, string | number | boolean | null>;
}

export interface Order {
  id: string;

  /**
   * External identifier supplied by Swiggy/Zomato/etc.
   * Manual orders normally do not have one.
   */
  externalOrderId?: string;

  brandId: DbaBrand;

  /**
   * MVP currently uses K1 for all orders.
   * The field exists now so multi-kitchen routing can be added later.
   */
  kitchenId: string;

  channel: OrderChannel;
  source: OrderSource;

  status: OrderStatus;

  items: OrderItem[];

  customerName?: string;
  driverName?: string;
  courierEtaMins?: number;

  createdAt: string;
  updatedAt: string;

  receivedAt?: string;
  acceptedAt?: string;

  prepStartedAt?: string;
  prepCompletedAt?: string;

  readyAt?: string;

  driverAssignedAt?: string;
  pickedUpAt?: string;
  dispatchedAt?: string;

  cancelledAt?: string;
  cancelledBy?: string;
  cancellationSource?: CancellationSource;
  cancellationReason?: string;

  inventoryDecision?: InventoryDecision;
  inventoryWarnings?: string[];
  inventoryUnavailableItems?: string[];

  events?: OrderEvent[];
}

export const KITCHENS_DB: KitchenConfig[] = [
  {
    id: "K1",
    name: "Kitchen 1",
    code: "K1",
    active: true,
  },
];

export const BRANDS_DB: BrandConfig[] = [
  {
    id: "BurgerForge",
    name: "BurgerForge",
    code: "BF",
    active: true,
    colorTheme: "amber",
  },
  {
    id: "TacoMatrix",
    name: "TacoMatrix",
    code: "TM",
    active: true,
    colorTheme: "emerald",
  },
  {
    id: "WingProtocol",
    name: "WingProtocol",
    code: "WP",
    active: true,
    colorTheme: "red",
  },
  {
    id: "GreenBowl",
    name: "GreenBowl",
    code: "GB",
    active: true,
    colorTheme: "cyan",
  },
];

export const INVENTORY_DB: InventoryItem[] = [
  {
    id: "INV-001",
    sku: "BF-BEEF-001",
    name: "Angus Beef Patties",
    category: "Protein",
    currentStock: 140,
    unit: "units",
    reorderThreshold: 30,
    costPerUnit: 1.2,
    lastRestocked: "2026-09-25T10:00:00.000Z",
  },
  {
    id: "INV-002",
    sku: "BF-BUN-001",
    name: "Brioche Buns",
    category: "Dry Good",
    currentStock: 18,
    unit: "units",
    reorderThreshold: 25,
    costPerUnit: 0.4,
    lastRestocked: "2026-09-25T10:00:00.000Z",
  },
  {
    id: "INV-003",
    sku: "TM-BEEF-001",
    name: "Slow-Cooked Birria Beef",
    category: "Protein",
    currentStock: 45,
    unit: "lbs",
    reorderThreshold: 10,
    costPerUnit: 4.5,
    lastRestocked: "2026-09-25T10:00:00.000Z",
  },
  {
    id: "INV-004",
    sku: "TM-TORT-001",
    name: "Corn Tortillas",
    category: "Dry Good",
    currentStock: 220,
    unit: "units",
    reorderThreshold: 50,
    costPerUnit: 0.1,
    lastRestocked: "2026-09-25T10:00:00.000Z",
  },
  {
    id: "INV-005",
    sku: "WP-WING-001",
    name: "Jumbo Chicken Wings",
    category: "Protein",
    currentStock: 350,
    unit: "units",
    reorderThreshold: 100,
    costPerUnit: 0.55,
    lastRestocked: "2026-09-25T10:00:00.000Z",
  },
  {
    id: "INV-006",
    sku: "WP-SAUCE-001",
    name: "Ghost Pepper Glaze",
    category: "Sauce",
    currentStock: 12,
    unit: "oz",
    reorderThreshold: 20,
    costPerUnit: 0.85,
    lastRestocked: "2026-09-25T10:00:00.000Z",
  },
  {
    id: "INV-007",
    sku: "GB-TUNA-001",
    name: "Sashimi Grade Ahi Tuna",
    category: "Protein",
    currentStock: 28,
    unit: "lbs",
    reorderThreshold: 8,
    costPerUnit: 12,
    lastRestocked: "2026-09-25T10:00:00.000Z",
  },
  {
    id: "INV-008",
    sku: "GB-AVO-001",
    name: "Hass Avocados",
    category: "Produce",
    currentStock: 65,
    unit: "units",
    reorderThreshold: 15,
    costPerUnit: 0.9,
    lastRestocked: "2026-09-25T10:00:00.000Z",
  },
];

/**
 * Backward-compatible alias for older code.
 * New code should use INVENTORY_DB.
 */
export const INITIAL_INVENTORY = INVENTORY_DB;

export const MENU_CATALOG: MenuItem[] = [
  {
    id: "MENU-BF-01",
    brandId: "BurgerForge",
    name: "Double Smash Burger",
    price: 12.99,
    station: "Grill",
    recipe: [
      {
        inventoryItemId: "INV-001",
        quantityRequired: 2,
      },
      {
        inventoryItemId: "INV-002",
        quantityRequired: 1,
      },
    ],
  },
  {
    id: "MENU-BF-02",
    brandId: "BurgerForge",
    name: "Truffle Fries",
    price: 6.49,
    station: "Fryer",
    recipe: [],
  },
  {
    id: "MENU-TM-01",
    brandId: "TacoMatrix",
    name: "Birria Taco Trio",
    price: 14.5,
    station: "Assembly",
    recipe: [
      {
        inventoryItemId: "INV-003",
        quantityRequired: 0.5,
      },
      {
        inventoryItemId: "INV-004",
        quantityRequired: 3,
      },
    ],
  },
  {
    id: "MENU-WP-01",
    brandId: "WingProtocol",
    name: "12pc Ghost Pepper Wings",
    price: 16.99,
    station: "Fryer",
    recipe: [
      {
        inventoryItemId: "INV-005",
        quantityRequired: 12,
      },
      {
        inventoryItemId: "INV-006",
        quantityRequired: 4,
      },
    ],
  },
  {
    id: "MENU-GB-01",
    brandId: "GreenBowl",
    name: "Ahi Tuna Poke Bowl",
    price: 17.25,
    station: "Cold Prep",
    recipe: [
      {
        inventoryItemId: "INV-007",
        quantityRequired: 0.4,
      },
      {
        inventoryItemId: "INV-008",
        quantityRequired: 1,
      },
    ],
  },
];

function getOrderRequirements(
  order: Order,
  inventory: InventoryItem[],
): {
  itemId: string;
  itemName: string;
  required: number;
  available: number;
  threshold: number;
}[] {
  const requirements = new Map<string, number>();

  for (const orderItem of order.items) {
    const menuItem = MENU_CATALOG.find(
      (item) =>
        item.id === orderItem.menuItemId ||
        item.name === orderItem.name,
    );

    if (!menuItem) {
      continue;
    }

    for (const ingredient of menuItem.recipe) {
      const required =
        ingredient.quantityRequired * orderItem.quantity;

      requirements.set(
        ingredient.inventoryItemId,
        (requirements.get(ingredient.inventoryItemId) ?? 0) + required,
      );
    }
  }

  return [...requirements.entries()]
    .map(([itemId, required]) => {
      const inventoryItem = inventory.find((item) => item.id === itemId);

      if (!inventoryItem) {
        return {
          itemId,
          itemName: itemId,
          required,
          available: 0,
          threshold: 0,
        };
      }

      return {
        itemId,
        itemName: inventoryItem.name,
        required,
        available: inventoryItem.currentStock,
        threshold: inventoryItem.reorderThreshold,
      };
    });
}

export function evaluateOrderInventory(
  order: Order,
  inventory: InventoryItem[],
): InventoryDecisionResult {
  const requirements = getOrderRequirements(order, inventory);

  const insufficientStockItems = requirements
    .filter((item) => item.available < item.required)
    .map((item) => item.itemName);

  if (insufficientStockItems.length > 0) {
    return {
      decision: "INSUFFICIENT_STOCK",
      lowStockItems: [],
      insufficientStockItems,
    };
  }

  const lowStockItems = requirements
    .filter(
      (item) =>
        item.available - item.required <= item.threshold,
    )
    .map((item) => item.itemName);

  return {
    decision:
      lowStockItems.length > 0
        ? "LOW_STOCK"
        : "AVAILABLE",
    lowStockItems,
    insufficientStockItems: [],
  };
}

export function processOrderDepletion(
  order: Order,
  inventory: InventoryItem[],
): {
  updatedInventory: InventoryItem[];
  depletedItems: string[];
  lowStockAlerts: string[];
  inventoryDecision: InventoryDecision;
  insufficientStockItems: string[];
} {
  const evaluation = evaluateOrderInventory(order, inventory);

  if (evaluation.decision === "INSUFFICIENT_STOCK") {
    return {
      updatedInventory: inventory.map((item) => ({ ...item })),
      depletedItems: [],
      lowStockAlerts: [],
      inventoryDecision: evaluation.decision,
      insufficientStockItems: evaluation.insufficientStockItems,
    };
  }

  const updatedInventory = inventory.map((item) => ({
    ...item,
  }));

  const depletedItems: string[] = [];

  for (const orderItem of order.items) {
    const menuItem = MENU_CATALOG.find(
      (item) =>
        item.id === orderItem.menuItemId ||
        item.name === orderItem.name,
    );

    if (!menuItem) {
      continue;
    }

    for (const ingredient of menuItem.recipe) {
      const inventoryItem = updatedInventory.find(
        (item) => item.id === ingredient.inventoryItemId,
      );

      if (!inventoryItem) {
        continue;
      }

      const depletion =
        ingredient.quantityRequired * orderItem.quantity;

      inventoryItem.currentStock = Math.max(
        0,
        inventoryItem.currentStock - depletion,
      );

      depletedItems.push(inventoryItem.name);
    }
  }

  const lowStockAlerts = updatedInventory
    .filter((item) => item.currentStock <= item.reorderThreshold)
    .map((item) => item.name);

  return {
    updatedInventory,
    depletedItems: [...new Set(depletedItems)],
    lowStockAlerts,
    inventoryDecision: evaluation.decision,
    insufficientStockItems: [],
  };
}
