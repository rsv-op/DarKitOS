import type {
  BrandConfig,
  BrandKitchenConfig,
  CancellationRecord,
  CancellationSource,
  DbaBrand,
  Employee,
  EmployeeRole,
  InventoryDecision,
  InventoryItem,
  InventoryMovement,
  KitchenConfig,
  MenuItem,
  OperationalActivity,
  Order,
  OrderChannel,
  OrderPaymentStatus,
  OrderSource,
  OrderStatus,
  Organization,
  OutboxEvent,
  PaymentTransaction,
  RevenueLeakageVector,
  SystemSettings,
  TaxInvoice,
  VirtualFileAsset,
  WebhookIdempotencyEntry,
} from "@/lib/db";

export const MID_PREP_LABOR_ALLOWANCE_INR = 75;

export const ALLOWED_EMPLOYEE_ROLES = new Set<EmployeeRole>([
  "OWNER",
  "MANAGER",
  "LINE_COOK",
  "DISPATCH",
]);

export const ALLOWED_LEAKAGE_STATUSES = new Set<
  RevenueLeakageVector["status"]
>(["DETECTED", "AUDITING", "RECOVERED"]);

export const CHANNEL_SOURCE_MAP: Record<OrderChannel, OrderSource> = {
  Swiggy: "SWIGGY",
  Zomato: "ZOMATO",
  DoorDash: "DOORDASH",
  UberEats: "UBEREATS",
  GrubHub: "GRUBHUB",
  "Direct Web": "DIRECT_WEB",
};

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["DRIVER_ASSIGNED", "CANCELLED"],
  DRIVER_ASSIGNED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["CANCELLED"],
  CANCELLED: [],
};

export const ALLOWED_FILE_CATEGORIES: VirtualFileAsset["category"][] = [
  "Owner Brief",
  "Health Certificate",
  "SOP Manual",
  "Menu Photography",
  "Recipe Card",
  "Architecture ADR",
  "Financial Audit",
];

export const ALLOWED_FILE_STATUSES: VirtualFileAsset["status"][] = [
  "VERIFIED",
  "PENDING_REVIEW",
  "ARCHIVED",
];

export const ALLOWED_THEMES: SystemSettings["theme"][] = [
  "obsidian",
  "midnight",
  "cyber-emerald",
  "titanium",
];

export const ALLOWED_CURRENCIES: SystemSettings["currency"][] = [
  "INR",
  "USD",
  "EUR",
];

export const ALLOWED_SYNC_MODES: SystemSettings["syncMode"][] = [
  "WEBSOCKET",
  "SSE",
  "HTTP_POLLING",
];

export const ALLOWED_RLS_MODES: SystemSettings["rlsEnforcement"][] = [
  "STRICT_LOCAL_TX",
  "SESSION",
];

export const ALLOWED_CIRCUIT_STATES: SystemSettings["circuitBreakerState"][] = [
  "CLOSED",
  "HALF_OPEN",
  "OPEN",
];

export interface KitchenState {
  organizations: Organization[];
  orders: Order[];
  taxInvoices: TaxInvoice[];
  paymentTransactions: PaymentTransaction[];
  inventory: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  cancellations: CancellationRecord[];
  activities: OperationalActivity[];
  brands: BrandConfig[];
  kitchens: KitchenConfig[];
  brandKitchens: BrandKitchenConfig[];
  menuCatalog: MenuItem[];
  employees: Employee[];
  webhookEvents: WebhookIdempotencyEntry[];
  outboxEvents: OutboxEvent[];
  leakageVectors: RevenueLeakageVector[];
  files: VirtualFileAsset[];
  settings: SystemSettings;
}

export interface StoreSnapshot extends KitchenState {}

export interface InjectOrderInput {
  id?: string;
  organizationId?: string;
  externalOrderId?: string;
  idempotencyKey?: string;
  brandId: DbaBrand;
  kitchenId: string;
  channel: OrderChannel;
  source?: OrderSource;
  priority?: "NORMAL" | "RUSH" | "VIP";
  customerName?: string;
  customerGstin?: string;
  placeOfSupplyStateCode?: string;
  packagingFee?: number;
  paymentStatus?: OrderPaymentStatus;
  notes?: string;
  items: {
    id?: string;
    menuItemId: string;
    name?: string;
    quantity: number;
    notes?: string;
  }[];
  actor: string;
}

export interface InjectOrderResult {
  order: Order;
  invoice?: TaxInvoice;
  idempotentReplay: boolean;
  inventoryDecision: InventoryDecision;
  inventoryWarnings: string[];
  inventoryUnavailable: string[];
}

export interface TransitionOrderInput {
  orderId: string;
  nextStatus: OrderStatus;
  actor: string;
  driverName?: string;
  courierEtaMins?: number;
  cancellationSource?: CancellationSource;
  cancellationReason?: string;
  restoreInventoryOnPrePrepCancel?: boolean;
}

export interface TransitionOrderResult {
  order: Order;
  idempotentReplay: boolean;
  depletedItems?: string[];
  lowStockAlerts?: string[];
  cancellationRecord?: CancellationRecord;
  creditNoteInvoice?: TaxInvoice;
  refundTransaction?: PaymentTransaction;
}

export interface InventoryMutationInput {
  itemId: string;
  action:
    | "RESTOCK"
    | "MANUAL_ADJUSTMENT"
    | "WASTE"
    | "LOSS"
    | "SET_STOCK";
  quantity?: number;
  currentStock?: number;
  reason?: string;
  actor: string;
  kitchenId?: string;
}

export interface InventoryMutationResult {
  item: InventoryItem;
  movement: InventoryMovement;
  inventory: InventoryItem[];
}

export interface TransferInventoryInput {
  itemId: string;
  fromKitchenId: string;
  toKitchenId: string;
  quantity: number;
  reason?: string;
  actor: string;
}

export interface TransferInventoryResult {
  transferGroupId: string;
  fromItem: InventoryItem;
  toItem: InventoryItem;
  outMovement: InventoryMovement;
  inMovement: InventoryMovement;
  inventory: InventoryItem[];
}
