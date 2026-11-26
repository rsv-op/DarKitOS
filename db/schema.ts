import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  BrandConfig,
  CancellationRecord,
  CancellationResolution,
  CancellationSource,
  CancellationStage,
  DbaBrand,
  EmployeeRole,
  InventoryDecision,
  InventoryItem,
  InventoryMovementType,
  KitchenStation,
  OperationalActivity,
  OrderChannel,
  OrderEventType,
  OrderSource,
  OrderStatus,
  OutboxEvent,
  RevenueLeakageVector,
  SystemSettings,
  VirtualFileAsset,
  WebhookIdempotencyEntry,
} from "@/lib/db";

// -----------------------------------------------------------------------------
// 0. Multi-Tenant Organizations
// -----------------------------------------------------------------------------
export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  gstin: text("gstin"),
  fssaiLicense: text("fssai_license"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// -----------------------------------------------------------------------------
// 1. Physical Kitchens
// -----------------------------------------------------------------------------
export const kitchens = pgTable(
  "kitchens",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .default("ORG-001")
      .references(() => organizations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    code: text("code").notNull().unique(),
    location: text("location").notNull(),
    areaCode: text("area_code").notNull(),
    active: boolean("active").notNull().default(true),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    capacityPerHour: integer("capacity_per_hour").notNull().default(100),
  },
  (table) => ({
    orgIdx: index("kitchens_organization_idx").on(table.organizationId),
  }),
);

// -----------------------------------------------------------------------------
// 2. Virtual Brands (DBA)
// -----------------------------------------------------------------------------
export const brands = pgTable(
  "brands",
  {
    id: text("id").$type<DbaBrand>().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .default("ORG-001")
      .references(() => organizations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    code: text("code").notNull().unique(),
    active: boolean("active").notNull().default(true),
    colorTheme: text("color_theme").$type<BrandConfig["colorTheme"]>().notNull(),
    tagline: text("tagline").notNull(),
    cuisine: text("cuisine").notNull(),
  },
  (table) => ({
    orgIdx: index("brands_organization_idx").on(table.organizationId),
  }),
);

// -----------------------------------------------------------------------------
// 3. Brand <-> Kitchen Production Authorization Matrix
// -----------------------------------------------------------------------------
export const brandKitchens = pgTable(
  "brand_kitchens",
  {
    brandId: text("brand_id")
      .$type<DbaBrand>()
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    kitchenId: text("kitchen_id")
      .notNull()
      .references(() => kitchens.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.brandId, table.kitchenId] }),
    kitchenIdx: index("brand_kitchens_kitchen_idx").on(table.kitchenId),
  }),
);

// -----------------------------------------------------------------------------
// 4. Employees (NO PIN column — credentials stay out of operational persistence)
// -----------------------------------------------------------------------------
export const employees = pgTable(
  "employees",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .default("ORG-001")
      .references(() => organizations.id, { onDelete: "restrict" }),
    employeeCode: text("employee_code").notNull().unique(),
    name: text("name").notNull(),
    role: text("role").$type<EmployeeRole>().notNull(),
    kitchenId: text("kitchen_id").references(() => kitchens.id, {
      onDelete: "set null",
    }),
    email: text("email"),
    phone: text("phone"),
    authUserId: text("auth_user_id").unique(),
    active: boolean("active").notNull().default(true),
  },
  (table) => ({
    kitchenIdx: index("employees_kitchen_idx").on(table.kitchenId),
    orgIdx: index("employees_organization_idx").on(table.organizationId),
  }),
);

// -----------------------------------------------------------------------------
// 5. Ingredient Master Catalog (Shared SKU, Unit, Unit Cost in INR)
// -----------------------------------------------------------------------------
export const ingredients = pgTable("ingredients", {
  id: text("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").$type<InventoryItem["category"]>().notNull(),
  unit: text("unit").$type<InventoryItem["unit"]>().notNull(),
  costPerUnit: numeric("cost_per_unit", {
    precision: 12,
    scale: 2,
  }).notNull(),
  expectedYieldPct: real("expected_yield_pct"),
  actualYieldPct: real("actual_yield_pct"),
});

// -----------------------------------------------------------------------------
// 6. Per-Kitchen Isolated Inventory Ledger — Composite PK (kitchen_id, ingredient_id)
// -----------------------------------------------------------------------------
export const kitchenInventory = pgTable(
  "kitchen_inventory",
  {
    kitchenId: text("kitchen_id")
      .notNull()
      .references(() => kitchens.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    currentStock: numeric("current_stock", {
      precision: 12,
      scale: 4,
    }).notNull(),
    reorderThreshold: numeric("reorder_threshold", {
      precision: 12,
      scale: 4,
    }).notNull(),
    lastRestocked: timestamp("last_restocked", {
      withTimezone: true,
    }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.kitchenId, table.ingredientId] }),
    ingredientIdx: index("kitchen_inventory_ingredient_idx").on(
      table.ingredientId,
    ),
  }),
);

// -----------------------------------------------------------------------------
// 7. Menu Catalog
// -----------------------------------------------------------------------------
export const menuItems = pgTable(
  "menu_items",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .$type<DbaBrand>()
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    station: text("station").$type<KitchenStation>().notNull(),
    active: boolean("active").notNull().default(true),
    prepTimeMins: integer("prep_time_mins").notNull().default(8),
  },
  (table) => ({
    brandIdx: index("menu_items_brand_idx").on(table.brandId),
  }),
);

// -----------------------------------------------------------------------------
// 8. Menu Recipe BOM (Normalized Ingredient Requirements per Menu Item)
// -----------------------------------------------------------------------------
export const menuRecipes = pgTable(
  "menu_recipes",
  {
    menuItemId: text("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    quantityRequired: numeric("quantity_required", {
      precision: 12,
      scale: 4,
    }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.menuItemId, table.ingredientId] }),
  }),
);

// -----------------------------------------------------------------------------
// 9. Canonical Orders
// -----------------------------------------------------------------------------
export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .default("ORG-001")
      .references(() => organizations.id, { onDelete: "restrict" }),
    externalOrderId: text("external_order_id"),
    idempotencyKey: text("idempotency_key"),
    brandId: text("brand_id")
      .$type<DbaBrand>()
      .notNull()
      .references(() => brands.id, { onDelete: "restrict" }),
    kitchenId: text("kitchen_id")
      .notNull()
      .references(() => kitchens.id, { onDelete: "restrict" }),
    channel: text("channel").$type<OrderChannel>().notNull(),
    source: text("source").$type<OrderSource>().notNull(),
    status: text("status").$type<OrderStatus>().notNull(),
    priority: text("priority").$type<"NORMAL" | "RUSH" | "VIP">(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
    itemCount: integer("item_count"),
    notes: text("notes"),
    customerName: text("customer_name"),
    driverName: text("driver_name"),
    courierEtaMins: integer("courier_eta_mins"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    prepStartedAt: timestamp("prep_started_at", { withTimezone: true }),
    prepCompletedAt: timestamp("prep_completed_at", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    driverAssignedAt: timestamp("driver_assigned_at", { withTimezone: true }),
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    cancellationSource: text("cancellation_source").$type<CancellationSource>(),
    cancellationReason: text("cancellation_reason"),
    cancelledBy: text("cancelled_by"),
    cancellationStage: text("cancellation_stage").$type<CancellationStage>(),
    cancellationResolution: text(
      "cancellation_resolution",
    ).$type<CancellationResolution>(),
    lossAmount: numeric("loss_amount", { precision: 12, scale: 2 }),
    claimAmount: numeric("claim_amount", { precision: 12, scale: 2 }),

    inventoryDecision: text("inventory_decision").$type<InventoryDecision>(),
    inventoryWarnings: jsonb("inventory_warnings").$type<string[] | null>(),
    inventoryUnavailable: jsonb("inventory_unavailable").$type<
      string[] | null
    >(),
    inventoryConsumed: boolean("inventory_consumed").notNull().default(false),
    inventoryRestored: boolean("inventory_restored").notNull().default(false),
  },
  (table) => ({
    orgKitchenStatusIdx: index("orders_org_kitchen_status_idx").on(
      table.organizationId,
      table.kitchenId,
      table.status,
    ),
    kitchenStatusIdx: index("orders_kitchen_status_idx").on(
      table.kitchenId,
      table.status,
    ),
    brandCreatedIdx: index("orders_brand_created_idx").on(
      table.brandId,
      table.createdAt,
    ),
    idempotencyKeyUnique: uniqueIndex("orders_idempotency_key_unique").on(
      table.idempotencyKey,
    ),
  }),
);

// -----------------------------------------------------------------------------
// 10. Order Line Items
// -----------------------------------------------------------------------------
export const orderItems = pgTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: text("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }),
    notes: text("notes"),
    station: text("station").$type<KitchenStation>().notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => ({
    orderIdx: index("order_items_order_idx").on(table.orderId),
  }),
);

// -----------------------------------------------------------------------------
// 11. Order Lifecycle Audit Events
// -----------------------------------------------------------------------------
export const orderEvents = pgTable(
  "order_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: text("type").$type<OrderEventType>().notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    actor: text("actor").notNull(),
    details: text("details"),
  },
  (table) => ({
    orderTimestampIdx: index("order_events_order_ts_idx").on(
      table.orderId,
      table.timestamp,
    ),
  }),
);

// -----------------------------------------------------------------------------
// 12. Inventory Movements Ledger (Includes TRANSFER_OUT / TRANSFER_IN)
// -----------------------------------------------------------------------------
export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: text("id").primaryKey(),
    kitchenId: text("kitchen_id")
      .notNull()
      .references(() => kitchens.id, { onDelete: "restrict" }),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "restrict" }),
    itemName: text("item_name").notNull(),
    sku: text("sku").notNull(),
    type: text("type").$type<InventoryMovementType>().notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),
    previousStock: numeric("previous_stock", {
      precision: 12,
      scale: 4,
    }).notNull(),
    newStock: numeric("new_stock", { precision: 12, scale: 4 }).notNull(),
    unit: text("unit").notNull(),
    costImpact: numeric("cost_impact", { precision: 12, scale: 2 }).notNull(),
    orderId: text("order_id"),
    transferGroupId: text("transfer_group_id"),
    actor: text("actor").notNull(),
    reason: text("reason").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  },
  (table) => ({
    kitchenTsIdx: index("inventory_movements_kitchen_ts_idx").on(
      table.kitchenId,
      table.timestamp,
    ),
    ingredientTsIdx: index("inventory_movements_ingredient_ts_idx").on(
      table.ingredientId,
      table.timestamp,
    ),
    transferGroupIdx: index("inventory_movements_transfer_group_idx").on(
      table.transferGroupId,
    ),
  }),
);

// -----------------------------------------------------------------------------
// 13. Stage-Aware Cancellations Ledger
// -----------------------------------------------------------------------------
export const cancellations = pgTable(
  "cancellations",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    brandId: text("brand_id")
      .$type<DbaBrand>()
      .notNull()
      .references(() => brands.id, { onDelete: "restrict" }),
    kitchenId: text("kitchen_id")
      .notNull()
      .references(() => kitchens.id, { onDelete: "restrict" }),
    channel: text("channel").$type<OrderChannel>().notNull(),
    stage: text("stage").$type<CancellationStage>().notNull(),
    previousStatus: text("previous_status").$type<OrderStatus>().notNull(),
    resolution: text("resolution").$type<CancellationResolution>().notNull(),
    source: text("source").$type<CancellationSource>().notNull(),
    reason: text("reason").notNull(),
    actor: text("actor").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    financialLoss: numeric("financial_loss", {
      precision: 12,
      scale: 2,
    }).notNull(),
    claimAmount: numeric("claim_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    restoredIngredients: jsonb("restored_ingredients")
      .$type<CancellationRecord["restoredIngredients"]>()
      .notNull(),
    lostIngredients: jsonb("lost_ingredients")
      .$type<CancellationRecord["lostIngredients"]>()
      .notNull(),
    dispatchEvidence: jsonb("dispatch_evidence").$type<
      CancellationRecord["dispatchEvidence"] | null
    >(),
  },
  (table) => ({
    kitchenTsIdx: index("cancellations_kitchen_ts_idx").on(
      table.kitchenId,
      table.timestamp,
    ),
  }),
);

// -----------------------------------------------------------------------------
// 14. Two-Phase Webhook Idempotency Ledger
// -----------------------------------------------------------------------------
export const webhookEvents = pgTable("webhook_events", {
  idempotencyKey: text("idempotency_key").primaryKey(),
  orderId: text("order_id"),
  status: text("status")
    .$type<WebhookIdempotencyEntry["status"]>()
    .notNull()
    .default("processing"),
  channel: text("channel").$type<OrderChannel>().notNull(),
  brandId: text("brand_id").$type<DbaBrand>().notNull(),
  kitchenId: text("kitchen_id").notNull(),
  payloadSummary: text("payload_summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  hitCount: integer("hit_count").notNull().default(1),
});

// -----------------------------------------------------------------------------
// 15. Transactional Outbox Events
// -----------------------------------------------------------------------------
export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    payload: text("payload").notNull(),
    attempt: integer("attempt").notNull().default(1),
    maxAttempts: integer("max_attempts").notNull().default(6),
    backoffSchedule: text("backoff_schedule").notNull(),
    status: text("status").$type<OutboxEvent["status"]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    statusCreatedIdx: index("outbox_events_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  }),
);

// -----------------------------------------------------------------------------
// 16. Operational Activity Feed
// -----------------------------------------------------------------------------
export const activities = pgTable(
  "activities",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .default("ORG-001")
      .references(() => organizations.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    category: text("category")
      .$type<OperationalActivity["category"]>()
      .notNull(),
    title: text("title").notNull(),
    details: text("details").notNull(),
    actor: text("actor").notNull(),
    orderId: text("order_id"),
    kitchenId: text("kitchen_id"),
    brandId: text("brand_id").$type<DbaBrand>(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    severity: text("severity")
      .$type<OperationalActivity["severity"]>()
      .notNull(),
  },
  (table) => ({
    timestampIdx: index("activities_timestamp_idx").on(table.timestamp),
  }),
);

// -----------------------------------------------------------------------------
// 17. Revenue Leakage Audit Vectors
// -----------------------------------------------------------------------------
export const leakageVectors = pgTable("leakage_vectors", {
  id: text("id").primaryKey(),
  vector: text("vector").notNull(),
  signature: text("signature").notNull(),
  impactLevel: text("impact_level")
    .$type<RevenueLeakageVector["impactLevel"]>()
    .notNull(),
  impactNote: text("impact_note").notNull(),
  potentialRevenue: numeric("potential_revenue", {
    precision: 12,
    scale: 2,
  }).notNull(),
  actualCollected: numeric("actual_collected", {
    precision: 12,
    scale: 2,
  }).notNull(),
  leakedAmount: numeric("leaked_amount", {
    precision: 12,
    scale: 2,
  }).notNull(),
  affectedAccounts: integer("affected_accounts").notNull(),
  status: text("status").$type<RevenueLeakageVector["status"]>().notNull(),
});

// -----------------------------------------------------------------------------
// 18. Virtual Explorer Operational Files
// -----------------------------------------------------------------------------
export const virtualFiles = pgTable(
  "virtual_files",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").$type<VirtualFileAsset["category"]>().notNull(),
    size: text("size").notNull(),
    mimeType: text("mime_type").notNull(),
    kitchenId: text("kitchen_id"),
    brandId: text("brand_id").$type<DbaBrand>(),
    uploadedBy: text("uploaded_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    status: text("status").$type<VirtualFileAsset["status"]>().notNull(),
    content: text("content").notNull(),
  },
  (table) => ({
    updatedAtIdx: index("virtual_files_updated_at_idx").on(table.updatedAt),
  }),
);

// -----------------------------------------------------------------------------
// 19. System Settings (Singleton row id = "default")
// -----------------------------------------------------------------------------
export const systemSettings = pgTable("system_settings", {
  id: text("id").primaryKey().default("default"),
  organizationId: text("organization_id")
    .notNull()
    .default("ORG-001")
    .references(() => organizations.id, { onDelete: "restrict" }),
  currency: text("currency").$type<SystemSettings["currency"]>().notNull(),
  timezone: text("timezone").notNull(),
  theme: text("theme").$type<SystemSettings["theme"]>().notNull(),
  fluidAnimations: boolean("fluid_animations").notNull().default(true),
  syncMode: text("sync_mode").$type<SystemSettings["syncMode"]>().notNull(),
  autoAcceptOrders: boolean("auto_accept_orders").notNull().default(true),
  lowStockMultiplier: real("low_stock_multiplier").notNull().default(1.0),
  prepSlaMinutes: integer("prep_sla_minutes").notNull().default(12),
  dispatchSlaMinutes: integer("dispatch_sla_minutes").notNull().default(15),
  rlsEnforcement: text("rls_enforcement")
    .$type<SystemSettings["rlsEnforcement"]>()
    .notNull(),
  circuitBreakerState: text("circuit_breaker_state")
    .$type<SystemSettings["circuitBreakerState"]>()
    .notNull(),
  rateLimitRps: integer("rate_limit_rps").notNull().default(250),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const schema = {
  organizations,
  kitchens,
  brands,
  brandKitchens,
  employees,
  ingredients,
  kitchenInventory,
  menuItems,
  menuRecipes,
  orders,
  orderItems,
  orderEvents,
  inventoryMovements,
  cancellations,
  webhookEvents,
  outboxEvents,
  activities,
  leakageVectors,
  virtualFiles,
  systemSettings,
};
