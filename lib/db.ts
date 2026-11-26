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
  | "STAFF_MANAGE"
  | "ORDER_INJECT";

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

export type CancellationStage =
  | "BEFORE_PREP"
  | "DURING_OR_AFTER_PREP"
  | "AFTER_PICKUP";

export type CancellationResolution =
  | "INVENTORY_RESTORED"
  | "UNAVOIDABLE_LOSS"
  | "FOOD_AND_LABOR_LOSS"
  | "AGGREGATOR_ACCOUNTING_CLAIM";

export type InventoryMovementType =
  | "SALE_CONSUMPTION"
  | "RESTOCK"
  | "MANUAL_ADJUSTMENT"
  | "WASTE"
  | "LOSS"
  | "CANCELLATION_RESTORE"
  | "TRANSFER_OUT"
  | "TRANSFER_IN";

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
  | "INVENTORY_UNAVAILABLE"
  | "INVENTORY_DEPLETED"
  | "INVENTORY_RESTORED"
  | "LOSS_RECORDED"
  | "CLAIM_LOGGED";

export const DEFAULT_ORGANIZATION_ID = "ORG-001";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  gstin?: string;
  fssaiLicense?: string;
  active: boolean;
  createdAt: string;
}

export interface BrandConfig {
  id: DbaBrand;
  organizationId?: string;
  name: string;
  code: string;
  active: boolean;
  colorTheme: string;
  tagline?: string;
  cuisine?: string;
}

export interface KitchenConfig {
  id: string;
  organizationId?: string;
  name: string;
  code: string;
  location?: string;
  areaCode?: string;
  active: boolean;
  timezone: string;
  capacityPerHour?: number;
}

export interface BrandKitchenConfig {
  brandId: DbaBrand;
  kitchenId: string;
  active: boolean;
}

export interface Employee {
  id: string;
  organizationId?: string;
  employeeCode: string;
  name: string;
  role: EmployeeRole;
  kitchenId?: string;
  email?: string;
  phone?: string;
  authUserId?: string;
  active: boolean;
  pin?: string;
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
  ingredientId?: string;
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
  unit: "oz" | "lbs" | "g" | "kg" | "ml" | "units" | "count";
  reorderThreshold: number;
  costPerUnit: number;
  lastRestocked: string;
  kitchenId?: string;
  expectedYieldPct?: number;
  actualYieldPct?: number;
}

export interface InventoryMovement {
  id: string;
  inventoryItemId: string;
  itemName: string;
  sku: string;
  kitchenId: string;
  type: InventoryMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  unit: string;
  costImpact: number;
  orderId?: string;
  transferGroupId?: string;
  actor: string;
  reason: string;
  timestamp: string;
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
  active?: boolean;
  prepTimeMins?: number;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price?: number;
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
  organizationId?: string;
  externalOrderId?: string;
  idempotencyKey?: string;

  brandId: DbaBrand;
  kitchenId: string;

  channel: OrderChannel;
  source: OrderSource;

  status: OrderStatus;
  priority?: "NORMAL" | "RUSH" | "VIP";

  items: OrderItem[];
  totalAmount?: number;
  itemCount?: number;
  notes?: string;

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

  cancellationSource?: CancellationSource;
  cancellationReason?: string;
  cancelledBy?: string;
  cancellationStage?: CancellationStage;
  cancellationResolution?: CancellationResolution;
  lossAmount?: number;
  claimAmount?: number;

  inventoryDecision?: InventoryDecision;
  inventoryWarnings?: string[];
  inventoryUnavailable?: string[];
  inventoryConsumed?: boolean;
  inventoryRestored?: boolean;

  events: OrderEvent[];
}

export interface CancellationRecord {
  id: string;
  orderId: string;
  brandId: DbaBrand;
  kitchenId: string;
  channel: OrderChannel;
  stage: CancellationStage;
  previousStatus: OrderStatus;
  resolution: CancellationResolution;
  source: CancellationSource;
  reason: string;
  actor: string;
  timestamp: string;
  financialLoss: number;
  claimAmount: number;
  restoredIngredients: {
    inventoryItemId: string;
    name: string;
    quantity: number;
  }[];
  lostIngredients: {
    inventoryItemId: string;
    name: string;
    quantity: number;
  }[];
  dispatchEvidence?: {
    driverName?: string;
    readyAt?: string;
    driverAssignedAt?: string;
    pickedUpAt?: string;
    dispatchedAt?: string;
  };
}

export interface OperationalActivity {
  id: string;
  organizationId?: string;
  type: string;
  category:
    | "ORDER"
    | "INVENTORY"
    | "CANCELLATION"
    | "DISPATCH"
    | "SYSTEM"
    | "AUTH"
    | "CLOUD7";
  title: string;
  details: string;
  actor: string;
  orderId?: string;
  kitchenId?: string;
  brandId?: DbaBrand;
  timestamp: string;
  severity: "info" | "success" | "warning" | "error";
}

export interface WebhookIdempotencyEntry {
  idempotencyKey: string;
  orderId: string;
  status: "processing" | "completed" | "failed";
  channel: OrderChannel;
  brandId: DbaBrand;
  kitchenId: string;
  payloadSummary: string;
  createdAt: string;
  hitCount: number;
}

export interface OutboxEvent {
  id: string;
  eventType: string;
  aggregateId: string;
  payload: string;
  attempt: number;
  maxAttempts: number;
  backoffSchedule: string;
  status: "PENDING" | "DELIVERED" | "RETRYING" | "DLQ";
  createdAt: string;
}

export interface RevenueLeakageVector {
  id: string;
  vector: string;
  signature: string;
  impactLevel: "Severe" | "High" | "Moderate";
  impactNote: string;
  potentialRevenue: number;
  actualCollected: number;
  leakedAmount: number;
  affectedAccounts: number;
  status: "DETECTED" | "AUDITING" | "RECOVERED";
}

export interface VirtualFileAsset {
  id: string;
  name: string;
  category:
    | "Owner Brief"
    | "Health Certificate"
    | "SOP Manual"
    | "Menu Photography"
    | "Recipe Card"
    | "Architecture ADR"
    | "Financial Audit";
  size: string;
  mimeType: string;
  kitchenId?: string;
  brandId?: DbaBrand;
  uploadedBy: string;
  updatedAt: string;
  status: "VERIFIED" | "PENDING_REVIEW" | "ARCHIVED";
  content: string;
}

export interface SystemSettings {
  organizationId?: string;
  currency: "INR" | "USD" | "EUR";
  timezone: string;
  theme: "obsidian" | "midnight" | "cyber-emerald" | "titanium";
  fluidAnimations: boolean;
  syncMode: "WEBSOCKET" | "SSE" | "HTTP_POLLING";
  autoAcceptOrders: boolean;
  lowStockMultiplier: number;
  prepSlaMinutes: number;
  dispatchSlaMinutes: number;
  rlsEnforcement: "STRICT_LOCAL_TX" | "SESSION";
  circuitBreakerState: "CLOSED" | "HALF_OPEN" | "OPEN";
  rateLimitRps: number;
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

export const ORGANIZATIONS_DB: Organization[] = [
  {
    id: DEFAULT_ORGANIZATION_ID,
    name: "DarKit Hospitality Pvt. Ltd.",
    slug: "darkit-hospitality",
    gstin: "06AABCD4921E1Z5",
    fssaiLicense: "10824005001942",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

export const BRANDS_DB: BrandConfig[] = [
  {
    id: "BurgerForge",
    organizationId: DEFAULT_ORGANIZATION_ID,
    name: "BurgerForge",
    code: "BF",
    active: true,
    colorTheme: "amber",
    tagline: "Artisanal Smash Burgers & Truffle Sides",
    cuisine: "American Craft Grill",
  },
  {
    id: "TacoMatrix",
    organizationId: DEFAULT_ORGANIZATION_ID,
    name: "TacoMatrix",
    code: "TM",
    active: true,
    colorTheme: "emerald",
    tagline: "Slow-Braised Birria & Street Masa",
    cuisine: "Modern Mexican Taqueria",
  },
  {
    id: "WingProtocol",
    organizationId: DEFAULT_ORGANIZATION_ID,
    name: "WingProtocol",
    code: "WP",
    active: true,
    colorTheme: "red",
    tagline: "High-Heat Glazed Jumbo Wings",
    cuisine: "Precision Fried Poultry",
  },
  {
    id: "GreenBowl",
    organizationId: DEFAULT_ORGANIZATION_ID,
    name: "GreenBowl",
    code: "GB",
    active: true,
    colorTheme: "cyan",
    tagline: "Sashimi Poke & Macro-Balanced Bowls",
    cuisine: "Pacific Raw & Greens",
  },
];

export const KITCHENS_DB: KitchenConfig[] = [
  {
    id: "K1",
    organizationId: DEFAULT_ORGANIZATION_ID,
    name: "Gurugram Central Hub",
    code: "GGN-01",
    location: "Sector 29, Gurugram",
    areaCode: "GGN-01",
    active: true,
    timezone: "Asia/Kolkata",
    capacityPerHour: 120,
  },
  {
    id: "K2",
    organizationId: DEFAULT_ORGANIZATION_ID,
    name: "Noida Sector 62 Cloud Unit B",
    code: "NDA-02",
    location: "Sector 62, Noida",
    areaCode: "NDA-02",
    active: true,
    timezone: "Asia/Kolkata",
    capacityPerHour: 95,
  },
  {
    id: "K3",
    organizationId: DEFAULT_ORGANIZATION_ID,
    name: "South Delhi Dark Kitchen",
    code: "DEL-03",
    location: "Greater Kailash, New Delhi",
    areaCode: "DEL-03",
    active: true,
    timezone: "Asia/Kolkata",
    capacityPerHour: 110,
  },
  {
    id: "K4",
    organizationId: DEFAULT_ORGANIZATION_ID,
    name: "Cyber City Express Hatch",
    code: "CYB-04",
    location: "DLF Phase 3, Gurugram",
    areaCode: "CYB-04",
    active: true,
    timezone: "Asia/Kolkata",
    capacityPerHour: 85,
  },
];

export const BRAND_KITCHENS_DB: BrandKitchenConfig[] = [
  // K1 Gurugram Central Hub serves all 4 virtual brands
  { brandId: "BurgerForge", kitchenId: "K1", active: true },
  { brandId: "TacoMatrix", kitchenId: "K1", active: true },
  { brandId: "WingProtocol", kitchenId: "K1", active: true },
  { brandId: "GreenBowl", kitchenId: "K1", active: true },
  // K2 Noida Sector 62
  { brandId: "BurgerForge", kitchenId: "K2", active: true },
  { brandId: "TacoMatrix", kitchenId: "K2", active: true },
  { brandId: "WingProtocol", kitchenId: "K2", active: false },
  { brandId: "GreenBowl", kitchenId: "K2", active: true },
  // K3 South Delhi Dark Kitchen
  { brandId: "BurgerForge", kitchenId: "K3", active: true },
  { brandId: "TacoMatrix", kitchenId: "K3", active: false },
  { brandId: "WingProtocol", kitchenId: "K3", active: true },
  { brandId: "GreenBowl", kitchenId: "K3", active: true },
  // K4 Cyber City Express Hatch
  { brandId: "BurgerForge", kitchenId: "K4", active: true },
  { brandId: "TacoMatrix", kitchenId: "K4", active: true },
  { brandId: "WingProtocol", kitchenId: "K4", active: true },
  { brandId: "GreenBowl", kitchenId: "K4", active: false },
];

export const EMPLOYEES_DB: Employee[] = [
  {
    id: "EMP-OWNER-01",
    organizationId: DEFAULT_ORGANIZATION_ID,
    employeeCode: "OWNER-01",
    name: "Patric Revuelto",
    role: "OWNER",
    email: "owner@darkit.in",
    phone: "+919810000001",
    active: true,
  },
  {
    id: "EMP-K1-MGR-01",
    organizationId: DEFAULT_ORGANIZATION_ID,
    employeeCode: "0001",
    name: "Priya Sharma",
    role: "MANAGER",
    kitchenId: "K1",
    email: "priya.k1@darkit.in",
    phone: "+919810000011",
    active: true,
  },
  {
    id: "EMP-K1-COOK-01",
    organizationId: DEFAULT_ORGANIZATION_ID,
    employeeCode: "2001",
    name: "Rajesh Kumar",
    role: "LINE_COOK",
    kitchenId: "K1",
    email: "rajesh.k1@darkit.in",
    phone: "+919810000012",
    active: true,
  },
  {
    id: "EMP-K1-DISP-01",
    organizationId: DEFAULT_ORGANIZATION_ID,
    employeeCode: "3001",
    name: "Arjun Mehta",
    role: "DISPATCH",
    kitchenId: "K1",
    email: "arjun.k1@darkit.in",
    phone: "+919810000013",
    active: true,
  },
  {
    id: "EMP-K2-MGR-01",
    organizationId: DEFAULT_ORGANIZATION_ID,
    employeeCode: "0002",
    name: "Amit Verma",
    role: "MANAGER",
    kitchenId: "K2",
    email: "amit.k2@darkit.in",
    active: true,
  },
  {
    id: "EMP-K2-COOK-01",
    organizationId: DEFAULT_ORGANIZATION_ID,
    employeeCode: "2002",
    name: "Sunita Rao",
    role: "LINE_COOK",
    kitchenId: "K2",
    email: "sunita.k2@darkit.in",
    active: true,
  },
  {
    id: "EMP-K2-DISP-01",
    organizationId: DEFAULT_ORGANIZATION_ID,
    employeeCode: "3002",
    name: "Karan Saxena",
    role: "DISPATCH",
    kitchenId: "K2",
    email: "karan.k2@darkit.in",
    active: true,
  },
  {
    id: "EMP-K3-MGR-01",
    organizationId: DEFAULT_ORGANIZATION_ID,
    employeeCode: "0003",
    name: "Vikram Malhotra",
    role: "MANAGER",
    kitchenId: "K3",
    email: "vikram.k3@darkit.in",
    active: true,
  },
  {
    id: "EMP-K3-COOK-01",
    organizationId: DEFAULT_ORGANIZATION_ID,
    employeeCode: "2003",
    name: "Pooja Iyer",
    role: "LINE_COOK",
    kitchenId: "K3",
    email: "pooja.k3@darkit.in",
    active: true,
  },
  {
    id: "EMP-K3-DISP-01",
    organizationId: DEFAULT_ORGANIZATION_ID,
    employeeCode: "3003",
    name: "Neha Gupta",
    role: "DISPATCH",
    kitchenId: "K3",
    email: "neha.k3@darkit.in",
    active: true,
  },
  {
    id: "EMP-K4-MGR-01",
    organizationId: DEFAULT_ORGANIZATION_ID,
    employeeCode: "0004",
    name: "Deepesh Nair",
    role: "MANAGER",
    kitchenId: "K4",
    email: "deepesh.k4@darkit.in",
    active: true,
  },
  {
    id: "EMP-K4-COOK-01",
    organizationId: DEFAULT_ORGANIZATION_ID,
    employeeCode: "2004",
    name: "Anjali Das",
    role: "LINE_COOK",
    kitchenId: "K4",
    email: "anjali.k4@darkit.in",
    active: true,
  },
  {
    id: "EMP-K4-DISP-01",
    organizationId: DEFAULT_ORGANIZATION_ID,
    employeeCode: "3004",
    name: "Rohan Joshi",
    role: "DISPATCH",
    kitchenId: "K4",
    email: "rohan.k4@darkit.in",
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
  {
    id: "PERM-ORDER-INJECT",
    code: "ORDER_INJECT",
    description: "Inject canonical orders into kitchen pipeline.",
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
  { role: "OWNER", permissionId: "PERM-ORDER-INJECT" },
  { role: "MANAGER", permissionId: "PERM-OWNER-VIEW" },
  { role: "MANAGER", permissionId: "PERM-KITCHEN-OPERATE" },
  { role: "MANAGER", permissionId: "PERM-COOK-ORDERS" },
  { role: "MANAGER", permissionId: "PERM-DISPATCH-ORDERS" },
  { role: "MANAGER", permissionId: "PERM-INVENTORY-VIEW" },
  { role: "MANAGER", permissionId: "PERM-INVENTORY-MANAGE" },
  { role: "MANAGER", permissionId: "PERM-ORDER-CANCEL" },
  { role: "MANAGER", permissionId: "PERM-STAFF-MANAGE" },
  { role: "MANAGER", permissionId: "PERM-ORDER-INJECT" },
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
    costPerUnit: 85,
    lastRestocked: "2026-10-11T04:00:00.000Z",
    kitchenId: "K1",
    expectedYieldPct: 88,
    actualYieldPct: 85.4,
  },
  {
    id: "INV-002",
    sku: "BUN-01",
    name: "Brioche Buns",
    category: "Dry Good",
    currentStock: 18,
    unit: "units",
    reorderThreshold: 25,
    costPerUnit: 28,
    lastRestocked: "2026-10-11T04:00:00.000Z",
    kitchenId: "K1",
    expectedYieldPct: 98,
    actualYieldPct: 96.2,
  },
  {
    id: "INV-003",
    sku: "BIRRIA-01",
    name: "Slow-Cooked Birria Beef",
    category: "Protein",
    currentStock: 22,
    unit: "kg",
    reorderThreshold: 6,
    costPerUnit: 580,
    lastRestocked: "2026-10-11T04:00:00.000Z",
    kitchenId: "K1",
    expectedYieldPct: 80,
    actualYieldPct: 74.5,
  },
  {
    id: "INV-004",
    sku: "TORT-01",
    name: "Corn Tortillas",
    category: "Dry Good",
    currentStock: 220,
    unit: "units",
    reorderThreshold: 50,
    costPerUnit: 12,
    lastRestocked: "2026-10-11T04:00:00.000Z",
    kitchenId: "K1",
    expectedYieldPct: 97,
    actualYieldPct: 95.8,
  },
  {
    id: "INV-005",
    sku: "WING-01",
    name: "Jumbo Chicken Wings",
    category: "Protein",
    currentStock: 350,
    unit: "units",
    reorderThreshold: 100,
    costPerUnit: 18,
    lastRestocked: "2026-10-11T04:00:00.000Z",
    kitchenId: "K1",
    expectedYieldPct: 85,
    actualYieldPct: 81.2,
  },
  {
    id: "INV-006",
    sku: "GHOST-01",
    name: "Ghost Pepper Glaze",
    category: "Sauce",
    currentStock: 360,
    unit: "ml",
    reorderThreshold: 600,
    costPerUnit: 0.5,
    lastRestocked: "2026-10-11T04:00:00.000Z",
    kitchenId: "K1",
    expectedYieldPct: 94,
    actualYieldPct: 88.0,
  },
  {
    id: "INV-007",
    sku: "TUNA-01",
    name: "Sashimi Grade Ahi Tuna",
    category: "Protein",
    currentStock: 14,
    unit: "kg",
    reorderThreshold: 4,
    costPerUnit: 1200,
    lastRestocked: "2026-10-11T04:00:00.000Z",
    kitchenId: "K1",
    expectedYieldPct: 82,
    actualYieldPct: 79.5,
  },
  {
    id: "INV-008",
    sku: "AVO-01",
    name: "Hass Avocados",
    category: "Produce",
    currentStock: 65,
    unit: "units",
    reorderThreshold: 15,
    costPerUnit: 65,
    lastRestocked: "2026-10-11T04:00:00.000Z",
    kitchenId: "K1",
    expectedYieldPct: 78,
    actualYieldPct: 73.0,
  },
  {
    id: "INV-009",
    sku: "CHED-01",
    name: "Aged Sharp Cheddar Slices",
    category: "Dairy",
    currentStock: 95,
    unit: "units",
    reorderThreshold: 30,
    costPerUnit: 22,
    lastRestocked: "2026-10-11T04:00:00.000Z",
    kitchenId: "K1",
    expectedYieldPct: 99,
    actualYieldPct: 98.1,
  },
  {
    id: "INV-010",
    sku: "PACK-01",
    name: "Thermal Vent Eco-Boxes",
    category: "Packaging",
    currentStock: 310,
    unit: "units",
    reorderThreshold: 80,
    costPerUnit: 18,
    lastRestocked: "2026-10-11T04:00:00.000Z",
    kitchenId: "K1",
    expectedYieldPct: 100,
    actualYieldPct: 99.4,
  },
  {
    id: "INV-011",
    sku: "FRIES-01",
    name: "Truffle Skin-On Fries Pack",
    category: "Produce",
    currentStock: 120,
    unit: "units",
    reorderThreshold: 30,
    costPerUnit: 42,
    lastRestocked: "2026-10-11T04:00:00.000Z",
    kitchenId: "K1",
    expectedYieldPct: 96,
    actualYieldPct: 94.5,
  },
];

export const INITIAL_INVENTORY = INVENTORY_DB;

export const MENU_CATALOG: MenuItem[] = [
  {
    id: "MENU-BF-01",
    brandId: "BurgerForge",
    name: "Double Smash Burger",
    price: 349,
    station: "Grill",
    active: true,
    prepTimeMins: 9,
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
    price: 189,
    station: "Fryer",
    active: true,
    prepTimeMins: 6,
    recipe: [
      {
        inventoryItemId: "INV-011",
        quantityRequired: 1,
      },
      {
        inventoryItemId: "INV-010",
        quantityRequired: 1,
      },
    ],
  },
  {
    id: "MENU-BF-03",
    brandId: "BurgerForge",
    name: "Oklahoma Onion Melt",
    price: 389,
    station: "Grill",
    active: true,
    prepTimeMins: 10,
    recipe: [
      {
        inventoryItemId: "INV-001",
        quantityRequired: 2,
      },
      {
        inventoryItemId: "INV-002",
        quantityRequired: 1,
      },
      {
        inventoryItemId: "INV-009",
        quantityRequired: 2,
      },
    ],
  },
  {
    id: "MENU-TM-01",
    brandId: "TacoMatrix",
    name: "Birria Taco Trio",
    price: 399,
    station: "Assembly",
    active: true,
    prepTimeMins: 8,
    recipe: [
      {
        inventoryItemId: "INV-003",
        quantityRequired: 0.25,
      },
      {
        inventoryItemId: "INV-004",
        quantityRequired: 3,
      },
    ],
  },
  {
    id: "MENU-TM-02",
    brandId: "TacoMatrix",
    name: "Avocado Quesabirria Vampiro",
    price: 449,
    station: "Assembly",
    active: true,
    prepTimeMins: 9,
    recipe: [
      {
        inventoryItemId: "INV-003",
        quantityRequired: 0.25,
      },
      {
        inventoryItemId: "INV-004",
        quantityRequired: 2,
      },
      {
        inventoryItemId: "INV-008",
        quantityRequired: 1,
      },
    ],
  },
  {
    id: "MENU-WP-01",
    brandId: "WingProtocol",
    name: "12pc Ghost Pepper Wings",
    price: 469,
    station: "Fryer",
    active: true,
    prepTimeMins: 12,
    recipe: [
      {
        inventoryItemId: "INV-005",
        quantityRequired: 12,
      },
      {
        inventoryItemId: "INV-006",
        quantityRequired: 120,
      },
    ],
  },
  {
    id: "MENU-WP-02",
    brandId: "WingProtocol",
    name: "6pc Tactical Fire Wings",
    price: 269,
    station: "Fryer",
    active: true,
    prepTimeMins: 10,
    recipe: [
      {
        inventoryItemId: "INV-005",
        quantityRequired: 6,
      },
      {
        inventoryItemId: "INV-006",
        quantityRequired: 60,
      },
    ],
  },
  {
    id: "MENU-GB-01",
    brandId: "GreenBowl",
    name: "Ahi Tuna Poke Bowl",
    price: 529,
    station: "Cold Prep",
    active: true,
    prepTimeMins: 7,
    recipe: [
      {
        inventoryItemId: "INV-007",
        quantityRequired: 0.2,
      },
      {
        inventoryItemId: "INV-008",
        quantityRequired: 1,
      },
    ],
  },
  {
    id: "MENU-GB-02",
    brandId: "GreenBowl",
    name: "Double Avocado Tataki Bowl",
    price: 579,
    station: "Cold Prep",
    active: true,
    prepTimeMins: 7,
    recipe: [
      {
        inventoryItemId: "INV-007",
        quantityRequired: 0.25,
      },
      {
        inventoryItemId: "INV-008",
        quantityRequired: 2,
      },
    ],
  },
];

export function getRequiredIngredients(
  order: Order,
  menuCatalog: MenuItem[] = MENU_CATALOG,
): Map<string, number> {
  const requirements = new Map<string, number>();

  for (const orderItem of order.items) {
    const menuItem = menuCatalog.find(
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
        Number(
          (
            existing +
            ingredient.quantityRequired *
              orderItem.quantity
          ).toFixed(4),
        ),
      );
    }
  }

  return requirements;
}

function findKitchenInventoryItem(
  inventory: InventoryItem[],
  inventoryItemId: string,
  kitchenId?: string,
): InventoryItem | undefined {
  const hasScopedRows =
    Boolean(kitchenId) &&
    inventory.some((item) => Boolean(item.kitchenId));

  if (hasScopedRows && kitchenId) {
    return inventory.find(
      (item) =>
        (item.id === inventoryItemId ||
          item.ingredientId === inventoryItemId) &&
        item.kitchenId === kitchenId,
    );
  }

  return inventory.find(
    (item) =>
      item.id === inventoryItemId ||
      item.ingredientId === inventoryItemId,
  );
}

export function evaluateOrderInventory(
  order: Order,
  inventory: InventoryItem[],
  menuCatalog: MenuItem[] = MENU_CATALOG,
): InventoryEvaluation {
  const requirements = getRequiredIngredients(
    order,
    menuCatalog,
  );

  const lowStockItems: string[] = [];
  const insufficientStockItems: string[] = [];

  for (const [
    inventoryItemId,
    requiredQuantity,
  ] of requirements) {
    const inventoryItem = findKitchenInventoryItem(
      inventory,
      inventoryItemId,
      order.kitchenId,
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
  menuCatalog: MenuItem[] = MENU_CATALOG,
): OrderDepletionResult {
  const evaluation = evaluateOrderInventory(
    order,
    inventory,
    menuCatalog,
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

  const requirements = getRequiredIngredients(
    order,
    menuCatalog,
  );

  const hasScopedRows =
    Boolean(order.kitchenId) &&
    inventory.some((item) => Boolean(item.kitchenId));

  const updatedInventory = inventory.map(
    (inventoryItem) => {
      const kitchenMatches =
        !hasScopedRows ||
        inventoryItem.kitchenId === order.kitchenId;
      const itemKey =
        inventoryItem.ingredientId ?? inventoryItem.id;
      const required = kitchenMatches
        ? (requirements.get(itemKey) ??
          requirements.get(inventoryItem.id) ??
          0)
        : 0;

      if (required <= 0) {
        return {
          ...inventoryItem,
        };
      }

      return {
        ...inventoryItem,
        currentStock: Number(
          (
            inventoryItem.currentStock -
            required
          ).toFixed(4),
        ),
      };
    },
  );

  const depletedItems: string[] = [];

  for (const [
    inventoryItemId,
  ] of requirements) {
    const item = findKitchenInventoryItem(
      inventory,
      inventoryItemId,
      order.kitchenId,
    );

    if (item) {
      depletedItems.push(item.name);
    }
  }

  const lowStockAlerts =
    updatedInventory
      .filter((item) => {
        const kitchenMatches =
          !hasScopedRows ||
          item.kitchenId === order.kitchenId;
        const itemKey = item.ingredientId ?? item.id;
        return (
          kitchenMatches &&
          item.currentStock <=
            item.reorderThreshold &&
          (requirements.has(itemKey) ||
            requirements.has(item.id))
        );
      })
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

export function calculateOrderRecipeCost(
  order: Order,
  inventory: InventoryItem[] = INVENTORY_DB,
  menuCatalog: MenuItem[] = MENU_CATALOG,
): number {
  const requirements = getRequiredIngredients(
    order,
    menuCatalog,
  );
  let totalCost = 0;

  for (const [
    inventoryItemId,
    requiredQty,
  ] of requirements) {
    const item =
      findKitchenInventoryItem(
        inventory,
        inventoryItemId,
        order.kitchenId,
      ) ??
      inventory.find(
        (i) =>
          i.id === inventoryItemId ||
          i.ingredientId === inventoryItemId,
      );
    if (item) {
      totalCost +=
        item.costPerUnit * requiredQty;
    }
  }

  return Number(totalCost.toFixed(2));
}

export function calculateOrderTotalAmount(
  items: OrderItem[],
  menuCatalog: MenuItem[] = MENU_CATALOG,
): number {
  let total = 0;
  for (const item of items) {
    if (typeof item.price === "number") {
      total += item.price * item.quantity;
      continue;
    }
    const menu = menuCatalog.find(
      (m) =>
        m.id === item.menuItemId ||
        m.name === item.name,
    );
    if (menu) {
      total += menu.price * item.quantity;
    }
  }
  return Number(total.toFixed(2));
}
