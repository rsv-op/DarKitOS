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

export type EmployeeRole =
  | "OWNER"
  | "MANAGER"
  | "LINE_COOK"
  | "DISPATCH";

export type PermissionCode =
  | "OWNER_VIEW"
  | "KITCHEN_OPERATE"
  | "COOK_ORDERS"
  | "DISPATCH_ORDERS"
  | "INVENTORY_VIEW"
  | "INVENTORY_MANAGE"
  | "ORDER_CANCEL"
  | "STAFF_MANAGE";

export type OrderStatus =
  | "PENDING"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "DRIVER_ASSIGNED"
  | "PICKED_UP"
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
  | "KITCHEN"
  | "AGGREGATOR"
  | "SYSTEM"
  | "MANUAL";

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

export interface BrandConfig {
  id: DbaBrand;
  name: string;
  code: string;
  active: boolean;
  colorTheme: string;
}

export interface KitchenConfig {
  id: string;
  name: string;
  code: string;
  location?: string;
  areaCode?: string;
  active: boolean;
  timezone: string;
}

export interface BrandKitchenConfig {
  brandId: DbaBrand;
  kitchenId: string;
  active: boolean;
}

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  role: EmployeeRole;
  kitchenId?: string;
  active: boolean;
}

export interface Permission {
  id: string;
  code: PermissionCode;
  description: string;
}

export interface RolePermission {
  role: EmployeeRole;
  permissionId: string;
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

export interface OrderEvent {
  id: string;
  type: OrderEventType;
  timestamp: string;
  actor: string;
  details?: string;
}

export interface Order {
  id: string;
  externalOrderId?: string;

  brandId: DbaBrand;
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

  cancellationSource?: CancellationSource;
  cancellationReason?: string;
  cancelledBy?: string;

  inventoryDecision?: InventoryDecision;
  inventoryWarnings?: string[];
  inventoryUnavailable?: string[];

  events: OrderEvent[];
}

export interface InventoryEvaluation {
  inventoryDecision: InventoryDecision;
  lowStockItems: string[];
  insufficientStockItems: string[];
}

export interface OrderDepletionResult {
  updatedInventory: InventoryItem[];
  depletedItems: string[];
  lowStockAlerts: string[];
  inventoryDecision: InventoryDecision;
  insufficientStockItems: string[];
}

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

export const KITCHENS_DB: KitchenConfig[] = [
  {
    id: "K1",
    name: "Gurugram Central Hub",
    code: "GGN-01",
    location: "Sector 29, Gurugram",
    areaCode: "GGN-01",
    active: true,
    timezone: "Asia/Kolkata",
  },
  {
    id: "K2",
    name: "Noida Sector 62 Cloud Unit B",
    code: "NDA-02",
    location: "Sector 62, Noida",
    areaCode: "NDA-02",
    active: true,
    timezone: "Asia/Kolkata",
  },
  {
    id: "K3",
    name: "South Delhi Dark Kitchen",
    code: "DEL-03",
    location: "Greater Kailash, New Delhi",
    areaCode: "DEL-03",
    active: true,
    timezone: "Asia/Kolkata",
  },
  {
    id: "K4",
    name: "Cyber City Express Hatch",
    code: "CYB-04",
    location: "DLF Phase 3, Gurugram",
    areaCode: "CYB-04",
    active: true,
    timezone: "Asia/Kolkata",
  },
];

export const BRAND_KITCHENS_DB: BrandKitchenConfig[] =
  BRANDS_DB.map((brand) => ({
    brandId: brand.id,
    kitchenId: "K1",
    active: true,
  }));

export const EMPLOYEES_DB: Employee[] = [
  {
    id: "EMP-OWNER-01",
    employeeCode: "OWNER-01",
    name: "Patric Revuelto",
    role: "OWNER",
    active: true,
  },
  {
    id: "EMP-K1-MGR-01",
    employeeCode: "0001",
    name: "Priya Sharma",
    role: "MANAGER",
    kitchenId: "K1",
    active: true,
  },
  {
    id: "EMP-K1-COOK-01",
    employeeCode: "2001",
    name: "Rajesh Kumar",
    role: "LINE_COOK",
    kitchenId: "K1",
    active: true,
  },
  {
    id: "EMP-K2-MGR-01",
    employeeCode: "0002",
    name: "Amit Verma",
    role: "MANAGER",
    kitchenId: "K2",
    active: true,
  },
  {
    id: "EMP-K2-COOK-01",
    employeeCode: "2002",
    name: "Sunita Rao",
    role: "LINE_COOK",
    kitchenId: "K2",
    active: true,
  },
  {
    id: "EMP-K3-MGR-01",
    employeeCode: "0003",
    name: "Vikram Malhotra",
    role: "MANAGER",
    kitchenId: "K3",
    active: true,
  },
  {
    id: "EMP-K3-COOK-01",
    employeeCode: "2003",
    name: "Pooja Iyer",
    role: "LINE_COOK",
    kitchenId: "K3",
    active: true,
  },
  {
    id: "EMP-K4-MGR-01",
    employeeCode: "0004",
    name: "Deepesh Nair",
    role: "MANAGER",
    kitchenId: "K4",
    active: true,
  },
  {
    id: "EMP-K4-COOK-01",
    employeeCode: "2004",
    name: "Anjali Das",
    role: "LINE_COOK",
    kitchenId: "K4",
    active: true,
  },
];

export const PERMISSIONS_DB: Permission[] = [
  {
    id: "PERM-OWNER-VIEW",
    code: "OWNER_VIEW",
    description: "View unified owner analytics and operations.",
  },
  {
    id: "PERM-KITCHEN-OPERATE",
    code: "KITCHEN_OPERATE",
    description: "Operate within an assigned kitchen.",
  },
  {
    id: "PERM-COOK-ORDERS",
    code: "COOK_ORDERS",
    description: "Process cooking-stage orders.",
  },
  {
    id: "PERM-DISPATCH-ORDERS",
    code: "DISPATCH_ORDERS",
    description: "Process dispatch-stage orders.",
  },
  {
    id: "PERM-INVENTORY-VIEW",
    code: "INVENTORY_VIEW",
    description: "View kitchen inventory.",
  },
  {
    id: "PERM-INVENTORY-MANAGE",
    code: "INVENTORY_MANAGE",
    description: "Manage kitchen inventory.",
  },
  {
    id: "PERM-ORDER-CANCEL",
    code: "ORDER_CANCEL",
    description: "Cancel eligible orders.",
  },
  {
    id: "PERM-STAFF-MANAGE",
    code: "STAFF_MANAGE",
    description: "Manage staff access.",
  },
];

export const ROLE_PERMISSIONS_DB: RolePermission[] = [
  { role: "OWNER", permissionId: "PERM-OWNER-VIEW" },
  { role: "OWNER", permissionId: "PERM-KITCHEN-OPERATE" },
  { role: "OWNER", permissionId: "PERM-COOK-ORDERS" },
  { role: "OWNER", permissionId: "PERM-DISPATCH-ORDERS" },
  { role: "OWNER", permissionId: "PERM-INVENTORY-VIEW" },
  { role: "OWNER", permissionId: "PERM-INVENTORY-MANAGE" },
  { role: "OWNER", permissionId: "PERM-ORDER-CANCEL" },
  { role: "OWNER", permissionId: "PERM-STAFF-MANAGE" },
  { role: "MANAGER", permissionId: "PERM-KITCHEN-OPERATE" },
  { role: "MANAGER", permissionId: "PERM-INVENTORY-VIEW" },
  { role: "MANAGER", permissionId: "PERM-INVENTORY-MANAGE" },
  { role: "MANAGER", permissionId: "PERM-ORDER-CANCEL" },
  { role: "MANAGER", permissionId: "PERM-STAFF-MANAGE" },
  { role: "LINE_COOK", permissionId: "PERM-KITCHEN-OPERATE" },
  { role: "LINE_COOK", permissionId: "PERM-COOK-ORDERS" },
  { role: "LINE_COOK", permissionId: "PERM-INVENTORY-VIEW" },
  { role: "DISPATCH", permissionId: "PERM-KITCHEN-OPERATE" },
  { role: "DISPATCH", permissionId: "PERM-DISPATCH-ORDERS" },
  { role: "DISPATCH", permissionId: "PERM-INVENTORY-VIEW" },
];

export const INVENTORY_DB: InventoryItem[] = [
  {
    id: "INV-001",
    sku: "BEEF-01",
    name: "Angus Beef Patties",
    category: "Protein",
    currentStock: 140,
    unit: "units",
    reorderThreshold: 30,
    costPerUnit: 1.2,
    lastRestocked: new Date().toISOString(),
  },
  {
    id: "INV-002",
    sku: "BUN-01",
    name: "Brioche Buns",
    category: "Dry Good",
    currentStock: 18,
    unit: "units",
    reorderThreshold: 25,
    costPerUnit: 0.4,
    lastRestocked: new Date().toISOString(),
  },
  {
    id: "INV-003",
    sku: "BIRRIA-01",
    name: "Slow-Cooked Birria Beef",
    category: "Protein",
    currentStock: 45,
    unit: "lbs",
    reorderThreshold: 10,
    costPerUnit: 4.5,
    lastRestocked: new Date().toISOString(),
  },
  {
    id: "INV-004",
    sku: "TORT-01",
    name: "Corn Tortillas",
    category: "Dry Good",
    currentStock: 220,
    unit: "units",
    reorderThreshold: 50,
    costPerUnit: 0.1,
    lastRestocked: new Date().toISOString(),
  },
  {
    id: "INV-005",
    sku: "WING-01",
    name: "Jumbo Chicken Wings",
    category: "Protein",
    currentStock: 350,
    unit: "units",
    reorderThreshold: 100,
    costPerUnit: 0.55,
    lastRestocked: new Date().toISOString(),
  },
  {
    id: "INV-006",
    sku: "GHOST-01",
    name: "Ghost Pepper Glaze",
    category: "Sauce",
    currentStock: 12,
    unit: "oz",
    reorderThreshold: 20,
    costPerUnit: 0.85,
    lastRestocked: new Date().toISOString(),
  },
  {
    id: "INV-007",
    sku: "TUNA-01",
    name: "Sashimi Grade Ahi Tuna",
    category: "Protein",
    currentStock: 28,
    unit: "lbs",
    reorderThreshold: 8,
    costPerUnit: 12,
    lastRestocked: new Date().toISOString(),
  },
  {
    id: "INV-008",
    sku: "AVO-01",
    name: "Hass Avocados",
    category: "Produce",
    currentStock: 65,
    unit: "units",
    reorderThreshold: 15,
    costPerUnit: 0.9,
    lastRestocked: new Date().toISOString(),
  },
];

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

function getRequiredIngredients(
  order: Order,
): Map<string, number> {
  const requirements = new Map<string, number>();

  for (const orderItem of order.items) {
    const menuItem =
      MENU_CATALOG.find(
        (item) =>
          item.id === orderItem.menuItemId ||
          item.name === orderItem.name,
      );

    if (!menuItem) {
      continue;
    }

    for (const ingredient of menuItem.recipe) {
      const existing =
        requirements.get(
          ingredient.inventoryItemId,
        ) ?? 0;

      requirements.set(
        ingredient.inventoryItemId,
        existing +
          ingredient.quantityRequired *
            orderItem.quantity,
      );
    }
  }

  return requirements;
}

export function evaluateOrderInventory(
  order: Order,
  inventory: InventoryItem[],
): InventoryEvaluation {
  const requirements =
    getRequiredIngredients(order);

  const lowStockItems: string[] = [];
  const insufficientStockItems: string[] = [];

  for (const [
    inventoryItemId,
    requiredQuantity,
  ] of requirements) {
    const inventoryItem =
      inventory.find(
        (item) => item.id === inventoryItemId,
      );

    if (!inventoryItem) {
      insufficientStockItems.push(
        inventoryItemId,
      );
      continue;
    }

    if (
      inventoryItem.currentStock <
      requiredQuantity
    ) {
      insufficientStockItems.push(
        inventoryItem.name,
      );
      continue;
    }

    const remainingStock =
      inventoryItem.currentStock -
      requiredQuantity;

    if (
      remainingStock <=
      inventoryItem.reorderThreshold
    ) {
      lowStockItems.push(
        inventoryItem.name,
      );
    }
  }

  let inventoryDecision: InventoryDecision =
    "AVAILABLE";

  if (insufficientStockItems.length > 0) {
    inventoryDecision =
      "INSUFFICIENT_STOCK";
  } else if (lowStockItems.length > 0) {
    inventoryDecision = "LOW_STOCK";
  }

  return {
    inventoryDecision,
    lowStockItems,
    insufficientStockItems,
  };
}

export function processOrderDepletion(
  order: Order,
  inventory: InventoryItem[],
): OrderDepletionResult {
  const evaluation =
    evaluateOrderInventory(
      order,
      inventory,
    );

  if (
    evaluation.inventoryDecision ===
    "INSUFFICIENT_STOCK"
  ) {
    return {
      updatedInventory: inventory.map(
        (item) => ({ ...item }),
      ),
      depletedItems: [],
      lowStockAlerts:
        evaluation.lowStockItems,
      inventoryDecision:
        evaluation.inventoryDecision,
      insufficientStockItems:
        evaluation.insufficientStockItems,
    };
  }

  const requirements =
    getRequiredIngredients(order);

  const updatedInventory = inventory.map(
    (inventoryItem) => {
      const required =
        requirements.get(
          inventoryItem.id,
        ) ?? 0;

      if (required <= 0) {
        return {
          ...inventoryItem,
        };
      }

      return {
        ...inventoryItem,
        currentStock:
          inventoryItem.currentStock -
          required,
      };
    },
  );

  const depletedItems: string[] = [];

  for (const [
    inventoryItemId,
  ] of requirements) {
    const item =
      inventory.find(
        (inventoryItem) =>
          inventoryItem.id ===
          inventoryItemId,
      );

    if (item) {
      depletedItems.push(item.name);
    }
  }

  const lowStockAlerts =
    updatedInventory
      .filter(
        (item) =>
          item.currentStock <=
          item.reorderThreshold &&
          requirements.has(item.id),
      )
      .map((item) => item.name);

  return {
    updatedInventory,
    depletedItems,
    lowStockAlerts,
    inventoryDecision:
      evaluation.inventoryDecision,
    insufficientStockItems: [],
  };
}
