import "server-only";
import crypto from "crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import {
  resetDatabaseToSeed,
  seedDatabaseIdempotent,
} from "@/db/seed-runner";
import { formatCurrency } from "@/lib/currency";
import {
  DEFAULT_ORGANIZATION_ID,
  INVENTORY_DB,
  calculateOrderRecipeCost,
  calculateOrderTotalAmount,
  evaluateOrderInventory,
  getRequiredIngredients,
  type BrandConfig,
  type BrandKitchenConfig,
  type CancellationRecord,
  type CancellationResolution,
  type CancellationSource,
  type CancellationStage,
  type DbaBrand,
  type Employee,
  type InventoryItem,
  type InventoryMovement,
  type InventoryMovementType,
  type KitchenConfig,
  type MenuItem,
  type OperationalActivity,
  type Order,
  type OrderChannel,
  type OrderEvent,
  type OrderItem,
  type Organization,
  type OutboxEvent,
  type RevenueLeakageVector,
  type SystemSettings,
  type VirtualFileAsset,
  type WebhookIdempotencyEntry,
} from "@/lib/db";
import { getDb, type DarKitDb } from "@/lib/db-client";
import { DEFAULT_SETTINGS } from "@/lib/store-seed";
import {
  ALLOWED_CIRCUIT_STATES,
  ALLOWED_CURRENCIES,
  ALLOWED_EMPLOYEE_ROLES,
  ALLOWED_FILE_CATEGORIES,
  ALLOWED_FILE_STATUSES,
  ALLOWED_LEAKAGE_STATUSES,
  ALLOWED_RLS_MODES,
  ALLOWED_SYNC_MODES,
  ALLOWED_THEMES,
  CHANNEL_SOURCE_MAP,
  MID_PREP_LABOR_ALLOWANCE_INR,
  VALID_ORDER_TRANSITIONS,
  type InjectOrderInput,
  type InjectOrderResult,
  type InventoryMutationInput,
  type InventoryMutationResult,
  type StoreSnapshot,
  type TransferInventoryInput,
  type TransferInventoryResult,
  type TransitionOrderInput,
  type TransitionOrderResult,
} from "@/lib/store-types";

type PgTx = Parameters<Parameters<DarKitDb["transaction"]>[0]>[0];
type QueryRunner = DarKitDb | PgTx;

declare global {
  // eslint-disable-next-line no-var
  var __darkit_pg_seed_promise__: Promise<void> | undefined;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
}

function num(value: string | number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optNum(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * Ensures the connected PostgreSQL database has canonical seed rows on cold start.
 * Safe under concurrent requests (single-flight promise + ON CONFLICT DO NOTHING).
 */
export async function ensureSeeded(): Promise<void> {
  if (!globalThis.__darkit_pg_seed_promise__) {
    globalThis.__darkit_pg_seed_promise__ = (async () => {
      const db = getDb();
      const existing = await db
        .select({ id: schema.kitchens.id })
        .from(schema.kitchens)
        .limit(1);
      if (existing.length === 0) {
        await seedDatabaseIdempotent(db);
      }
    })().catch((err) => {
      globalThis.__darkit_pg_seed_promise__ = undefined;
      throw err;
    });
  }
  await globalThis.__darkit_pg_seed_promise__;
}

// -----------------------------------------------------------------------------
// Row Mappers
// -----------------------------------------------------------------------------

function mapSettingsRow(
  row?: typeof schema.systemSettings.$inferSelect,
): SystemSettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    organizationId: row.organizationId ?? DEFAULT_ORGANIZATION_ID,
    currency: row.currency,
    timezone: row.timezone,
    theme: row.theme,
    fluidAnimations: row.fluidAnimations,
    syncMode: row.syncMode,
    autoAcceptOrders: row.autoAcceptOrders,
    lowStockMultiplier: row.lowStockMultiplier,
    prepSlaMinutes: row.prepSlaMinutes,
    dispatchSlaMinutes: row.dispatchSlaMinutes,
    rlsEnforcement: row.rlsEnforcement,
    circuitBreakerState: row.circuitBreakerState,
    rateLimitRps: row.rateLimitRps,
  };
}

async function loadMenuCatalog(runner: QueryRunner): Promise<MenuItem[]> {
  const [items, recipes] = await Promise.all([
    runner.select().from(schema.menuItems).orderBy(asc(schema.menuItems.id)),
    runner.select().from(schema.menuRecipes).orderBy(asc(schema.menuRecipes.ingredientId)),
  ]);

  const recipeMap = new Map<string, MenuItem["recipe"]>();
  for (const r of recipes) {
    const list = recipeMap.get(r.menuItemId) ?? [];
    list.push({
      inventoryItemId: r.ingredientId,
      quantityRequired: num(r.quantityRequired),
    });
    recipeMap.set(r.menuItemId, list);
  }

  return items.map((m) => ({
    id: m.id,
    brandId: m.brandId,
    name: m.name,
    price: num(m.price),
    station: m.station,
    active: m.active,
    prepTimeMins: m.prepTimeMins,
    recipe: recipeMap.get(m.id) ?? [],
  }));
}

async function loadInventory(
  runner: QueryRunner,
  kitchenId?: string,
): Promise<InventoryItem[]> {
  const baseQuery = runner
    .select({
      kitchenId: schema.kitchenInventory.kitchenId,
      ingredientId: schema.kitchenInventory.ingredientId,
      currentStock: schema.kitchenInventory.currentStock,
      reorderThreshold: schema.kitchenInventory.reorderThreshold,
      lastRestocked: schema.kitchenInventory.lastRestocked,
      sku: schema.ingredients.sku,
      name: schema.ingredients.name,
      category: schema.ingredients.category,
      unit: schema.ingredients.unit,
      costPerUnit: schema.ingredients.costPerUnit,
      expectedYieldPct: schema.ingredients.expectedYieldPct,
      actualYieldPct: schema.ingredients.actualYieldPct,
    })
    .from(schema.kitchenInventory)
    .innerJoin(
      schema.ingredients,
      eq(schema.kitchenInventory.ingredientId, schema.ingredients.id),
    );

  const rows =
    kitchenId && kitchenId !== "ALL"
      ? await baseQuery
          .where(eq(schema.kitchenInventory.kitchenId, kitchenId))
          .orderBy(
            asc(schema.kitchenInventory.kitchenId),
            asc(schema.kitchenInventory.ingredientId),
          )
      : await baseQuery.orderBy(
          asc(schema.kitchenInventory.kitchenId),
          asc(schema.kitchenInventory.ingredientId),
        );

  return rows.map((row) => ({
    id: row.ingredientId,
    ingredientId: row.ingredientId,
    sku: row.sku,
    name: row.name,
    category: row.category,
    currentStock: num(row.currentStock),
    unit: row.unit,
    reorderThreshold: num(row.reorderThreshold),
    costPerUnit: num(row.costPerUnit),
    lastRestocked: row.lastRestocked.toISOString(),
    kitchenId: row.kitchenId,
    expectedYieldPct: row.expectedYieldPct ?? undefined,
    actualYieldPct: row.actualYieldPct ?? undefined,
  }));
}

async function loadOrders(
  runner: QueryRunner,
  orderId?: string,
): Promise<Order[]> {
  const orderRows = orderId
    ? await runner
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId))
    : await runner
        .select()
        .from(schema.orders)
        .orderBy(desc(schema.orders.createdAt));

  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((o) => o.id);
  const [itemRows, eventRows] = await Promise.all([
    runner
      .select()
      .from(schema.orderItems)
      .where(inArray(schema.orderItems.orderId, orderIds))
      .orderBy(asc(schema.orderItems.sortOrder), asc(schema.orderItems.id)),
    runner
      .select()
      .from(schema.orderEvents)
      .where(inArray(schema.orderEvents.orderId, orderIds))
      .orderBy(asc(schema.orderEvents.timestamp), asc(schema.orderEvents.id)),
  ]);

  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const item of itemRows) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push({
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      price: optNum(item.price),
      notes: item.notes ?? undefined,
      station: item.station,
    });
    itemsByOrder.set(item.orderId, list);
  }

  const eventsByOrder = new Map<string, OrderEvent[]>();
  for (const evt of eventRows) {
    const list = eventsByOrder.get(evt.orderId) ?? [];
    list.push({
      id: evt.id,
      type: evt.type,
      timestamp: evt.timestamp.toISOString(),
      actor: evt.actor,
      details: evt.details ?? undefined,
    });
    eventsByOrder.set(evt.orderId, list);
  }

  return orderRows.map((o) => ({
    id: o.id,
    organizationId: o.organizationId ?? DEFAULT_ORGANIZATION_ID,
    externalOrderId: o.externalOrderId ?? undefined,
    idempotencyKey: o.idempotencyKey ?? undefined,
    brandId: o.brandId,
    kitchenId: o.kitchenId,
    channel: o.channel,
    source: o.source,
    status: o.status,
    priority: o.priority ?? undefined,
    items: itemsByOrder.get(o.id) ?? [],
    totalAmount: optNum(o.totalAmount),
    itemCount: o.itemCount ?? undefined,
    notes: o.notes ?? undefined,
    customerName: o.customerName ?? undefined,
    driverName: o.driverName ?? undefined,
    courierEtaMins: o.courierEtaMins ?? undefined,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    receivedAt: iso(o.receivedAt),
    acceptedAt: iso(o.acceptedAt),
    prepStartedAt: iso(o.prepStartedAt),
    prepCompletedAt: iso(o.prepCompletedAt),
    readyAt: iso(o.readyAt),
    driverAssignedAt: iso(o.driverAssignedAt),
    pickedUpAt: iso(o.pickedUpAt),
    dispatchedAt: iso(o.dispatchedAt),
    cancelledAt: iso(o.cancelledAt),
    cancellationSource: o.cancellationSource ?? undefined,
    cancellationReason: o.cancellationReason ?? undefined,
    cancelledBy: o.cancelledBy ?? undefined,
    cancellationStage: o.cancellationStage ?? undefined,
    cancellationResolution: o.cancellationResolution ?? undefined,
    lossAmount: optNum(o.lossAmount),
    claimAmount: optNum(o.claimAmount),
    inventoryDecision: o.inventoryDecision ?? undefined,
    inventoryWarnings: o.inventoryWarnings ?? undefined,
    inventoryUnavailable: o.inventoryUnavailable ?? undefined,
    inventoryConsumed: o.inventoryConsumed,
    inventoryRestored: o.inventoryRestored,
    events: eventsByOrder.get(o.id) ?? [],
  }));
}

async function insertActivity(
  runner: QueryRunner,
  entry: Omit<OperationalActivity, "id" | "timestamp"> & {
    timestamp?: string;
  },
): Promise<OperationalActivity> {
  const id = makeId("ACT");
  const timestamp = entry.timestamp ?? new Date().toISOString();
  const organizationId = entry.organizationId ?? DEFAULT_ORGANIZATION_ID;
  await runner.insert(schema.activities).values({
    id,
    organizationId,
    type: entry.type,
    category: entry.category,
    title: entry.title,
    details: entry.details,
    actor: entry.actor,
    orderId: entry.orderId ?? null,
    kitchenId: entry.kitchenId ?? null,
    brandId: entry.brandId ?? null,
    timestamp: new Date(timestamp),
    severity: entry.severity,
  });
  return { ...entry, organizationId, id, timestamp };
}

async function loadSettings(runner: QueryRunner): Promise<SystemSettings> {
  const rows = await runner
    .select()
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.id, "default"))
    .limit(1);
  return mapSettingsRow(rows[0]);
}

// -----------------------------------------------------------------------------
// Public Read Operations
// -----------------------------------------------------------------------------

export async function getOrdersPg(): Promise<Order[]> {
  await ensureSeeded();
  return loadOrders(getDb());
}

export async function findOrderPg(orderId: string): Promise<Order | undefined> {
  await ensureSeeded();
  const rows = await loadOrders(getDb(), orderId);
  return rows[0];
}

export async function getInventoryPg(
  kitchenId?: string,
): Promise<InventoryItem[]> {
  await ensureSeeded();
  return loadInventory(getDb(), kitchenId);
}

export async function getInventoryMovementsPg(
  kitchenId?: string,
): Promise<InventoryMovement[]> {
  await ensureSeeded();
  const db = getDb();
  const rows =
    kitchenId && kitchenId !== "ALL"
      ? await db
          .select()
          .from(schema.inventoryMovements)
          .where(eq(schema.inventoryMovements.kitchenId, kitchenId))
          .orderBy(desc(schema.inventoryMovements.timestamp))
          .limit(300)
      : await db
          .select()
          .from(schema.inventoryMovements)
          .orderBy(desc(schema.inventoryMovements.timestamp))
          .limit(300);

  return rows.map((m) => ({
    id: m.id,
    inventoryItemId: m.ingredientId,
    itemName: m.itemName,
    sku: m.sku,
    kitchenId: m.kitchenId,
    type: m.type,
    quantity: num(m.quantity),
    previousStock: num(m.previousStock),
    newStock: num(m.newStock),
    unit: m.unit,
    costImpact: num(m.costImpact),
    orderId: m.orderId ?? undefined,
    transferGroupId: m.transferGroupId ?? undefined,
    actor: m.actor,
    reason: m.reason,
    timestamp: m.timestamp.toISOString(),
  }));
}

export async function getCancellationsPg(): Promise<CancellationRecord[]> {
  await ensureSeeded();
  const rows = await getDb()
    .select()
    .from(schema.cancellations)
    .orderBy(desc(schema.cancellations.timestamp));

  return rows.map((c) => ({
    id: c.id,
    orderId: c.orderId,
    brandId: c.brandId,
    kitchenId: c.kitchenId,
    channel: c.channel,
    stage: c.stage,
    previousStatus: c.previousStatus,
    resolution: c.resolution,
    source: c.source,
    reason: c.reason,
    actor: c.actor,
    timestamp: c.timestamp.toISOString(),
    financialLoss: num(c.financialLoss),
    claimAmount: num(c.claimAmount),
    restoredIngredients: c.restoredIngredients,
    lostIngredients: c.lostIngredients,
    dispatchEvidence: c.dispatchEvidence ?? undefined,
  }));
}

export async function getOrganizationsPg(): Promise<Organization[]> {
  await ensureSeeded();
  const rows = await getDb()
    .select()
    .from(schema.organizations)
    .orderBy(asc(schema.organizations.id));
  return rows.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    gstin: o.gstin ?? undefined,
    fssaiLicense: o.fssaiLicense ?? undefined,
    active: o.active,
    createdAt: o.createdAt.toISOString(),
  }));
}

export async function getActivitiesPg(): Promise<OperationalActivity[]> {
  await ensureSeeded();
  const rows = await getDb()
    .select()
    .from(schema.activities)
    .orderBy(desc(schema.activities.timestamp))
    .limit(200);

  return rows.map((a) => ({
    id: a.id,
    organizationId: a.organizationId ?? DEFAULT_ORGANIZATION_ID,
    type: a.type,
    category: a.category,
    title: a.title,
    details: a.details,
    actor: a.actor,
    orderId: a.orderId ?? undefined,
    kitchenId: a.kitchenId ?? undefined,
    brandId: a.brandId ?? undefined,
    timestamp: a.timestamp.toISOString(),
    severity: a.severity,
  }));
}

export async function getBrandsPg(): Promise<BrandConfig[]> {
  await ensureSeeded();
  const rows = await getDb()
    .select()
    .from(schema.brands)
    .orderBy(asc(schema.brands.id));
  return rows.map((b) => ({
    id: b.id,
    organizationId: b.organizationId ?? DEFAULT_ORGANIZATION_ID,
    name: b.name,
    code: b.code,
    active: b.active,
    colorTheme: b.colorTheme,
    tagline: b.tagline,
    cuisine: b.cuisine,
  }));
}

export async function getKitchensPg(): Promise<KitchenConfig[]> {
  await ensureSeeded();
  const rows = await getDb()
    .select()
    .from(schema.kitchens)
    .orderBy(asc(schema.kitchens.id));
  return rows.map((k) => ({
    id: k.id,
    organizationId: k.organizationId ?? DEFAULT_ORGANIZATION_ID,
    name: k.name,
    code: k.code,
    location: k.location,
    areaCode: k.areaCode,
    active: k.active,
    timezone: k.timezone,
    capacityPerHour: k.capacityPerHour,
  }));
}

export async function getBrandKitchensPg(): Promise<BrandKitchenConfig[]> {
  await ensureSeeded();
  const rows = await getDb()
    .select()
    .from(schema.brandKitchens)
    .orderBy(asc(schema.brandKitchens.kitchenId), asc(schema.brandKitchens.brandId));
  return rows.map((bk) => ({
    brandId: bk.brandId,
    kitchenId: bk.kitchenId,
    active: bk.active,
  }));
}

export async function getMenuCatalogPg(): Promise<MenuItem[]> {
  await ensureSeeded();
  return loadMenuCatalog(getDb());
}

export async function getEmployeesPg(): Promise<Employee[]> {
  await ensureSeeded();
  const rows = await getDb()
    .select()
    .from(schema.employees)
    .orderBy(asc(schema.employees.id));
  return rows.map((e) => ({
    id: e.id,
    organizationId: e.organizationId ?? DEFAULT_ORGANIZATION_ID,
    employeeCode: e.employeeCode,
    name: e.name,
    role: e.role,
    kitchenId: e.kitchenId ?? undefined,
    email: e.email ?? undefined,
    phone: e.phone ?? undefined,
    authUserId: e.authUserId ?? undefined,
    active: e.active,
  }));
}

export async function getSettingsPg(): Promise<SystemSettings> {
  await ensureSeeded();
  return loadSettings(getDb());
}

export async function getFilesPg(): Promise<VirtualFileAsset[]> {
  await ensureSeeded();
  const rows = await getDb()
    .select()
    .from(schema.virtualFiles)
    .orderBy(desc(schema.virtualFiles.updatedAt));
  return rows.map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category,
    size: f.size,
    mimeType: f.mimeType,
    kitchenId: f.kitchenId ?? undefined,
    brandId: f.brandId ?? undefined,
    uploadedBy: f.uploadedBy,
    updatedAt: f.updatedAt.toISOString(),
    status: f.status,
    content: f.content,
  }));
}

export async function getLeakageVectorsPg(): Promise<RevenueLeakageVector[]> {
  await ensureSeeded();
  const rows = await getDb()
    .select()
    .from(schema.leakageVectors)
    .orderBy(asc(schema.leakageVectors.id));
  return rows.map((l) => ({
    id: l.id,
    vector: l.vector,
    signature: l.signature,
    impactLevel: l.impactLevel,
    impactNote: l.impactNote,
    potentialRevenue: num(l.potentialRevenue),
    actualCollected: num(l.actualCollected),
    leakedAmount: num(l.leakedAmount),
    affectedAccounts: l.affectedAccounts,
    status: l.status,
  }));
}

export async function getWebhookEventsPg(): Promise<WebhookIdempotencyEntry[]> {
  await ensureSeeded();
  const rows = await getDb()
    .select()
    .from(schema.webhookEvents)
    .orderBy(desc(schema.webhookEvents.createdAt))
    .limit(200);
  return rows.map((w) => ({
    idempotencyKey: w.idempotencyKey,
    orderId: w.orderId ?? "",
    status: w.status,
    channel: w.channel,
    brandId: w.brandId,
    kitchenId: w.kitchenId,
    payloadSummary: w.payloadSummary,
    createdAt: w.createdAt.toISOString(),
    hitCount: w.hitCount,
  }));
}

export async function getOutboxEventsPg(): Promise<OutboxEvent[]> {
  await ensureSeeded();
  const rows = await getDb()
    .select()
    .from(schema.outboxEvents)
    .orderBy(desc(schema.outboxEvents.createdAt))
    .limit(200);
  return rows.map((o) => ({
    id: o.id,
    eventType: o.eventType,
    aggregateId: o.aggregateId,
    payload: o.payload,
    attempt: o.attempt,
    maxAttempts: o.maxAttempts,
    backoffSchedule: o.backoffSchedule,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
  }));
}

export async function getStoreSnapshotPg(): Promise<StoreSnapshot> {
  await ensureSeeded();
  const [
    organizations,
    orders,
    inventory,
    inventoryMovements,
    cancellations,
    activities,
    brands,
    kitchens,
    brandKitchens,
    menuCatalog,
    employees,
    webhookEvents,
    outboxEvents,
    leakageVectors,
    files,
    settings,
  ] = await Promise.all([
    getOrganizationsPg(),
    getOrdersPg(),
    getInventoryPg(),
    getInventoryMovementsPg(),
    getCancellationsPg(),
    getActivitiesPg(),
    getBrandsPg(),
    getKitchensPg(),
    getBrandKitchensPg(),
    getMenuCatalogPg(),
    getEmployeesPg(),
    getWebhookEventsPg(),
    getOutboxEventsPg(),
    getLeakageVectorsPg(),
    getFilesPg(),
    getSettingsPg(),
  ]);

  return {
    organizations,
    orders,
    inventory,
    inventoryMovements,
    cancellations,
    activities,
    brands,
    kitchens,
    brandKitchens,
    menuCatalog,
    employees,
    webhookEvents,
    outboxEvents,
    leakageVectors,
    files,
    settings,
  };
}

// -----------------------------------------------------------------------------
// Lifecycle Reset / Clear / Activity
// -----------------------------------------------------------------------------

export async function resetStorePg(): Promise<void> {
  const db = getDb();
  await resetDatabaseToSeed(db);
  globalThis.__darkit_pg_seed_promise__ = Promise.resolve();
}

export async function clearOrdersStorePg(): Promise<void> {
  await ensureSeeded();
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(schema.cancellations);
    await tx.delete(schema.orderEvents);
    await tx.delete(schema.orderItems);
    await tx.delete(schema.orders);
    await tx.delete(schema.webhookEvents);
    await tx.delete(schema.outboxEvents);
    await insertActivity(tx, {
      type: "STORE_CLEARED",
      category: "SYSTEM",
      title: "Active Order Queue Cleared",
      details:
        "All orders, cancellations, webhook receipts, and outbox items cleared to demonstrate honest empty states across stations.",
      actor: "SYSTEM",
      severity: "warning",
    });
  });
}

export async function recordActivityPg(
  entry: Omit<OperationalActivity, "id" | "timestamp"> & {
    timestamp?: string;
  },
): Promise<OperationalActivity> {
  await ensureSeeded();
  return insertActivity(getDb(), entry);
}

// -----------------------------------------------------------------------------
// Order Injection (Two-Phase Atomic Webhook Idempotency + Per-Kitchen Intake Check)
// -----------------------------------------------------------------------------

export async function injectCanonicalOrderPg(
  input: InjectOrderInput,
): Promise<InjectOrderResult> {
  await ensureSeeded();
  const db = getDb();

  return db.transaction(async (tx) => {
    const nowDate = new Date();
    const now = nowDate.toISOString();

    // 1. Validate Brand
    const [brand] = await tx
      .select()
      .from(schema.brands)
      .where(
        and(eq(schema.brands.id, input.brandId), eq(schema.brands.active, true)),
      )
      .limit(1);
    if (!brand) {
      throw new Error(`Invalid or inactive virtual brand: ${input.brandId}`);
    }

    // 2. Validate Kitchen
    const [kitchen] = await tx
      .select()
      .from(schema.kitchens)
      .where(
        and(
          eq(schema.kitchens.id, input.kitchenId),
          eq(schema.kitchens.active, true),
        ),
      )
      .limit(1);
    if (!kitchen) {
      throw new Error(
        `Invalid or inactive physical kitchen: ${input.kitchenId}`,
      );
    }

    // 3. Enforce Canonical BrandKitchen Mapping
    const [mapping] = await tx
      .select()
      .from(schema.brandKitchens)
      .where(
        and(
          eq(schema.brandKitchens.brandId, input.brandId),
          eq(schema.brandKitchens.kitchenId, input.kitchenId),
          eq(schema.brandKitchens.active, true),
        ),
      )
      .limit(1);
    if (!mapping) {
      throw new Error(
        `BrandKitchen violation: ${input.brandId} is not authorized to operate out of kitchen ${input.kitchenId}.`,
      );
    }

    // 4. Validate Order Items against Menu Catalog BEFORE claiming idempotency key
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new Error("Order must contain at least one menu item.");
    }

    const menuCatalog = await loadMenuCatalog(tx);
    const channel: OrderChannel = CHANNEL_SOURCE_MAP[input.channel]
      ? input.channel
      : "Direct Web";
    const settings = await loadSettings(tx);

    // Pre-validate items so malformed payloads do not consume an idempotency key
    const validatedItems = input.items.map((raw) => {
      const menu = menuCatalog.find(
        (m) => m.id === raw.menuItemId || m.name === raw.name,
      );
      if (!menu) {
        throw new Error(
          `Menu item not found in catalog: ${raw.menuItemId || raw.name}`,
        );
      }
      if (menu.brandId !== input.brandId) {
        throw new Error(
          `Menu item ${menu.name} belongs to ${menu.brandId}, not ${input.brandId}.`,
        );
      }
      const qty = Math.max(1, Math.floor(Number(raw.quantity) || 1));
      return { raw, menu, qty };
    });

    // 5. Determine Order ID & Two-Phase Atomic Webhook Deduplication
    let orderId = input.id?.trim();
    const rawIdemKey = input.idempotencyKey?.trim();

    if (rawIdemKey) {
      // Phase 1: Atomically attempt to claim idempotency key (`ON CONFLICT DO NOTHING`)
      // Concurrent duplicates block on the unique PK until the first tx commits,
      // then receive 0 inserted rows and cleanly fall through to the replay branch.
      const claimed = await tx
        .insert(schema.webhookEvents)
        .values({
          idempotencyKey: rawIdemKey,
          orderId: null,
          status: "processing",
          channel,
          brandId: input.brandId,
          kitchenId: input.kitchenId,
          payloadSummary: `${input.brandId} • ${validatedItems.length} item(s)`,
          createdAt: nowDate,
          hitCount: 1,
        })
        .onConflictDoNothing()
        .returning({ idempotencyKey: schema.webhookEvents.idempotencyKey });

      if (claimed.length === 0) {
        // Lock & increment existing webhook receipt
        const [existingWebhook] = await tx
          .update(schema.webhookEvents)
          .set({ hitCount: sql`${schema.webhookEvents.hitCount} + 1` })
          .where(eq(schema.webhookEvents.idempotencyKey, rawIdemKey))
          .returning();

        const existingOrderId = existingWebhook?.orderId;
        if (existingOrderId) {
          const [existingOrder] = await loadOrders(tx, existingOrderId);
          if (existingOrder) {
            await insertActivity(tx, {
              type: "WEBHOOK_DEDUPLICATED",
              category: "CLOUD7",
              title: `Idempotent Replay Blocked (${rawIdemKey})`,
              details: `Duplicate webhook payload intercepted via ON CONFLICT DO NOTHING. Returned cached order ${existingOrder.id} (Hit #${existingWebhook.hitCount}).`,
              actor: input.actor,
              orderId: existingOrder.id,
              kitchenId: existingOrder.kitchenId,
              brandId: existingOrder.brandId,
              severity: "warning",
            });

            return {
              order: existingOrder,
              idempotentReplay: true,
              inventoryDecision: existingOrder.inventoryDecision ?? "AVAILABLE",
              inventoryWarnings: existingOrder.inventoryWarnings ?? [],
              inventoryUnavailable: existingOrder.inventoryUnavailable ?? [],
            };
          }
        }
        throw new Error(
          `Idempotency key already claimed without an associated order: ${rawIdemKey}`,
        );
      }
    }

    if (orderId) {
      const existingById = await tx
        .select({ id: schema.orders.id })
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId))
        .limit(1);
      if (existingById.length > 0) {
        throw new Error(`Order ID already exists: ${orderId}`);
      }
    } else {
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const suffix = Math.floor(1000 + Math.random() * 9000);
        const candidate =
          attempt < 15
            ? `ORD-${suffix}`
            : `ORD-${Date.now().toString().slice(-6)}-${suffix}`;
        const collision = await tx
          .select({ id: schema.orders.id })
          .from(schema.orders)
          .where(eq(schema.orders.id, candidate))
          .limit(1);
        if (collision.length === 0) {
          orderId = candidate;
          break;
        }
      }
      if (!orderId) {
        orderId = `ORD-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      }
    }

    const effectiveIdemKey = rawIdemKey || `idem-${orderId.toLowerCase()}`;

    const resolvedItems: OrderItem[] = validatedItems.map(
      ({ raw, menu, qty }, idx) => ({
        id: raw.id || `${orderId}-ITEM-${idx + 1}`,
        menuItemId: menu.id,
        name: menu.name,
        quantity: qty,
        price: menu.price,
        notes: raw.notes?.trim() || input.notes?.trim() || undefined,
        station: menu.station,
      }),
    );

    const totalAmount = calculateOrderTotalAmount(resolvedItems, menuCatalog);
    const itemCount = resolvedItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    const resolvedOrganizationId =
      input.organizationId?.trim() ||
      kitchen.organizationId ||
      DEFAULT_ORGANIZATION_ID;

    const draftOrder: Order = {
      id: orderId,
      organizationId: resolvedOrganizationId,
      externalOrderId:
        input.externalOrderId ||
        `${channel.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
      idempotencyKey: effectiveIdemKey,
      brandId: input.brandId,
      kitchenId: input.kitchenId,
      channel,
      source: input.source || CHANNEL_SOURCE_MAP[channel] || "MANUAL",
      status: "PENDING",
      priority: input.priority || "NORMAL",
      items: resolvedItems,
      totalAmount,
      itemCount,
      notes: input.notes?.trim() || undefined,
      customerName:
        input.customerName?.trim() || "Walk-In / Aggregator Guest",
      createdAt: now,
      updatedAt: now,
      receivedAt: now,
      inventoryConsumed: false,
      events: [],
    };

    // 6. Evaluate Inventory Availability Strictly Against This Order's Kitchen
    const kitchenStock = await loadInventory(tx, input.kitchenId);
    const evaluation = evaluateOrderInventory(
      draftOrder,
      kitchenStock,
      menuCatalog,
    );

    draftOrder.inventoryDecision = evaluation.inventoryDecision;
    draftOrder.inventoryWarnings =
      evaluation.lowStockItems.length > 0
        ? evaluation.lowStockItems
        : undefined;
    draftOrder.inventoryUnavailable =
      evaluation.insufficientStockItems.length > 0
        ? evaluation.insufficientStockItems
        : undefined;

    const events: OrderEvent[] = [
      {
        id: `${orderId}-EVT-1`,
        type: "RECEIVED",
        timestamp: now,
        actor: input.actor,
        details: `Order injected via ${channel} for ${input.brandId} at ${kitchen.name}.`,
      },
      {
        id: `${orderId}-EVT-2`,
        type: "INVENTORY_CHECKED",
        timestamp: now,
        actor: "SYSTEM",
        details: `Inventory evaluation (${input.kitchenId}): ${evaluation.inventoryDecision}.`,
      },
    ];

    if (evaluation.lowStockItems.length > 0) {
      events.push({
        id: `${orderId}-EVT-LOW`,
        type: "INVENTORY_WARNING",
        timestamp: now,
        actor: "SYSTEM",
        details: `Low stock warning at ${input.kitchenId} for: ${evaluation.lowStockItems.join(", ")}.`,
      });
    }

    if (evaluation.insufficientStockItems.length > 0) {
      events.push({
        id: `${orderId}-EVT-UNAVAIL`,
        type: "INVENTORY_UNAVAILABLE",
        timestamp: now,
        actor: "SYSTEM",
        details: `Insufficient stock at ${input.kitchenId} for: ${evaluation.insufficientStockItems.join(", ")}.`,
      });
    }

    draftOrder.events = events;

    // 7. Persist Order, OrderItems, OrderEvents, Phase 2 Webhook Receipt, Outbox, Activity
    await tx.insert(schema.orders).values({
      id: draftOrder.id,
      organizationId: resolvedOrganizationId,
      externalOrderId: draftOrder.externalOrderId ?? null,
      idempotencyKey: effectiveIdemKey,
      brandId: draftOrder.brandId,
      kitchenId: draftOrder.kitchenId,
      channel: draftOrder.channel,
      source: draftOrder.source,
      status: draftOrder.status,
      priority: draftOrder.priority ?? null,
      totalAmount: round2(totalAmount).toFixed(2),
      itemCount,
      notes: draftOrder.notes ?? null,
      customerName: draftOrder.customerName ?? null,
      driverName: null,
      courierEtaMins: null,
      createdAt: nowDate,
      updatedAt: nowDate,
      receivedAt: nowDate,
      acceptedAt: null,
      prepStartedAt: null,
      prepCompletedAt: null,
      readyAt: null,
      driverAssignedAt: null,
      pickedUpAt: null,
      dispatchedAt: null,
      cancelledAt: null,
      cancellationSource: null,
      cancellationReason: null,
      cancelledBy: null,
      cancellationStage: null,
      cancellationResolution: null,
      lossAmount: null,
      claimAmount: null,
      inventoryDecision: evaluation.inventoryDecision,
      inventoryWarnings: draftOrder.inventoryWarnings ?? null,
      inventoryUnavailable: draftOrder.inventoryUnavailable ?? null,
      inventoryConsumed: false,
      inventoryRestored: false,
    });

    await tx.insert(schema.orderItems).values(
      resolvedItems.map((item, idx) => ({
        id: item.id,
        orderId: draftOrder.id,
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        price:
          typeof item.price === "number" ? round2(item.price).toFixed(2) : null,
        notes: item.notes ?? null,
        station: item.station,
        sortOrder: idx,
      })),
    );

    await tx.insert(schema.orderEvents).values(
      events.map((evt) => ({
        id: evt.id,
        orderId: draftOrder.id,
        type: evt.type,
        timestamp: new Date(evt.timestamp),
        actor: evt.actor,
        details: evt.details ?? null,
      })),
    );

    const payloadSummary = `${draftOrder.brandId} • ${itemCount} item(s) • ${formatCurrency(totalAmount, settings.currency)}`;

    if (rawIdemKey) {
      // Phase 2: Mark claimed webhook row as completed with orderId
      await tx
        .update(schema.webhookEvents)
        .set({
          orderId: draftOrder.id,
          status: "completed",
          payloadSummary,
        })
        .where(eq(schema.webhookEvents.idempotencyKey, rawIdemKey));
    } else {
      await tx
        .insert(schema.webhookEvents)
        .values({
          idempotencyKey: effectiveIdemKey,
          orderId: draftOrder.id,
          status: "completed",
          channel: draftOrder.channel,
          brandId: draftOrder.brandId,
          kitchenId: draftOrder.kitchenId,
          payloadSummary,
          createdAt: nowDate,
          hitCount: 1,
        })
        .onConflictDoNothing();
    }

    await tx.insert(schema.outboxEvents).values({
      id: makeId("OUT"),
      eventType: "aggregator.order.created",
      aggregateId: draftOrder.id,
      payload: JSON.stringify({
        orderId: draftOrder.id,
        brandId: draftOrder.brandId,
        kitchenId: draftOrder.kitchenId,
        inventoryDecision: evaluation.inventoryDecision,
      }),
      attempt: 1,
      maxAttempts: 6,
      backoffSchedule: "Immediate (0s)",
      status: "DELIVERED",
      createdAt: nowDate,
    });

    await insertActivity(tx, {
      organizationId: resolvedOrganizationId,
      type: "ORDER_CREATED",
      category: "ORDER",
      title: `Order ${draftOrder.id} Injected (${draftOrder.brandId})`,
      details: `${itemCount} item(s) (${formatCurrency(totalAmount, settings.currency)}) via ${draftOrder.channel} → ${kitchen.name} (${evaluation.inventoryDecision}).`,
      actor: input.actor,
      orderId: draftOrder.id,
      kitchenId: draftOrder.kitchenId,
      brandId: draftOrder.brandId,
      timestamp: now,
      severity:
        evaluation.inventoryDecision === "INSUFFICIENT_STOCK"
          ? "error"
          : evaluation.inventoryDecision === "LOW_STOCK"
            ? "warning"
            : "success",
    });

    return {
      order: draftOrder,
      idempotentReplay: false,
      inventoryDecision: evaluation.inventoryDecision,
      inventoryWarnings: evaluation.lowStockItems,
      inventoryUnavailable: evaluation.insufficientStockItems,
    };
  });
}

// -----------------------------------------------------------------------------
// Order Status Transitions (Row-Level Sorted FOR UPDATE Locking + Stage-Aware Cancel)
// -----------------------------------------------------------------------------

interface LockedKitchenStockRow {
  kitchenId: string;
  ingredientId: string;
  currentStock: number;
  reorderThreshold: number;
  lastRestocked: Date;
  sku: string;
  name: string;
  unit: InventoryItem["unit"];
  costPerUnit: number;
}

async function lockKitchenInventoryRows(
  tx: PgTx,
  kitchenId: string,
  ingredientIds: string[],
): Promise<Map<string, LockedKitchenStockRow>> {
  const sortedIds = Array.from(new Set(ingredientIds)).sort();
  if (sortedIds.length === 0) return new Map();

  // Lock kitchen_inventory rows in deterministic ascending ingredient_id order
  const lockedStock = await tx
    .select()
    .from(schema.kitchenInventory)
    .where(
      and(
        eq(schema.kitchenInventory.kitchenId, kitchenId),
        inArray(schema.kitchenInventory.ingredientId, sortedIds),
      ),
    )
    .orderBy(asc(schema.kitchenInventory.ingredientId))
    .for("update");

  const metaRows = await tx
    .select()
    .from(schema.ingredients)
    .where(inArray(schema.ingredients.id, sortedIds));

  const metaMap = new Map(metaRows.map((m) => [m.id, m]));
  const result = new Map<string, LockedKitchenStockRow>();

  for (const row of lockedStock) {
    const meta = metaMap.get(row.ingredientId);
    if (!meta) continue;
    result.set(row.ingredientId, {
      kitchenId: row.kitchenId,
      ingredientId: row.ingredientId,
      currentStock: num(row.currentStock),
      reorderThreshold: num(row.reorderThreshold),
      lastRestocked: row.lastRestocked,
      sku: meta.sku,
      name: meta.name,
      unit: meta.unit,
      costPerUnit: num(meta.costPerUnit),
    });
  }

  return result;
}

export async function transitionCanonicalOrderPg(
  input: TransitionOrderInput,
): Promise<TransitionOrderResult> {
  await ensureSeeded();
  const db = getDb();

  let blockedInsufficientStock: string[] | null = null;

  const result = await db.transaction(async (tx) => {
    // 1. Lock the order row exclusively
    const lockedOrders = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, input.orderId))
      .for("update");

    if (lockedOrders.length === 0) {
      throw new Error(`Order not found: ${input.orderId}`);
    }

    const [currentOrder] = await loadOrders(tx, input.orderId);
    const nowDate = new Date();
    const now = nowDate.toISOString();

    // 2. Idempotent replay when already in requested status
    if (currentOrder.status === input.nextStatus) {
      let existingCancel: CancellationRecord | undefined;
      if (input.nextStatus === "CANCELLED") {
        const [c] = await tx
          .select()
          .from(schema.cancellations)
          .where(eq(schema.cancellations.orderId, currentOrder.id))
          .limit(1);
        if (c) {
          existingCancel = {
            id: c.id,
            orderId: c.orderId,
            brandId: c.brandId,
            kitchenId: c.kitchenId,
            channel: c.channel,
            stage: c.stage,
            previousStatus: c.previousStatus,
            resolution: c.resolution,
            source: c.source,
            reason: c.reason,
            actor: c.actor,
            timestamp: c.timestamp.toISOString(),
            financialLoss: num(c.financialLoss),
            claimAmount: num(c.claimAmount),
            restoredIngredients: c.restoredIngredients,
            lostIngredients: c.lostIngredients,
            dispatchEvidence: c.dispatchEvidence ?? undefined,
          };
        }
      }
      return {
        order: currentOrder,
        idempotentReplay: true,
        cancellationRecord: existingCancel,
      };
    }

    const allowed = VALID_ORDER_TRANSITIONS[currentOrder.status] ?? [];
    if (!allowed.includes(input.nextStatus)) {
      throw new Error(
        `Invalid status transition: ${currentOrder.status} -> ${input.nextStatus}`,
      );
    }

    const menuCatalog = await loadMenuCatalog(tx);

    // 3. Stage-Aware Cancellation Branch
    if (input.nextStatus === "CANCELLED") {
      return executeStageAwareCancellationPg(
        tx,
        currentOrder,
        menuCatalog,
        input,
        nowDate,
        now,
      );
    }

    let depletedItems: string[] = [];
    let lowStockAlerts: string[] = [];

    // 4. Atomic Recipe Depletion on PENDING -> PREPARING
    if (input.nextStatus === "PREPARING") {
      if (!currentOrder.inventoryConsumed) {
        const requirements = getRequiredIngredients(currentOrder, menuCatalog);
        const sortedIds = Array.from(requirements.keys()).sort();
        const lockedMap = await lockKitchenInventoryRows(
          tx,
          currentOrder.kitchenId,
          sortedIds,
        );

        const insufficient: string[] = [];
        for (const ingredientId of sortedIds) {
          const reqQty = requirements.get(ingredientId) ?? 0;
          if (reqQty <= 0) continue;
          const row = lockedMap.get(ingredientId);
          if (!row) {
            insufficient.push(ingredientId);
          } else if (row.currentStock < reqQty) {
            insufficient.push(row.name);
          }
        }

        if (insufficient.length > 0) {
          // Persist INVENTORY_UNAVAILABLE audit trail & order decision cleanly before throwing
          await tx
            .update(schema.orders)
            .set({
              inventoryDecision: "INSUFFICIENT_STOCK",
              inventoryUnavailable: insufficient,
              updatedAt: nowDate,
            })
            .where(eq(schema.orders.id, currentOrder.id));

          await tx.insert(schema.orderEvents).values({
            id: makeId(`${currentOrder.id}-EVT`),
            orderId: currentOrder.id,
            type: "INVENTORY_UNAVAILABLE",
            timestamp: nowDate,
            actor: input.actor,
            details: `Preparation blocked at ${currentOrder.kitchenId} due to insufficient stock: ${insufficient.join(", ")}`,
          });

          await insertActivity(tx, {
            type: "INVENTORY_BLOCKED",
            category: "INVENTORY",
            title: `${currentOrder.id} Prep Blocked (Out of Stock)`,
            details: `Insufficient inventory at ${currentOrder.kitchenId} prevented PENDING -> PREPARING: ${insufficient.join(", ")}.`,
            actor: input.actor,
            orderId: currentOrder.id,
            kitchenId: currentOrder.kitchenId,
            brandId: currentOrder.brandId,
            timestamp: now,
            severity: "error",
          });

          blockedInsufficientStock = insufficient;
          const [refreshed] = await loadOrders(tx, currentOrder.id);
          return {
            order: refreshed,
            idempotentReplay: false,
          };
        }

        // All ingredients available under FOR UPDATE lock -> deduct atomically!
        for (const ingredientId of sortedIds) {
          const reqQty = requirements.get(ingredientId) ?? 0;
          if (reqQty <= 0) continue;
          const row = lockedMap.get(ingredientId)!;
          const nextStock = round4(row.currentStock - reqQty);

          await tx
            .update(schema.kitchenInventory)
            .set({ currentStock: nextStock.toFixed(4) })
            .where(
              and(
                eq(schema.kitchenInventory.kitchenId, currentOrder.kitchenId),
                eq(schema.kitchenInventory.ingredientId, ingredientId),
              ),
            );

          await tx.insert(schema.inventoryMovements).values({
            id: makeId("MOV"),
            kitchenId: currentOrder.kitchenId,
            ingredientId: row.ingredientId,
            itemName: row.name,
            sku: row.sku,
            type: "SALE_CONSUMPTION",
            quantity: (-reqQty).toFixed(4),
            previousStock: row.currentStock.toFixed(4),
            newStock: nextStock.toFixed(4),
            unit: row.unit,
            costImpact: round2(reqQty * row.costPerUnit).toFixed(2),
            orderId: currentOrder.id,
            transferGroupId: null,
            actor: input.actor,
            reason: `Recipe consumption on PENDING -> PREPARING for ${currentOrder.id} (${currentOrder.kitchenId})`,
            timestamp: nowDate,
          });

          depletedItems.push(row.name);
          if (nextStock <= row.reorderThreshold) {
            lowStockAlerts.push(row.name);
          }
        }

        currentOrder.inventoryConsumed = true;
        currentOrder.inventoryDecision =
          lowStockAlerts.length > 0 ? "LOW_STOCK" : "AVAILABLE";
        currentOrder.inventoryWarnings =
          lowStockAlerts.length > 0
            ? lowStockAlerts
            : currentOrder.inventoryWarnings;
        currentOrder.inventoryUnavailable = undefined;
      }

      currentOrder.prepStartedAt = currentOrder.prepStartedAt ?? now;
      currentOrder.acceptedAt = currentOrder.acceptedAt ?? now;
    }

    if (input.nextStatus === "READY_FOR_PICKUP") {
      currentOrder.prepCompletedAt = currentOrder.prepCompletedAt ?? now;
      currentOrder.readyAt = currentOrder.readyAt ?? now;
    }

    if (input.nextStatus === "DRIVER_ASSIGNED") {
      currentOrder.driverAssignedAt = currentOrder.driverAssignedAt ?? now;
      if (input.driverName?.trim()) {
        currentOrder.driverName = input.driverName.trim();
      } else if (!currentOrder.driverName) {
        currentOrder.driverName = "Assigned Fleet Courier";
      }
      if (typeof input.courierEtaMins === "number") {
        currentOrder.courierEtaMins = input.courierEtaMins;
      } else if (typeof currentOrder.courierEtaMins !== "number") {
        currentOrder.courierEtaMins = 12;
      }
    }

    if (input.nextStatus === "PICKED_UP") {
      currentOrder.pickedUpAt = currentOrder.pickedUpAt ?? now;
      currentOrder.courierEtaMins = 0;
    }

    if (input.nextStatus === "DISPATCHED") {
      currentOrder.dispatchedAt = currentOrder.dispatchedAt ?? now;
    }

    const previousStatus = currentOrder.status;

    await tx
      .update(schema.orders)
      .set({
        status: input.nextStatus,
        updatedAt: nowDate,
        acceptedAt: currentOrder.acceptedAt
          ? new Date(currentOrder.acceptedAt)
          : null,
        prepStartedAt: currentOrder.prepStartedAt
          ? new Date(currentOrder.prepStartedAt)
          : null,
        prepCompletedAt: currentOrder.prepCompletedAt
          ? new Date(currentOrder.prepCompletedAt)
          : null,
        readyAt: currentOrder.readyAt ? new Date(currentOrder.readyAt) : null,
        driverAssignedAt: currentOrder.driverAssignedAt
          ? new Date(currentOrder.driverAssignedAt)
          : null,
        pickedUpAt: currentOrder.pickedUpAt
          ? new Date(currentOrder.pickedUpAt)
          : null,
        dispatchedAt: currentOrder.dispatchedAt
          ? new Date(currentOrder.dispatchedAt)
          : null,
        driverName: currentOrder.driverName ?? null,
        courierEtaMins:
          typeof currentOrder.courierEtaMins === "number"
            ? currentOrder.courierEtaMins
            : null,
        inventoryConsumed: Boolean(currentOrder.inventoryConsumed),
        inventoryDecision: currentOrder.inventoryDecision ?? null,
        inventoryWarnings: currentOrder.inventoryWarnings ?? null,
        inventoryUnavailable: currentOrder.inventoryUnavailable ?? null,
      })
      .where(eq(schema.orders.id, currentOrder.id));

    const eventDetails =
      input.nextStatus === "PREPARING"
        ? `Preparation started (${previousStatus} -> PREPARING) at ${currentOrder.kitchenId}. Depleted: ${depletedItems.join(", ") || "No raw recipe items"}.`
        : input.nextStatus === "DRIVER_ASSIGNED"
          ? `Driver ${currentOrder.driverName} assigned (ETA ${currentOrder.courierEtaMins}m).`
          : `Order transitioned ${previousStatus} -> ${input.nextStatus}.`;

    await tx.insert(schema.orderEvents).values({
      id: makeId(`${currentOrder.id}-EVT`),
      orderId: currentOrder.id,
      type: input.nextStatus === "PENDING" ? "RECEIVED" : input.nextStatus,
      timestamp: nowDate,
      actor: input.actor,
      details: eventDetails,
    });

    if (lowStockAlerts.length > 0) {
      await tx.insert(schema.orderEvents).values({
        id: makeId(`${currentOrder.id}-WARN`),
        orderId: currentOrder.id,
        type: "INVENTORY_WARNING",
        timestamp: nowDate,
        actor: "SYSTEM",
        details: `Reorder threshold breached at ${currentOrder.kitchenId} for: ${lowStockAlerts.join(", ")}.`,
      });
    }

    await insertActivity(tx, {
      type: `ORDER_${input.nextStatus}`,
      category:
        input.nextStatus === "DRIVER_ASSIGNED" ||
        input.nextStatus === "PICKED_UP" ||
        input.nextStatus === "DISPATCHED"
          ? "DISPATCH"
          : "ORDER",
      title: `${currentOrder.id} → ${input.nextStatus.replaceAll("_", " ")}`,
      details: eventDetails,
      actor: input.actor,
      orderId: currentOrder.id,
      kitchenId: currentOrder.kitchenId,
      brandId: currentOrder.brandId,
      timestamp: now,
      severity: lowStockAlerts.length > 0 ? "warning" : "info",
    });

    const [updatedOrder] = await loadOrders(tx, currentOrder.id);

    return {
      order: updatedOrder,
      idempotentReplay: false,
      depletedItems,
      lowStockAlerts,
    };
  });

  if (blockedInsufficientStock !== null) {
    throw new Error(
      `Insufficient inventory for preparation: ${(blockedInsufficientStock as string[]).join(", ")}`,
    );
  }

  return result;
}

async function executeStageAwareCancellationPg(
  tx: PgTx,
  currentOrder: Order,
  menuCatalog: MenuItem[],
  input: TransitionOrderInput,
  nowDate: Date,
  now: string,
): Promise<TransitionOrderResult> {
  const previousStatus = currentOrder.status;
  const requirements = getRequiredIngredients(currentOrder, menuCatalog);
  const sortedIds = Array.from(requirements.keys()).sort();
  const kitchenStock = await loadInventory(tx, currentOrder.kitchenId);
  const settings = await loadSettings(tx);

  const recipeCost = calculateOrderRecipeCost(
    currentOrder,
    kitchenStock,
    menuCatalog,
  );
  const orderValue =
    currentOrder.totalAmount ??
    calculateOrderTotalAmount(currentOrder.items, menuCatalog);

  let stage: CancellationStage = "BEFORE_PREP";
  let resolution: CancellationResolution = "INVENTORY_RESTORED";
  let financialLoss = 0;
  let claimAmount = 0;
  let inventoryRestored = Boolean(currentOrder.inventoryRestored);
  const restoredIngredients: CancellationRecord["restoredIngredients"] = [];
  const lostIngredients: CancellationRecord["lostIngredients"] = [];

  const shouldRestorePrePrep = input.restoreInventoryOnPrePrepCancel !== false;

  if (previousStatus === "PENDING") {
    stage = "BEFORE_PREP";
    if (currentOrder.inventoryConsumed) {
      const lockedMap = await lockKitchenInventoryRows(
        tx,
        currentOrder.kitchenId,
        sortedIds,
      );
      if (shouldRestorePrePrep) {
        resolution = "INVENTORY_RESTORED";
        for (const invId of sortedIds) {
          const qty = requirements.get(invId) ?? 0;
          const row = lockedMap.get(invId);
          if (row && qty > 0) {
            const nextStock = round4(row.currentStock + qty);
            await tx
              .update(schema.kitchenInventory)
              .set({ currentStock: nextStock.toFixed(4) })
              .where(
                and(
                  eq(schema.kitchenInventory.kitchenId, currentOrder.kitchenId),
                  eq(schema.kitchenInventory.ingredientId, invId),
                ),
              );
            restoredIngredients.push({
              inventoryItemId: row.ingredientId,
              name: row.name,
              quantity: qty,
            });
            await tx.insert(schema.inventoryMovements).values({
              id: makeId("MOV"),
              kitchenId: currentOrder.kitchenId,
              ingredientId: row.ingredientId,
              itemName: row.name,
              sku: row.sku,
              type: "CANCELLATION_RESTORE",
              quantity: qty.toFixed(4),
              previousStock: row.currentStock.toFixed(4),
              newStock: nextStock.toFixed(4),
              unit: row.unit,
              costImpact: round2(qty * row.costPerUnit).toFixed(2),
              orderId: currentOrder.id,
              transferGroupId: null,
              actor: input.actor,
              reason: `Pre-prep cancellation stock restoration for ${currentOrder.id}`,
              timestamp: nowDate,
            });
          }
        }
        inventoryRestored = true;
      } else {
        resolution = "UNAVOIDABLE_LOSS";
        financialLoss = recipeCost;
        for (const invId of sortedIds) {
          const qty = requirements.get(invId) ?? 0;
          const row = lockedMap.get(invId);
          if (row && qty > 0) {
            lostIngredients.push({
              inventoryItemId: row.ingredientId,
              name: row.name,
              quantity: qty,
            });
          }
        }
      }
    } else {
      resolution = "INVENTORY_RESTORED";
      financialLoss = 0;
    }
  } else if (
    previousStatus === "PREPARING" ||
    previousStatus === "READY_FOR_PICKUP" ||
    previousStatus === "DRIVER_ASSIGNED"
  ) {
    stage = "DURING_OR_AFTER_PREP";
    resolution = "FOOD_AND_LABOR_LOSS";
    financialLoss = round2(recipeCost + MID_PREP_LABOR_ALLOWANCE_INR);

    for (const invId of sortedIds) {
      const qty = requirements.get(invId) ?? 0;
      const item = kitchenStock.find((i) => i.id === invId);
      if (item && qty > 0) {
        lostIngredients.push({
          inventoryItemId: item.id,
          name: item.name,
          quantity: qty,
        });
        await tx.insert(schema.inventoryMovements).values({
          id: makeId("MOV"),
          kitchenId: currentOrder.kitchenId,
          ingredientId: item.id,
          itemName: item.name,
          sku: item.sku,
          type: "LOSS",
          quantity: "0.0000",
          previousStock: item.currentStock.toFixed(4),
          newStock: item.currentStock.toFixed(4),
          unit: item.unit,
          costImpact: round2(qty * item.costPerUnit).toFixed(2),
          orderId: currentOrder.id,
          transferGroupId: null,
          actor: input.actor,
          reason: `Mid-prep cancellation Food & Labor Loss (${previousStatus}); blocked from usable stock return`,
          timestamp: nowDate,
        });
      }
    }
  } else {
    stage = "AFTER_PICKUP";
    resolution = "AGGREGATOR_ACCOUNTING_CLAIM";
    financialLoss = recipeCost;
    claimAmount = orderValue;

    for (const invId of sortedIds) {
      const qty = requirements.get(invId) ?? 0;
      const item = kitchenStock.find((i) => i.id === invId);
      if (item && qty > 0) {
        lostIngredients.push({
          inventoryItemId: item.id,
          name: item.name,
          quantity: qty,
        });
      }
    }
  }

  const source: CancellationSource = input.cancellationSource ?? "MANUAL";
  const reason =
    input.cancellationReason?.trim() ||
    `Cancelled from ${previousStatus} stage (${resolution})`;

  const formattedLoss = formatCurrency(financialLoss, settings.currency);
  const formattedClaim = formatCurrency(claimAmount, settings.currency);

  await tx
    .update(schema.orders)
    .set({
      status: "CANCELLED",
      updatedAt: nowDate,
      cancelledAt: nowDate,
      cancelledBy: input.actor,
      cancellationSource: source,
      cancellationReason: reason,
      cancellationStage: stage,
      cancellationResolution: resolution,
      lossAmount: round2(financialLoss).toFixed(2),
      claimAmount: round2(claimAmount).toFixed(2),
      inventoryRestored,
    })
    .where(eq(schema.orders.id, currentOrder.id));

  await tx.insert(schema.orderEvents).values({
    id: makeId(`${currentOrder.id}-CANCEL`),
    orderId: currentOrder.id,
    type: "CANCELLED",
    timestamp: nowDate,
    actor: input.actor,
    details: `Order cancelled at ${previousStatus} (${stage}) -> ${resolution}. Loss: ${formattedLoss}, Claim: ${formattedClaim}.`,
  });

  const dispatchEvidence =
    stage === "AFTER_PICKUP" ||
    currentOrder.driverName ||
    currentOrder.pickedUpAt
      ? {
          driverName: currentOrder.driverName,
          readyAt: currentOrder.readyAt,
          driverAssignedAt: currentOrder.driverAssignedAt,
          pickedUpAt: currentOrder.pickedUpAt,
          dispatchedAt: currentOrder.dispatchedAt,
        }
      : undefined;

  const cancellationRecord: CancellationRecord = {
    id: makeId("CAN"),
    orderId: currentOrder.id,
    brandId: currentOrder.brandId,
    kitchenId: currentOrder.kitchenId,
    channel: currentOrder.channel,
    stage,
    previousStatus,
    resolution,
    source,
    reason,
    actor: input.actor,
    timestamp: now,
    financialLoss,
    claimAmount,
    restoredIngredients,
    lostIngredients,
    dispatchEvidence,
  };

  await tx.insert(schema.cancellations).values({
    id: cancellationRecord.id,
    orderId: cancellationRecord.orderId,
    brandId: cancellationRecord.brandId,
    kitchenId: cancellationRecord.kitchenId,
    channel: cancellationRecord.channel,
    stage: cancellationRecord.stage,
    previousStatus: cancellationRecord.previousStatus,
    resolution: cancellationRecord.resolution,
    source: cancellationRecord.source,
    reason: cancellationRecord.reason,
    actor: cancellationRecord.actor,
    timestamp: nowDate,
    financialLoss: round2(financialLoss).toFixed(2),
    claimAmount: round2(claimAmount).toFixed(2),
    restoredIngredients,
    lostIngredients,
    dispatchEvidence: dispatchEvidence ?? null,
  });

  await insertActivity(tx, {
    type: "ORDER_CANCELLED",
    category: "CANCELLATION",
    title: `${currentOrder.id} Cancelled (${stage.replaceAll("_", " ")})`,
    details: `Resolution: ${resolution.replaceAll("_", " ")} • Loss: ${formattedLoss} • Claim: ${formattedClaim}.`,
    actor: input.actor,
    orderId: currentOrder.id,
    kitchenId: currentOrder.kitchenId,
    brandId: currentOrder.brandId,
    timestamp: now,
    severity: stage === "BEFORE_PREP" ? "warning" : "error",
  });

  const [updatedOrder] = await loadOrders(tx, currentOrder.id);

  return {
    order: updatedOrder,
    idempotentReplay: false,
    cancellationRecord,
  };
}

// -----------------------------------------------------------------------------
// Per-Kitchen Inventory Mutation & Atomic Inter-Kitchen Stock Transfers
// -----------------------------------------------------------------------------

export async function mutateCanonicalInventoryPg(
  input: InventoryMutationInput,
): Promise<InventoryMutationResult> {
  await ensureSeeded();
  const db = getDb();

  return db.transaction(async (tx) => {
    const kitchenId = input.kitchenId?.trim() || "K1";
    const nowDate = new Date();
    const now = nowDate.toISOString();

    const lockedMap = await lockKitchenInventoryRows(tx, kitchenId, [
      input.itemId,
    ]);
    const existing = lockedMap.get(input.itemId);
    if (!existing) {
      throw new Error(
        `Inventory item not found in kitchen ${kitchenId}: ${input.itemId}`,
      );
    }

    const previousStock = existing.currentStock;
    let nextStock = previousStock;
    let movementType: InventoryMovementType = "MANUAL_ADJUSTMENT";
    let delta = 0;

    if (input.action === "SET_STOCK") {
      if (
        typeof input.currentStock !== "number" ||
        !Number.isFinite(input.currentStock)
      ) {
        throw new Error(
          "SET_STOCK requires a finite numeric currentStock value.",
        );
      }
      nextStock = Number(input.currentStock);
      delta = round4(nextStock - previousStock);
      movementType = delta > 0 ? "RESTOCK" : "MANUAL_ADJUSTMENT";
    } else if (input.action === "RESTOCK") {
      const addQty = Math.abs(Number(input.quantity) || 0);
      if (addQty <= 0) {
        throw new Error("Restock quantity must be greater than 0.");
      }
      delta = addQty;
      nextStock = round4(previousStock + addQty);
      movementType = "RESTOCK";
    } else if (input.action === "WASTE" || input.action === "LOSS") {
      const lossQty = Math.abs(Number(input.quantity) || 0);
      if (lossQty <= 0) {
        throw new Error("Waste/Loss quantity must be greater than 0.");
      }
      delta = -Math.min(previousStock, lossQty);
      nextStock = round4(Math.max(0, previousStock - lossQty));
      movementType = input.action;
    } else {
      delta = Number(input.quantity) || 0;
      nextStock = round4(Math.max(0, previousStock + delta));
      movementType = "MANUAL_ADJUSTMENT";
    }

    if (!Number.isFinite(nextStock) || nextStock < 0) {
      throw new Error("Resulting stock must be a non-negative number.");
    }

    const lastRestocked =
      nextStock > previousStock ? nowDate : existing.lastRestocked;

    await tx
      .update(schema.kitchenInventory)
      .set({
        currentStock: nextStock.toFixed(4),
        lastRestocked,
      })
      .where(
        and(
          eq(schema.kitchenInventory.kitchenId, kitchenId),
          eq(schema.kitchenInventory.ingredientId, input.itemId),
        ),
      );

    const costImpact = round2(Math.abs(delta) * existing.costPerUnit);
    const reason =
      input.reason?.trim() ||
      `${movementType.replaceAll("_", " ")} (${previousStock} -> ${nextStock} ${existing.unit})`;

    const movement: InventoryMovement = {
      id: makeId("MOV"),
      inventoryItemId: existing.ingredientId,
      itemName: existing.name,
      sku: existing.sku,
      kitchenId,
      type: movementType,
      quantity: delta,
      previousStock,
      newStock: nextStock,
      unit: existing.unit,
      costImpact,
      actor: input.actor,
      reason,
      timestamp: now,
    };

    await tx.insert(schema.inventoryMovements).values({
      id: movement.id,
      kitchenId: movement.kitchenId,
      ingredientId: movement.inventoryItemId,
      itemName: movement.itemName,
      sku: movement.sku,
      type: movement.type,
      quantity: delta.toFixed(4),
      previousStock: previousStock.toFixed(4),
      newStock: nextStock.toFixed(4),
      unit: movement.unit,
      costImpact: costImpact.toFixed(2),
      orderId: null,
      transferGroupId: null,
      actor: movement.actor,
      reason: movement.reason,
      timestamp: nowDate,
    });

    const settings = await loadSettings(tx);
    await insertActivity(tx, {
      type: `INVENTORY_${movementType}`,
      category: "INVENTORY",
      title: `${existing.name} (${kitchenId}): ${previousStock} → ${nextStock} ${existing.unit}`,
      details: `${reason} (Cost impact: ${formatCurrency(costImpact, settings.currency)})`,
      actor: input.actor,
      kitchenId,
      timestamp: now,
      severity:
        movementType === "WASTE" || movementType === "LOSS"
          ? "error"
          : nextStock <= existing.reorderThreshold
            ? "warning"
            : "success",
    });

    const inventory = await loadInventory(tx);
    const updatedItem = inventory.find(
      (i) => i.id === input.itemId && i.kitchenId === kitchenId,
    )!;

    return {
      item: updatedItem,
      movement,
      inventory,
    };
  });
}

export async function transferKitchenInventoryPg(
  input: TransferInventoryInput,
): Promise<TransferInventoryResult> {
  await ensureSeeded();
  const db = getDb();

  const fromKitchenId = input.fromKitchenId?.trim();
  const toKitchenId = input.toKitchenId?.trim();
  const itemId = input.itemId?.trim();
  const qty = Number(input.quantity);

  if (!fromKitchenId || !toKitchenId || !itemId) {
    throw new Error(
      "itemId, fromKitchenId, and toKitchenId are required for a stock transfer.",
    );
  }
  if (fromKitchenId === toKitchenId) {
    throw new Error(
      "Source and destination kitchens must be different for an inter-kitchen stock transfer.",
    );
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Transfer quantity must be a positive number.");
  }

  return db.transaction(async (tx) => {
    const nowDate = new Date();
    const now = nowDate.toISOString();

    // Validate both kitchens exist
    const kitchenRows = await tx
      .select()
      .from(schema.kitchens)
      .where(inArray(schema.kitchens.id, [fromKitchenId, toKitchenId]));

    const kitchenMap = new Map(kitchenRows.map((k) => [k.id, k]));
    if (!kitchenMap.has(fromKitchenId)) {
      throw new Error(`Source kitchen not found: ${fromKitchenId}`);
    }
    if (!kitchenMap.has(toKitchenId)) {
      throw new Error(`Destination kitchen not found: ${toKitchenId}`);
    }

    // Lock both (kitchen_id, ingredient_id) rows in deterministic ascending kitchen_id order
    // to eliminate deadlock risk under bidirectional concurrent transfers (K1->K2 & K2->K1).
    const sortedKitchens = [fromKitchenId, toKitchenId].sort();
    const lockedRows = await tx
      .select()
      .from(schema.kitchenInventory)
      .where(
        and(
          inArray(schema.kitchenInventory.kitchenId, sortedKitchens),
          eq(schema.kitchenInventory.ingredientId, itemId),
        ),
      )
      .orderBy(
        asc(schema.kitchenInventory.kitchenId),
        asc(schema.kitchenInventory.ingredientId),
      )
      .for("update");

    const [ingredientMeta] = await tx
      .select()
      .from(schema.ingredients)
      .where(eq(schema.ingredients.id, itemId))
      .limit(1);

    if (!ingredientMeta) {
      throw new Error(`Ingredient not found: ${itemId}`);
    }

    const fromRow = lockedRows.find((r) => r.kitchenId === fromKitchenId);
    const toRow = lockedRows.find((r) => r.kitchenId === toKitchenId);

    if (!fromRow) {
      throw new Error(
        `Inventory item ${itemId} not found in source kitchen ${fromKitchenId}.`,
      );
    }
    if (!toRow) {
      throw new Error(
        `Inventory item ${itemId} not found in destination kitchen ${toKitchenId}.`,
      );
    }

    const fromPrev = num(fromRow.currentStock);
    const toPrev = num(toRow.currentStock);

    if (fromPrev < qty) {
      throw new Error(
        `Insufficient stock in ${fromKitchenId} for ${ingredientMeta.name}: requested ${qty} ${ingredientMeta.unit}, available ${fromPrev} ${ingredientMeta.unit}.`,
      );
    }

    const fromNext = round4(fromPrev - qty);
    const toNext = round4(toPrev + qty);

    await tx
      .update(schema.kitchenInventory)
      .set({ currentStock: fromNext.toFixed(4) })
      .where(
        and(
          eq(schema.kitchenInventory.kitchenId, fromKitchenId),
          eq(schema.kitchenInventory.ingredientId, itemId),
        ),
      );

    await tx
      .update(schema.kitchenInventory)
      .set({
        currentStock: toNext.toFixed(4),
        lastRestocked: nowDate,
      })
      .where(
        and(
          eq(schema.kitchenInventory.kitchenId, toKitchenId),
          eq(schema.kitchenInventory.ingredientId, itemId),
        ),
      );

    const transferGroupId = makeId("XFER");
    const costPerUnit = num(ingredientMeta.costPerUnit);
    const costImpact = round2(qty * costPerUnit);
    const reasonText =
      input.reason?.trim() ||
      `Inter-kitchen stock transfer ${fromKitchenId} → ${toKitchenId}`;

    const outMovement: InventoryMovement = {
      id: makeId("MOV"),
      inventoryItemId: itemId,
      itemName: ingredientMeta.name,
      sku: ingredientMeta.sku,
      kitchenId: fromKitchenId,
      type: "TRANSFER_OUT",
      quantity: -qty,
      previousStock: fromPrev,
      newStock: fromNext,
      unit: ingredientMeta.unit,
      costImpact,
      transferGroupId,
      actor: input.actor,
      reason: `${reasonText} (to ${toKitchenId})`,
      timestamp: now,
    };

    const inMovement: InventoryMovement = {
      id: makeId("MOV"),
      inventoryItemId: itemId,
      itemName: ingredientMeta.name,
      sku: ingredientMeta.sku,
      kitchenId: toKitchenId,
      type: "TRANSFER_IN",
      quantity: qty,
      previousStock: toPrev,
      newStock: toNext,
      unit: ingredientMeta.unit,
      costImpact,
      transferGroupId,
      actor: input.actor,
      reason: `${reasonText} (from ${fromKitchenId})`,
      timestamp: now,
    };

    await tx.insert(schema.inventoryMovements).values([
      {
        id: outMovement.id,
        kitchenId: outMovement.kitchenId,
        ingredientId: itemId,
        itemName: outMovement.itemName,
        sku: outMovement.sku,
        type: outMovement.type,
        quantity: (-qty).toFixed(4),
        previousStock: fromPrev.toFixed(4),
        newStock: fromNext.toFixed(4),
        unit: outMovement.unit,
        costImpact: costImpact.toFixed(2),
        orderId: null,
        transferGroupId,
        actor: input.actor,
        reason: outMovement.reason,
        timestamp: nowDate,
      },
      {
        id: inMovement.id,
        kitchenId: inMovement.kitchenId,
        ingredientId: itemId,
        itemName: inMovement.itemName,
        sku: inMovement.sku,
        type: inMovement.type,
        quantity: qty.toFixed(4),
        previousStock: toPrev.toFixed(4),
        newStock: toNext.toFixed(4),
        unit: inMovement.unit,
        costImpact: costImpact.toFixed(2),
        orderId: null,
        transferGroupId,
        actor: input.actor,
        reason: inMovement.reason,
        timestamp: nowDate,
      },
    ]);

    const settings = await loadSettings(tx);
    await insertActivity(tx, {
      type: "INVENTORY_TRANSFER",
      category: "INVENTORY",
      title: `Stock Transfer: ${qty} ${ingredientMeta.unit} ${ingredientMeta.name} (${fromKitchenId} → ${toKitchenId})`,
      details: `${reasonText} • Group ${transferGroupId} • Stock value: ${formatCurrency(costImpact, settings.currency)}.`,
      actor: input.actor,
      kitchenId: toKitchenId,
      timestamp: now,
      severity: "success",
    });

    const inventory = await loadInventory(tx);
    const fromItem = inventory.find(
      (i) => i.id === itemId && i.kitchenId === fromKitchenId,
    )!;
    const toItem = inventory.find(
      (i) => i.id === itemId && i.kitchenId === toKitchenId,
    )!;

    return {
      transferGroupId,
      fromItem,
      toItem,
      outMovement,
      inMovement,
      inventory,
    };
  });
}

// -----------------------------------------------------------------------------
// System Configuration Mutations
// -----------------------------------------------------------------------------

export async function toggleBrandKitchenMappingPg(
  brandId: DbaBrand,
  kitchenId: string,
  actor: string,
): Promise<BrandKitchenConfig[]> {
  await ensureSeeded();
  const db = getDb();

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.brandKitchens)
      .where(
        and(
          eq(schema.brandKitchens.brandId, brandId),
          eq(schema.brandKitchens.kitchenId, kitchenId),
        ),
      )
      .limit(1);

    const activeState = existing ? !existing.active : true;
    if (existing) {
      await tx
        .update(schema.brandKitchens)
        .set({ active: activeState })
        .where(
          and(
            eq(schema.brandKitchens.brandId, brandId),
            eq(schema.brandKitchens.kitchenId, kitchenId),
          ),
        );
    } else {
      await tx.insert(schema.brandKitchens).values({
        brandId,
        kitchenId,
        active: true,
      });
    }

    await insertActivity(tx, {
      type: "BRAND_KITCHEN_UPDATED",
      category: "SYSTEM",
      title: `BrandKitchen Matrix: ${brandId} ↔ ${kitchenId} ${activeState ? "ENABLED" : "DISABLED"}`,
      details: `Production authorization between ${brandId} and ${kitchenId} set to ${activeState}.`,
      actor,
      kitchenId,
      brandId,
      severity: activeState ? "success" : "warning",
    });

    const rows = await tx
      .select()
      .from(schema.brandKitchens)
      .orderBy(
        asc(schema.brandKitchens.kitchenId),
        asc(schema.brandKitchens.brandId),
      );
    return rows.map((bk) => ({
      brandId: bk.brandId,
      kitchenId: bk.kitchenId,
      active: bk.active,
    }));
  });
}

export async function updateMenuCatalogItemPg(
  item: Partial<MenuItem> & { id: string },
  actor: string,
): Promise<MenuItem[]> {
  await ensureSeeded();
  const db = getDb();

  return db.transaction(async (tx) => {
    if (!item || typeof item.id !== "string" || !item.id.trim()) {
      throw new Error("Menu item id is required.");
    }
    const cleanId = item.id.trim();
    const [existing] = await tx
      .select()
      .from(schema.menuItems)
      .where(eq(schema.menuItems.id, cleanId))
      .limit(1);

    if (existing) {
      const nextPrice =
        typeof item.price === "number" &&
        Number.isFinite(item.price) &&
        item.price > 0
          ? round2(item.price)
          : num(existing.price);
      const nextPrep =
        typeof item.prepTimeMins === "number" &&
        Number.isFinite(item.prepTimeMins) &&
        item.prepTimeMins >= 1
          ? Math.round(item.prepTimeMins)
          : existing.prepTimeMins;

      await tx
        .update(schema.menuItems)
        .set({
          name:
            typeof item.name === "string" && item.name.trim()
              ? item.name.trim()
              : existing.name,
          price: nextPrice.toFixed(2),
          station:
            typeof item.station === "string" && item.station.trim()
              ? (item.station as MenuItem["station"])
              : existing.station,
          active:
            typeof item.active === "boolean" ? item.active : existing.active,
          prepTimeMins: nextPrep,
        })
        .where(eq(schema.menuItems.id, cleanId));

      if (Array.isArray(item.recipe)) {
        const cleanRecipe = item.recipe.filter(
          (r) =>
            r &&
            typeof r.inventoryItemId === "string" &&
            typeof r.quantityRequired === "number" &&
            Number.isFinite(r.quantityRequired) &&
            r.quantityRequired > 0,
        );
        await tx
          .delete(schema.menuRecipes)
          .where(eq(schema.menuRecipes.menuItemId, cleanId));
        if (cleanRecipe.length > 0) {
          await tx.insert(schema.menuRecipes).values(
            cleanRecipe.map((r) => ({
              menuItemId: cleanId,
              ingredientId: r.inventoryItemId,
              quantityRequired: round4(r.quantityRequired).toFixed(4),
            })),
          );
        }
      }
    } else if (item.brandId && item.name && item.station) {
      const price =
        typeof item.price === "number" &&
        Number.isFinite(item.price) &&
        item.price > 0
          ? round2(item.price)
          : 299;

      await tx.insert(schema.menuItems).values({
        id: cleanId,
        brandId: item.brandId,
        name: item.name.trim(),
        price: price.toFixed(2),
        station: item.station,
        active: typeof item.active === "boolean" ? item.active : true,
        prepTimeMins:
          typeof item.prepTimeMins === "number" && item.prepTimeMins >= 1
            ? Math.round(item.prepTimeMins)
            : 8,
      });

      if (Array.isArray(item.recipe) && item.recipe.length > 0) {
        const cleanRecipe = item.recipe.filter(
          (r) =>
            r &&
            typeof r.inventoryItemId === "string" &&
            typeof r.quantityRequired === "number" &&
            Number.isFinite(r.quantityRequired) &&
            r.quantityRequired > 0,
        );
        if (cleanRecipe.length > 0) {
          await tx.insert(schema.menuRecipes).values(
            cleanRecipe.map((r) => ({
              menuItemId: cleanId,
              ingredientId: r.inventoryItemId,
              quantityRequired: round4(r.quantityRequired).toFixed(4),
            })),
          );
        }
      }
    } else {
      throw new Error(
        `Menu item ${cleanId} not found and missing required brandId, name, or station.`,
      );
    }

    await insertActivity(tx, {
      type: "MENU_UPDATED",
      category: "SYSTEM",
      title: `Menu Catalog Updated (${cleanId})`,
      details: `Menu item ${item.name || cleanId} updated by ${actor}.`,
      actor,
      brandId: item.brandId,
      severity: "info",
    });

    return loadMenuCatalog(tx);
  });
}

export async function toggleKitchenActivePg(
  kitchenId: string,
  actor: string,
): Promise<KitchenConfig[]> {
  await ensureSeeded();
  const db = getDb();

  return db.transaction(async (tx) => {
    const [kitchen] = await tx
      .select()
      .from(schema.kitchens)
      .where(eq(schema.kitchens.id, kitchenId))
      .limit(1);
    if (!kitchen) {
      throw new Error(`Kitchen not found: ${kitchenId}`);
    }

    const nextActive = !kitchen.active;
    await tx
      .update(schema.kitchens)
      .set({ active: nextActive })
      .where(eq(schema.kitchens.id, kitchenId));

    await insertActivity(tx, {
      type: "KITCHEN_STATUS_CHANGED",
      category: "SYSTEM",
      title: `${kitchen.name} (${kitchen.id}) ${nextActive ? "ONLINE" : "MAINTENANCE"}`,
      details: `Physical kitchen facility status toggled by ${actor}.`,
      actor,
      kitchenId,
      severity: nextActive ? "success" : "warning",
    });

    const rows = await tx
      .select()
      .from(schema.kitchens)
      .orderBy(asc(schema.kitchens.id));
    return rows.map((k) => ({
      id: k.id,
      organizationId: k.organizationId ?? DEFAULT_ORGANIZATION_ID,
      name: k.name,
      code: k.code,
      location: k.location,
      areaCode: k.areaCode,
      active: k.active,
      timezone: k.timezone,
      capacityPerHour: k.capacityPerHour,
    }));
  });
}

export async function upsertOrganizationPg(
  org: Partial<Organization> & { id: string; name: string; slug: string },
): Promise<Organization> {
  await ensureSeeded();
  const db = getDb();
  const nowDate = new Date();
  await db
    .insert(schema.organizations)
    .values({
      id: org.id.trim(),
      name: org.name.trim(),
      slug: org.slug.trim().toLowerCase(),
      gstin: org.gstin ?? null,
      fssaiLicense: org.fssaiLicense ?? null,
      active: typeof org.active === "boolean" ? org.active : true,
      createdAt: org.createdAt ? new Date(org.createdAt) : nowDate,
    })
    .onConflictDoUpdate({
      target: schema.organizations.id,
      set: {
        name: org.name.trim(),
        slug: org.slug.trim().toLowerCase(),
        gstin: org.gstin ?? null,
        fssaiLicense: org.fssaiLicense ?? null,
        active: typeof org.active === "boolean" ? org.active : true,
      },
    });
  const [saved] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, org.id.trim()))
    .limit(1);
  return {
    id: saved.id,
    name: saved.name,
    slug: saved.slug,
    gstin: saved.gstin ?? undefined,
    fssaiLicense: saved.fssaiLicense ?? undefined,
    active: saved.active,
    createdAt: saved.createdAt.toISOString(),
  };
}

export async function upsertKitchenPg(
  kitchen: KitchenConfig,
): Promise<KitchenConfig> {
  await ensureSeeded();
  const db = getDb();
  const orgId = kitchen.organizationId?.trim() || DEFAULT_ORGANIZATION_ID;
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.kitchens)
      .values({
        id: kitchen.id.trim(),
        organizationId: orgId,
        name: kitchen.name.trim(),
        code: kitchen.code.trim(),
        location: kitchen.location?.trim() || "Cloud Unit",
        areaCode: kitchen.areaCode?.trim() || kitchen.code.trim(),
        active: kitchen.active,
        timezone: kitchen.timezone || "Asia/Kolkata",
        capacityPerHour: kitchen.capacityPerHour ?? 100,
      })
      .onConflictDoUpdate({
        target: schema.kitchens.id,
        set: {
          organizationId: orgId,
          name: kitchen.name.trim(),
          code: kitchen.code.trim(),
          location: kitchen.location?.trim() || "Cloud Unit",
          areaCode: kitchen.areaCode?.trim() || kitchen.code.trim(),
          active: kitchen.active,
          timezone: kitchen.timezone || "Asia/Kolkata",
          capacityPerHour: kitchen.capacityPerHour ?? 100,
        },
      });

    // Seed baseline per-kitchen inventory rows idempotently so newly provisioned kitchens work immediately
    await tx
      .insert(schema.kitchenInventory)
      .values(
        INVENTORY_DB.map((ing) => ({
          kitchenId: kitchen.id.trim(),
          ingredientId: ing.id,
          currentStock: Number(ing.currentStock).toFixed(4),
          reorderThreshold: Number(ing.reorderThreshold).toFixed(4),
          lastRestocked: new Date(ing.lastRestocked),
        })),
      )
      .onConflictDoNothing();
  });

  return {
    ...kitchen,
    organizationId: orgId,
  };
}

export async function findOrLinkEmployeeByAuthIdentityPg(identity: {
  authUserId?: string | null;
  email?: string | null;
  phone?: string | null;
}): Promise<Employee | null> {
  await ensureSeeded();
  const db = getDb();
  const cleanAuthId = identity.authUserId?.trim() || null;
  const cleanEmail = identity.email?.trim().toLowerCase() || null;
  const cleanPhone = identity.phone?.replace(/[\s-]/g, "").trim() || null;

  const all = await db.select().from(schema.employees);
  const match =
    (cleanAuthId
      ? all.find((e) => e.authUserId === cleanAuthId)
      : undefined) ??
    (cleanEmail
      ? all.find((e) => e.email?.trim().toLowerCase() === cleanEmail)
      : undefined) ??
    (cleanPhone
      ? all.find((e) => e.phone?.replace(/[\s-]/g, "").trim() === cleanPhone)
      : undefined);

  if (!match) return null;

  // Auto-link Supabase auth_user_id on first verified login if not yet linked
  if (cleanAuthId && !match.authUserId) {
    await db
      .update(schema.employees)
      .set({ authUserId: cleanAuthId })
      .where(eq(schema.employees.id, match.id));
    match.authUserId = cleanAuthId;
  }

  return {
    id: match.id,
    organizationId: match.organizationId ?? DEFAULT_ORGANIZATION_ID,
    employeeCode: match.employeeCode,
    name: match.name,
    role: match.role,
    kitchenId: match.kitchenId ?? undefined,
    email: match.email ?? undefined,
    phone: match.phone ?? undefined,
    authUserId: match.authUserId ?? undefined,
    active: match.active,
  };
}

export async function upsertCanonicalEmployeePg(
  employee: Partial<Employee> & { employeeCode: string },
  actor: string,
): Promise<Employee[]> {
  await ensureSeeded();
  const db = getDb();

  return db.transaction(async (tx) => {
    if (
      !employee ||
      typeof employee.employeeCode !== "string" ||
      !employee.employeeCode.trim()
    ) {
      throw new Error("employeeCode is required.");
    }
    const cleanCode = employee.employeeCode.trim().toUpperCase();
    if (
      employee.role !== undefined &&
      !ALLOWED_EMPLOYEE_ROLES.has(employee.role)
    ) {
      throw new Error(`Invalid employee role: ${String(employee.role)}`);
    }

    const allEmployees = await tx.select().from(schema.employees);
    const existing = allEmployees.find(
      (e) =>
        (employee.id && e.id === employee.id) ||
        e.employeeCode.toLowerCase() === cleanCode.toLowerCase(),
    );

    const normalizedEmail =
      typeof employee.email === "string"
        ? employee.email.trim().toLowerCase() || null
        : undefined;
    const normalizedPhone =
      typeof employee.phone === "string"
        ? employee.phone.trim() || null
        : undefined;
    const normalizedAuthUserId =
      typeof employee.authUserId === "string"
        ? employee.authUserId.trim() || null
        : undefined;
    const targetOrgId =
      typeof employee.organizationId === "string" &&
      employee.organizationId.trim()
        ? employee.organizationId.trim()
        : existing?.organizationId ?? DEFAULT_ORGANIZATION_ID;

    if (existing) {
      const nextRole = employee.role ?? existing.role;
      const nextKitchenId =
        nextRole === "OWNER"
          ? null
          : typeof employee.kitchenId === "string" && employee.kitchenId.trim()
            ? employee.kitchenId.trim()
            : existing.kitchenId;

      await tx
        .update(schema.employees)
        .set({
          organizationId: targetOrgId,
          employeeCode: cleanCode,
          name:
            typeof employee.name === "string" && employee.name.trim()
              ? employee.name.trim()
              : existing.name,
          role: nextRole,
          kitchenId: nextKitchenId,
          email:
            normalizedEmail !== undefined ? normalizedEmail : existing.email,
          phone:
            normalizedPhone !== undefined ? normalizedPhone : existing.phone,
          authUserId:
            normalizedAuthUserId !== undefined
              ? normalizedAuthUserId
              : existing.authUserId,
          active:
            typeof employee.active === "boolean"
              ? employee.active
              : existing.active,
        })
        .where(eq(schema.employees.id, existing.id));
    } else {
      const nextRole = employee.role ?? "LINE_COOK";
      await tx.insert(schema.employees).values({
        id:
          typeof employee.id === "string" && employee.id.trim()
            ? employee.id.trim()
            : makeId("EMP"),
        organizationId: targetOrgId,
        employeeCode: cleanCode,
        name:
          typeof employee.name === "string" && employee.name.trim()
            ? employee.name.trim()
            : "New Operator",
        role: nextRole,
        kitchenId:
          nextRole === "OWNER"
            ? null
            : typeof employee.kitchenId === "string" &&
                employee.kitchenId.trim()
              ? employee.kitchenId.trim()
              : "K1",
        email: normalizedEmail ?? null,
        phone: normalizedPhone ?? null,
        authUserId: normalizedAuthUserId ?? null,
        active: typeof employee.active === "boolean" ? employee.active : true,
      });
    }

    await insertActivity(tx, {
      organizationId: targetOrgId,
      type: "STAFF_UPDATED",
      category: "AUTH",
      title: `Staff Record Updated (${cleanCode})`,
      details: `Employee ${employee.name || cleanCode} updated by ${actor}.`,
      actor,
      kitchenId: employee.kitchenId,
      severity: "info",
    });

    const rows = await tx
      .select()
      .from(schema.employees)
      .orderBy(asc(schema.employees.id));
    return rows.map((e) => ({
      id: e.id,
      organizationId: e.organizationId ?? DEFAULT_ORGANIZATION_ID,
      employeeCode: e.employeeCode,
      name: e.name,
      role: e.role,
      kitchenId: e.kitchenId ?? undefined,
      email: e.email ?? undefined,
      phone: e.phone ?? undefined,
      authUserId: e.authUserId ?? undefined,
      active: e.active,
    }));
  });
}

export async function upsertVirtualFilePg(
  file: Partial<VirtualFileAsset> & { name: string },
  actor: string,
): Promise<VirtualFileAsset[]> {
  await ensureSeeded();
  const db = getDb();

  return db.transaction(async (tx) => {
    if (!file || typeof file.name !== "string" || !file.name.trim()) {
      throw new Error("File name is required and must be a non-empty string.");
    }
    const cleanName = file.name.trim();
    const safeCategory =
      file.category && ALLOWED_FILE_CATEGORIES.includes(file.category)
        ? file.category
        : "SOP Manual";
    const safeStatus =
      file.status && ALLOWED_FILE_STATUSES.includes(file.status)
        ? file.status
        : "VERIFIED";

    const nowDate = new Date();
    const [existing] = file.id
      ? await tx
          .select()
          .from(schema.virtualFiles)
          .where(eq(schema.virtualFiles.id, file.id))
          .limit(1)
      : [];

    if (existing) {
      await tx
        .update(schema.virtualFiles)
        .set({
          name: cleanName,
          category: file.category ? safeCategory : existing.category,
          size:
            typeof file.size === "string" && file.size.trim()
              ? file.size.trim()
              : existing.size,
          mimeType:
            typeof file.mimeType === "string" && file.mimeType.trim()
              ? file.mimeType.trim()
              : existing.mimeType,
          kitchenId:
            typeof file.kitchenId === "string" && file.kitchenId.trim()
              ? file.kitchenId.trim()
              : existing.kitchenId,
          brandId: file.brandId ?? existing.brandId,
          status: file.status ? safeStatus : existing.status,
          content:
            typeof file.content === "string" ? file.content : existing.content,
          updatedAt: nowDate,
        })
        .where(eq(schema.virtualFiles.id, existing.id));
    } else {
      const content =
        typeof file.content === "string" && file.content.trim()
          ? file.content
          : `# ${cleanName}\nUploaded to DarKIT OS Virtual File Explorer by ${actor}.`;
      const computedSize =
        typeof file.size === "string" && file.size.trim()
          ? file.size.trim()
          : `${Math.max(0.2, content.length / 1024).toFixed(1)} KB`;
      await tx.insert(schema.virtualFiles).values({
        id: makeId("FILE"),
        name: cleanName,
        category: safeCategory,
        size: computedSize,
        mimeType:
          typeof file.mimeType === "string" && file.mimeType.trim()
            ? file.mimeType.trim()
            : "text/markdown",
        kitchenId:
          typeof file.kitchenId === "string" && file.kitchenId.trim()
            ? file.kitchenId.trim()
            : "K1",
        brandId: file.brandId ?? null,
        uploadedBy: actor,
        updatedAt: nowDate,
        status: safeStatus,
        content,
      });
    }

    await insertActivity(tx, {
      type: "FILE_ASSET_SAVED",
      category: "SYSTEM",
      title: `Virtual Explorer Asset Saved: ${cleanName}`,
      details: `Category: ${safeCategory} • Kitchen: ${file.kitchenId || "GLOBAL"}.`,
      actor,
      kitchenId: file.kitchenId,
      brandId: file.brandId,
      severity: "info",
    });

    const rows = await tx
      .select()
      .from(schema.virtualFiles)
      .orderBy(desc(schema.virtualFiles.updatedAt));
    return rows.map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category,
      size: f.size,
      mimeType: f.mimeType,
      kitchenId: f.kitchenId ?? undefined,
      brandId: f.brandId ?? undefined,
      uploadedBy: f.uploadedBy,
      updatedAt: f.updatedAt.toISOString(),
      status: f.status,
      content: f.content,
    }));
  });
}

export async function deleteVirtualFilePg(
  fileId: string,
  actor: string,
): Promise<VirtualFileAsset[]> {
  await ensureSeeded();
  const db = getDb();

  return db.transaction(async (tx) => {
    if (!fileId || typeof fileId !== "string") {
      throw new Error("fileId is required.");
    }
    const [target] = await tx
      .select()
      .from(schema.virtualFiles)
      .where(eq(schema.virtualFiles.id, fileId))
      .limit(1);

    await tx
      .delete(schema.virtualFiles)
      .where(eq(schema.virtualFiles.id, fileId));

    if (target) {
      await insertActivity(tx, {
        type: "FILE_ASSET_DELETED",
        category: "SYSTEM",
        title: `Virtual Explorer Asset Deleted: ${target.name}`,
        details: `Removed from operational storage by ${actor}.`,
        actor,
        severity: "warning",
      });
    }

    const rows = await tx
      .select()
      .from(schema.virtualFiles)
      .orderBy(desc(schema.virtualFiles.updatedAt));
    return rows.map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category,
      size: f.size,
      mimeType: f.mimeType,
      kitchenId: f.kitchenId ?? undefined,
      brandId: f.brandId ?? undefined,
      uploadedBy: f.uploadedBy,
      updatedAt: f.updatedAt.toISOString(),
      status: f.status,
      content: f.content,
    }));
  });
}

export async function updateSystemSettingsPg(
  partial: Partial<SystemSettings>,
  actor: string,
): Promise<SystemSettings> {
  await ensureSeeded();
  const db = getDb();

  return db.transaction(async (tx) => {
    const current = await loadSettings(tx);

    const safeLowStockMultiplier =
      typeof partial.lowStockMultiplier === "number" &&
      Number.isFinite(partial.lowStockMultiplier) &&
      partial.lowStockMultiplier >= 0.5 &&
      partial.lowStockMultiplier <= 3
        ? partial.lowStockMultiplier
        : current.lowStockMultiplier;

    const safePrepSla =
      typeof partial.prepSlaMinutes === "number" &&
      Number.isFinite(partial.prepSlaMinutes) &&
      partial.prepSlaMinutes >= 3 &&
      partial.prepSlaMinutes <= 60
        ? partial.prepSlaMinutes
        : current.prepSlaMinutes;

    const safeDispatchSla =
      typeof partial.dispatchSlaMinutes === "number" &&
      Number.isFinite(partial.dispatchSlaMinutes) &&
      partial.dispatchSlaMinutes >= 3 &&
      partial.dispatchSlaMinutes <= 60
        ? partial.dispatchSlaMinutes
        : current.dispatchSlaMinutes;

    const safeRateLimit =
      typeof partial.rateLimitRps === "number" &&
      Number.isFinite(partial.rateLimitRps) &&
      partial.rateLimitRps >= 10 &&
      partial.rateLimitRps <= 5000
        ? partial.rateLimitRps
        : current.rateLimitRps;

    const next: SystemSettings = {
      currency:
        partial.currency && ALLOWED_CURRENCIES.includes(partial.currency)
          ? partial.currency
          : current.currency,
      timezone:
        typeof partial.timezone === "string" && partial.timezone.trim()
          ? partial.timezone.trim()
          : current.timezone,
      theme:
        partial.theme && ALLOWED_THEMES.includes(partial.theme)
          ? partial.theme
          : current.theme,
      fluidAnimations:
        typeof partial.fluidAnimations === "boolean"
          ? partial.fluidAnimations
          : current.fluidAnimations,
      syncMode:
        partial.syncMode && ALLOWED_SYNC_MODES.includes(partial.syncMode)
          ? partial.syncMode
          : current.syncMode,
      autoAcceptOrders:
        typeof partial.autoAcceptOrders === "boolean"
          ? partial.autoAcceptOrders
          : current.autoAcceptOrders,
      lowStockMultiplier: safeLowStockMultiplier,
      prepSlaMinutes: safePrepSla,
      dispatchSlaMinutes: safeDispatchSla,
      rlsEnforcement:
        partial.rlsEnforcement &&
        ALLOWED_RLS_MODES.includes(partial.rlsEnforcement)
          ? partial.rlsEnforcement
          : current.rlsEnforcement,
      circuitBreakerState:
        partial.circuitBreakerState &&
        ALLOWED_CIRCUIT_STATES.includes(partial.circuitBreakerState)
          ? partial.circuitBreakerState
          : current.circuitBreakerState,
      rateLimitRps: safeRateLimit,
    };

    const nowDate = new Date();
    await tx
      .insert(schema.systemSettings)
      .values({
        id: "default",
        ...next,
        updatedAt: nowDate,
      })
      .onConflictDoUpdate({
        target: schema.systemSettings.id,
        set: {
          ...next,
          updatedAt: nowDate,
        },
      });

    await insertActivity(tx, {
      type: "SETTINGS_UPDATED",
      category: "SYSTEM",
      title: "System Preferences Updated",
      details: `Currency: ${next.currency} • Theme: ${next.theme} • Sync: ${next.syncMode} • Prep SLA: ${next.prepSlaMinutes}m.`,
      actor,
      severity: "info",
    });

    return next;
  });
}

export async function updateLeakageVectorStatusPg(
  id: string,
  status: RevenueLeakageVector["status"],
  actor: string,
): Promise<RevenueLeakageVector[]> {
  await ensureSeeded();
  const db = getDb();

  return db.transaction(async (tx) => {
    if (!ALLOWED_LEAKAGE_STATUSES.has(status)) {
      throw new Error(`Invalid leakage status: ${String(status)}`);
    }
    const [vector] = await tx
      .select()
      .from(schema.leakageVectors)
      .where(eq(schema.leakageVectors.id, id))
      .limit(1);
    if (!vector) {
      throw new Error(`Leakage vector not found: ${id}`);
    }

    await tx
      .update(schema.leakageVectors)
      .set(
        status === "RECOVERED"
          ? {
              status,
              actualCollected: vector.potentialRevenue,
              leakedAmount: "0.00",
            }
          : { status },
      )
      .where(eq(schema.leakageVectors.id, id));

    await insertActivity(tx, {
      type: "LEAKAGE_AUDIT",
      category: "CLOUD7",
      title: `Revenue Leakage Audit (${vector.vector}): ${status}`,
      details: `Cloud-kitchen revenue recovery status updated by ${actor}.`,
      actor,
      severity: status === "RECOVERED" ? "success" : "info",
    });

    const rows = await tx
      .select()
      .from(schema.leakageVectors)
      .orderBy(asc(schema.leakageVectors.id));
    return rows.map((l) => ({
      id: l.id,
      vector: l.vector,
      signature: l.signature,
      impactLevel: l.impactLevel,
      impactNote: l.impactNote,
      potentialRevenue: num(l.potentialRevenue),
      actualCollected: num(l.actualCollected),
      leakedAmount: num(l.leakedAmount),
      affectedAccounts: l.affectedAccounts,
      status: l.status,
    }));
  });
}
