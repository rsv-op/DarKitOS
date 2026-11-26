import "server-only";
import crypto from "crypto";
import { formatCurrency } from "@/lib/currency";
import {
  DEFAULT_ORGANIZATION_ID,
  INVENTORY_DB,
  calculateOrderRecipeCost,
  calculateOrderTotalAmount,
  evaluateOrderInventory,
  getRequiredIngredients,
  processOrderDepletion,
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
  type OrderPaymentStatus,
  type Organization,
  type OutboxEvent,
  type PaymentProvider,
  type PaymentTransaction,
  type RevenueLeakageVector,
  type SystemSettings,
  type TaxInvoice,
  type TaxInvoiceStatus,
  type VirtualFileAsset,
  type WebhookIdempotencyEntry,
} from "@/lib/db";
import { isPostgresConfigured } from "@/lib/db-client";
import {
  calculateIndianGstBreakup,
  formatTaxInvoiceNumber,
  getIndianFinancialYear,
} from "@/lib/gst";
import { refundRazorpayPayment } from "@/lib/razorpay";
import { publishKitchenRealtimeEvent } from "@/lib/realtime-publisher";
import * as pgStore from "@/lib/store-pg";
import { buildInitialSeedState } from "@/lib/store-seed";
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
  type KitchenState,
  type StoreSnapshot,
  type TransferInventoryInput,
  type TransferInventoryResult,
  type TransitionOrderInput,
  type TransitionOrderResult,
} from "@/lib/store-types";

export {
  MID_PREP_LABOR_ALLOWANCE_INR,
  type InjectOrderInput,
  type InjectOrderResult,
  type InventoryItem,
  type InventoryMutationInput,
  type InventoryMutationResult,
  type KitchenState,
  type Order,
  type StoreSnapshot,
  type TransferInventoryInput,
  type TransferInventoryResult,
  type TransitionOrderInput,
  type TransitionOrderResult,
};

export function getStorageMode(): "postgres" | "memory" {
  return isPostgresConfigured() ? "postgres" : "memory";
}

// -----------------------------------------------------------------------------
// Offline In-Memory Fallback (Async Mutex-Serialized, Per-Kitchen Isolated)
// -----------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __darkit_os_store__: KitchenState | undefined;
  // eslint-disable-next-line no-var
  var __darkit_os_mem_lock__: Promise<void> | undefined;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function getGlobalState(): KitchenState {
  if (!globalThis.__darkit_os_store__) {
    globalThis.__darkit_os_store__ = buildInitialSeedState();
  }
  return globalThis.__darkit_os_store__;
}

/**
 * Serializes async mutations against the in-memory fallback store so concurrent
 * Promise.all(...) operations behave atomically just like PostgreSQL FOR UPDATE transactions.
 */
async function withMemoryLock<T>(work: () => T | Promise<T>): Promise<T> {
  const prev = globalThis.__darkit_os_mem_lock__ ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalThis.__darkit_os_mem_lock__ = prev.then(() => gate);
  await prev;
  try {
    return await work();
  } finally {
    release();
  }
}

function cloneOrder(order: Order): Order {
  return {
    ...order,
    items: order.items.map((item) => ({ ...item })),
    events: order.events.map((event) => ({ ...event })),
    inventoryWarnings: order.inventoryWarnings
      ? [...order.inventoryWarnings]
      : undefined,
    inventoryUnavailable: order.inventoryUnavailable
      ? [...order.inventoryUnavailable]
      : undefined,
  };
}

function cloneInventoryItem(item: InventoryItem): InventoryItem {
  return { ...item };
}

function cloneState(state: KitchenState): KitchenState {
  return {
    organizations: state.organizations.map((o) => ({ ...o })),
    orders: state.orders.map(cloneOrder),
    taxInvoices: state.taxInvoices.map((inv) => ({ ...inv })),
    paymentTransactions: state.paymentTransactions.map((tx) => ({
      ...tx,
      rawMeta: tx.rawMeta ? { ...tx.rawMeta } : undefined,
    })),
    inventory: state.inventory.map(cloneInventoryItem),
    inventoryMovements: state.inventoryMovements.map((m) => ({ ...m })),
    cancellations: state.cancellations.map((c) => ({
      ...c,
      restoredIngredients: c.restoredIngredients.map((i) => ({ ...i })),
      lostIngredients: c.lostIngredients.map((i) => ({ ...i })),
      dispatchEvidence: c.dispatchEvidence
        ? { ...c.dispatchEvidence }
        : undefined,
    })),
    activities: state.activities.map((a) => ({ ...a })),
    brands: state.brands.map((b) => ({ ...b })),
    kitchens: state.kitchens.map((k) => ({ ...k })),
    brandKitchens: state.brandKitchens.map((bk) => ({ ...bk })),
    menuCatalog: state.menuCatalog.map((m) => ({
      ...m,
      recipe: m.recipe.map((r) => ({ ...r })),
    })),
    employees: state.employees.map((e) => ({ ...e })),
    webhookEvents: state.webhookEvents.map((w) => ({ ...w })),
    outboxEvents: state.outboxEvents.map((o) => ({ ...o })),
    leakageVectors: state.leakageVectors.map((l) => ({ ...l })),
    files: state.files.map((f) => ({ ...f })),
    settings: { ...state.settings },
  };
}

function findMemoryInventoryItem(
  inventory: InventoryItem[],
  itemId: string,
  kitchenId: string,
): InventoryItem | undefined {
  return inventory.find(
    (item) =>
      (item.id === itemId || item.ingredientId === itemId) &&
      item.kitchenId === kitchenId,
  );
}

function pushMemoryActivity(
  state: KitchenState,
  entry: Omit<OperationalActivity, "id" | "timestamp"> & {
    timestamp?: string;
  },
): OperationalActivity {
  const created: OperationalActivity = {
    ...entry,
    id: makeId("ACT"),
    timestamp: entry.timestamp ?? new Date().toISOString(),
  };
  state.activities.unshift(created);
  if (state.activities.length > 200) {
    state.activities = state.activities.slice(0, 200);
  }
  return created;
}

function runMemoryTransaction<T>(callback: (state: KitchenState) => T): T {
  const state = getGlobalState();
  const backup = cloneState(state);
  try {
    return callback(state);
  } catch (error) {
    globalThis.__darkit_os_store__ = backup;
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Canonical Async Read API
// -----------------------------------------------------------------------------

export async function getOrders(): Promise<Order[]> {
  if (isPostgresConfigured()) return pgStore.getOrdersPg();
  return getGlobalState().orders.map(cloneOrder);
}

export async function getInventory(
  kitchenId?: string,
): Promise<InventoryItem[]> {
  if (isPostgresConfigured()) return pgStore.getInventoryPg(kitchenId);
  const all = getGlobalState().inventory;
  const filtered =
    kitchenId && kitchenId !== "ALL"
      ? all.filter((i) => i.kitchenId === kitchenId)
      : all;
  return filtered.map(cloneInventoryItem);
}

export async function getInventoryMovements(
  kitchenId?: string,
): Promise<InventoryMovement[]> {
  if (isPostgresConfigured()) return pgStore.getInventoryMovementsPg(kitchenId);
  const all = getGlobalState().inventoryMovements;
  const filtered =
    kitchenId && kitchenId !== "ALL"
      ? all.filter((m) => m.kitchenId === kitchenId)
      : all;
  return filtered.map((m) => ({ ...m }));
}

export async function getCancellations(): Promise<CancellationRecord[]> {
  if (isPostgresConfigured()) return pgStore.getCancellationsPg();
  return getGlobalState().cancellations.map((c) => ({
    ...c,
    restoredIngredients: c.restoredIngredients.map((r) => ({ ...r })),
    lostIngredients: c.lostIngredients.map((l) => ({ ...l })),
    dispatchEvidence: c.dispatchEvidence
      ? { ...c.dispatchEvidence }
      : undefined,
  }));
}

export async function getOrganizations(): Promise<Organization[]> {
  if (isPostgresConfigured()) return pgStore.getOrganizationsPg();
  return getGlobalState().organizations.map((o) => ({ ...o }));
}

export async function getActivities(): Promise<OperationalActivity[]> {
  if (isPostgresConfigured()) return pgStore.getActivitiesPg();
  return getGlobalState().activities.map((a) => ({ ...a }));
}

export async function getBrands(): Promise<BrandConfig[]> {
  if (isPostgresConfigured()) return pgStore.getBrandsPg();
  return getGlobalState().brands.map((b) => ({ ...b }));
}

export async function getKitchens(): Promise<KitchenConfig[]> {
  if (isPostgresConfigured()) return pgStore.getKitchensPg();
  return getGlobalState().kitchens.map((k) => ({ ...k }));
}

export async function getBrandKitchens(): Promise<BrandKitchenConfig[]> {
  if (isPostgresConfigured()) return pgStore.getBrandKitchensPg();
  return getGlobalState().brandKitchens.map((bk) => ({ ...bk }));
}

export async function getMenuCatalog(): Promise<MenuItem[]> {
  if (isPostgresConfigured()) return pgStore.getMenuCatalogPg();
  return getGlobalState().menuCatalog.map((m) => ({
    ...m,
    recipe: m.recipe.map((r) => ({ ...r })),
  }));
}

export async function getEmployees(): Promise<Employee[]> {
  if (isPostgresConfigured()) return pgStore.getEmployeesPg();
  return getGlobalState().employees.map((e) => ({ ...e }));
}

export async function getSettings(): Promise<SystemSettings> {
  if (isPostgresConfigured()) return pgStore.getSettingsPg();
  return { ...getGlobalState().settings };
}

export async function getFiles(): Promise<VirtualFileAsset[]> {
  if (isPostgresConfigured()) return pgStore.getFilesPg();
  return getGlobalState().files.map((f) => ({ ...f }));
}

export async function getLeakageVectors(): Promise<RevenueLeakageVector[]> {
  if (isPostgresConfigured()) return pgStore.getLeakageVectorsPg();
  return getGlobalState().leakageVectors.map((l) => ({ ...l }));
}

export async function getWebhookEvents(): Promise<WebhookIdempotencyEntry[]> {
  if (isPostgresConfigured()) return pgStore.getWebhookEventsPg();
  return getGlobalState().webhookEvents.map((w) => ({ ...w }));
}

export async function getOutboxEvents(): Promise<OutboxEvent[]> {
  if (isPostgresConfigured()) return pgStore.getOutboxEventsPg();
  return getGlobalState().outboxEvents.map((o) => ({ ...o }));
}

export async function getStoreSnapshot(): Promise<StoreSnapshot> {
  if (isPostgresConfigured()) return pgStore.getStoreSnapshotPg();
  return cloneState(getGlobalState());
}

export async function findOrder(orderId: string): Promise<Order | undefined> {
  if (isPostgresConfigured()) return pgStore.findOrderPg(orderId);
  const order = getGlobalState().orders.find((item) => item.id === orderId);
  return order ? cloneOrder(order) : undefined;
}

export async function getTaxInvoices(filters?: {
  organizationId?: string;
  kitchenId?: string;
  financialYear?: string;
  status?: TaxInvoiceStatus;
  from?: string;
  to?: string;
}): Promise<TaxInvoice[]> {
  if (isPostgresConfigured()) return pgStore.getTaxInvoicesPg(filters);
  const fromMs = filters?.from ? new Date(filters.from).getTime() : null;
  const toMs = filters?.to ? new Date(filters.to).getTime() : null;
  return getGlobalState()
    .taxInvoices.filter((inv) => {
      if (
        filters?.organizationId &&
        inv.organizationId !== filters.organizationId
      ) {
        return false;
      }
      if (
        filters?.kitchenId &&
        filters.kitchenId !== "ALL" &&
        inv.kitchenId !== filters.kitchenId
      ) {
        return false;
      }
      if (
        filters?.financialYear &&
        inv.financialYear !== filters.financialYear
      ) {
        return false;
      }
      if (filters?.status && inv.status !== filters.status) {
        return false;
      }
      const ts = new Date(inv.issuedAt).getTime();
      if (fromMs !== null && Number.isFinite(fromMs) && ts < fromMs) {
        return false;
      }
      if (toMs !== null && Number.isFinite(toMs) && ts > toMs) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const diff =
        new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime();
      return diff !== 0 ? diff : b.sequenceNumber - a.sequenceNumber;
    })
    .map((inv) => ({ ...inv }));
}

export async function findTaxInvoiceById(
  invoiceId: string,
): Promise<TaxInvoice | undefined> {
  if (isPostgresConfigured()) return pgStore.findTaxInvoiceByIdPg(invoiceId);
  const inv = getGlobalState().taxInvoices.find((i) => i.id === invoiceId);
  return inv ? { ...inv } : undefined;
}

export async function findTaxInvoiceByOrderId(
  orderId: string,
): Promise<TaxInvoice | undefined> {
  if (isPostgresConfigured()) return pgStore.findTaxInvoiceByOrderIdPg(orderId);
  const inv = getGlobalState().taxInvoices.find((i) => i.orderId === orderId);
  return inv ? { ...inv } : undefined;
}

export async function getPaymentTransactions(filters?: {
  organizationId?: string;
  kitchenId?: string;
  orderId?: string;
}): Promise<PaymentTransaction[]> {
  if (isPostgresConfigured()) return pgStore.getPaymentTransactionsPg(filters);
  return getGlobalState()
    .paymentTransactions.filter((txRow) => {
      if (
        filters?.organizationId &&
        txRow.organizationId !== filters.organizationId
      ) {
        return false;
      }
      if (
        filters?.kitchenId &&
        filters.kitchenId !== "ALL" &&
        txRow.kitchenId !== filters.kitchenId
      ) {
        return false;
      }
      if (filters?.orderId && txRow.orderId !== filters.orderId) {
        return false;
      }
      return true;
    })
    .map((txRow) => ({
      ...txRow,
      rawMeta: txRow.rawMeta ? { ...txRow.rawMeta } : undefined,
    }));
}

// -----------------------------------------------------------------------------
// Lifecycle Reset / Clear / Activity
// -----------------------------------------------------------------------------

export async function resetStore(): Promise<void> {
  if (isPostgresConfigured()) {
    await pgStore.resetStorePg();
    return;
  }
  await withMemoryLock(() => {
    globalThis.__darkit_os_store__ = buildInitialSeedState();
  });
}

export async function clearOrdersStore(): Promise<void> {
  if (isPostgresConfigured()) {
    await pgStore.clearOrdersStorePg();
    return;
  }
  await withMemoryLock(() => {
    const state = getGlobalState();
    state.orders = [];
    state.taxInvoices = [];
    state.paymentTransactions = [];
    state.cancellations = [];
    state.webhookEvents = [];
    state.outboxEvents = [];
    pushMemoryActivity(state, {
      type: "STORE_CLEARED",
      category: "SYSTEM",
      title: "Active Order Queue Cleared",
      details:
        "All orders, tax invoices, payment transactions, cancellations, webhook receipts, and outbox items cleared to demonstrate honest empty states across stations.",
      actor: "SYSTEM",
      severity: "warning",
    });
  });
}

export async function recordActivity(
  entry: Omit<OperationalActivity, "id" | "timestamp"> & {
    timestamp?: string;
  },
): Promise<OperationalActivity> {
  if (isPostgresConfigured()) {
    return pgStore.recordActivityPg(entry);
  }
  return withMemoryLock(() => pushMemoryActivity(getGlobalState(), entry));
}

// -----------------------------------------------------------------------------
// Order Injection (Canonical Intake + Atomic Deduplication)
// -----------------------------------------------------------------------------

async function resolveKitchenOrganizationId(kitchenId: string): Promise<string> {
  try {
    const kitchens = await getKitchens();
    const found = kitchens.find((k) => k.id === kitchenId);
    return found?.organizationId ?? DEFAULT_ORGANIZATION_ID;
  } catch {
    return DEFAULT_ORGANIZATION_ID;
  }
}

export async function injectCanonicalOrder(
  input: InjectOrderInput,
): Promise<InjectOrderResult> {
  const result = isPostgresConfigured()
    ? await pgStore.injectCanonicalOrderPg(input)
    : await withMemoryLock(() =>
        runMemoryTransaction((state) => {
          const now = new Date().toISOString();

          // 1. Validate Brand
          const brand = state.brands.find(
            (b) => b.id === input.brandId && b.active,
          );
          if (!brand) {
            throw new Error(
              `Invalid or inactive virtual brand: ${input.brandId}`,
            );
          }

          // 2. Validate Kitchen
          const kitchen = state.kitchens.find(
            (k) => k.id === input.kitchenId && k.active,
          );
          if (!kitchen) {
            throw new Error(
              `Invalid or inactive physical kitchen: ${input.kitchenId}`,
            );
          }

          // 3. Enforce Canonical BrandKitchen Mapping
          const mapping = state.brandKitchens.find(
            (bk) =>
              bk.brandId === input.brandId &&
              bk.kitchenId === input.kitchenId &&
              bk.active,
          );
          if (!mapping) {
            throw new Error(
              `BrandKitchen violation: ${input.brandId} is not authorized to operate out of kitchen ${input.kitchenId}.`,
            );
          }

          // 4. Validate Items BEFORE claiming idempotency key
          if (!Array.isArray(input.items) || input.items.length === 0) {
            throw new Error("Order must contain at least one menu item.");
          }

          const validatedItems = input.items.map((raw) => {
            const menu = state.menuCatalog.find(
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

          // 5. Two-Phase Atomic Idempotency Check
          const idemKey = input.idempotencyKey?.trim();
          if (idemKey) {
            const existingWebhook = state.webhookEvents.find(
              (w) => w.idempotencyKey === idemKey,
            );
            if (existingWebhook) {
              existingWebhook.hitCount += 1;
              const existingOrder = state.orders.find(
                (o) => o.id === existingWebhook.orderId,
              );
              if (existingOrder) {
                pushMemoryActivity(state, {
                  organizationId:
                    existingOrder.organizationId ??
                    kitchen.organizationId ??
                    DEFAULT_ORGANIZATION_ID,
                  type: "WEBHOOK_DEDUPLICATED",
                  category: "CLOUD7",
                  title: `Idempotent Replay Blocked (${idemKey})`,
                  details: `Duplicate webhook payload intercepted via ON CONFLICT DO NOTHING. Returned cached order ${existingOrder.id} (Hit #${existingWebhook.hitCount}).`,
                  actor: input.actor,
                  orderId: existingOrder.id,
                  kitchenId: existingOrder.kitchenId,
                  brandId: existingOrder.brandId,
                  severity: "warning",
                });
                const existingInvoice = state.taxInvoices.find(
                  (inv) => inv.orderId === existingOrder.id,
                );
                return {
                  order: cloneOrder(existingOrder),
                  invoice: existingInvoice ? { ...existingInvoice } : undefined,
                  idempotentReplay: true,
                  inventoryDecision:
                    existingOrder.inventoryDecision ?? "AVAILABLE",
                  inventoryWarnings: existingOrder.inventoryWarnings ?? [],
                  inventoryUnavailable: existingOrder.inventoryUnavailable ?? [],
                };
              }
            }
          }

          let orderId = input.id?.trim();
          if (orderId) {
            if (state.orders.some((o) => o.id === orderId)) {
              throw new Error(`Order ID already exists: ${orderId}`);
            }
          } else {
            let attempts = 0;
            do {
              const suffix = Math.floor(1000 + Math.random() * 9000);
              orderId =
                attempts < 20
                  ? `ORD-${suffix}`
                  : `ORD-${Date.now().toString().slice(-6)}-${suffix}`;
              attempts += 1;
            } while (state.orders.some((o) => o.id === orderId));
          }

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

          const itemsSubtotal = calculateOrderTotalAmount(
            resolvedItems,
            state.menuCatalog,
          );
          const packagingFee = round2(
            Math.max(0, Number(input.packagingFee) || 0),
          );
          const itemCount = resolvedItems.reduce(
            (sum, item) => sum + item.quantity,
            0,
          );

          const channel: OrderChannel = CHANNEL_SOURCE_MAP[input.channel]
            ? input.channel
            : "Direct Web";
          const resolvedSource =
            input.source || CHANNEL_SOURCE_MAP[channel] || "MANUAL";
          const resolvedPaymentStatus: OrderPaymentStatus =
            input.paymentStatus ??
            (resolvedSource === "DIRECT_WEB" ? "UNPAID" : "AGGREGATOR_SETTLED");

          const resolvedOrganizationId =
            input.organizationId?.trim() ||
            kitchen.organizationId ||
            DEFAULT_ORGANIZATION_ID;

          const org = state.organizations.find(
            (o) => o.id === resolvedOrganizationId,
          );
          const sellerStateCode = kitchen.stateCode || "06";
          const gstBreakup = calculateIndianGstBreakup({
            itemsSubtotal,
            packagingFee,
            sellerStateCode,
            placeOfSupplyStateCode:
              input.placeOfSupplyStateCode || sellerStateCode,
            gstRatePct: 5,
          });
          const totalAmount = gstBreakup.grandTotal;

          const financialYear = getIndianFinancialYear(now);
          const currentMaxSeq = state.taxInvoices
            .filter(
              (inv) =>
                inv.organizationId === resolvedOrganizationId &&
                inv.financialYear === financialYear &&
                inv.kitchenId === kitchen.id,
            )
            .reduce((max, inv) => Math.max(max, inv.sequenceNumber), 0);
          const sequenceNumber = currentMaxSeq + 1;
          const invoiceId = makeId("INV");
          const invoiceNumber = formatTaxInvoiceNumber({
            financialYear,
            kitchenCode: kitchen.code,
            sequenceNumber,
          });

          const draftOrder: Order = {
            id: orderId,
            organizationId: resolvedOrganizationId,
            externalOrderId:
              input.externalOrderId ||
              `${channel.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
            idempotencyKey: idemKey || `idem-${orderId.toLowerCase()}`,
            brandId: input.brandId,
            kitchenId: input.kitchenId,
            channel,
            source: resolvedSource,
            status: "PENDING",
            priority: input.priority || "NORMAL",
            items: resolvedItems,
            subtotalAmount: gstBreakup.itemsSubtotal,
            packagingAmount: gstBreakup.packagingFee,
            cgstAmount: gstBreakup.cgstAmount,
            sgstAmount: gstBreakup.sgstAmount,
            igstAmount: gstBreakup.igstAmount,
            taxAmount: gstBreakup.totalTax,
            totalAmount,
            paymentStatus: resolvedPaymentStatus,
            invoiceId,
            placeOfSupplyStateCode: gstBreakup.placeOfSupplyStateCode,
            customerGstin: input.customerGstin?.trim() || undefined,
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

          const taxInvoice: TaxInvoice = {
            id: invoiceId,
            organizationId: resolvedOrganizationId,
            kitchenId: kitchen.id,
            orderId,
            invoiceNumber,
            financialYear,
            sequenceNumber,
            issuedAt: now,
            sellerGstin:
              kitchen.gstin || org?.gstin || "06AABCD1234E1Z5",
            sellerFssai:
              kitchen.fssaiLicense || org?.fssaiLicense || "10824999000412",
            sellerStateCode: gstBreakup.sellerStateCode,
            placeOfSupplyStateCode: gstBreakup.placeOfSupplyStateCode,
            customerName: draftOrder.customerName,
            customerGstin: draftOrder.customerGstin,
            taxableSubtotal: gstBreakup.taxableSubtotal,
            packagingFee: gstBreakup.packagingFee,
            cgstRate: gstBreakup.cgstRate,
            cgstAmount: gstBreakup.cgstAmount,
            sgstRate: gstBreakup.sgstRate,
            sgstAmount: gstBreakup.sgstAmount,
            igstRate: gstBreakup.igstRate,
            igstAmount: gstBreakup.igstAmount,
            totalTax: gstBreakup.totalTax,
            grandTotal: gstBreakup.grandTotal,
            status: "ISSUED",
            createdAt: now,
          };

          // 6. Per-Kitchen Inventory Availability Evaluation
          const evaluation = evaluateOrderInventory(
            draftOrder,
            state.inventory,
            state.menuCatalog,
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
            {
              id: `${orderId}-EVT-INV`,
              type: "INVOICE_ISSUED",
              timestamp: now,
              actor: "SYSTEM",
              details: `GST Tax Invoice ${invoiceNumber} issued (Taxable ₹${gstBreakup.taxableSubtotal.toFixed(2)}, GST ₹${gstBreakup.totalTax.toFixed(2)}, Grand Total ₹${gstBreakup.grandTotal.toFixed(2)}).`,
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

          // 7. Save Order, TaxInvoice, Webhook Receipt, Outbox, Activity
          state.orders.unshift(cloneOrder(draftOrder));
          state.taxInvoices.unshift({ ...taxInvoice });

          state.webhookEvents.unshift({
            idempotencyKey: draftOrder.idempotencyKey!,
            orderId: draftOrder.id,
            status: "completed",
            channel: draftOrder.channel,
            brandId: draftOrder.brandId,
            kitchenId: draftOrder.kitchenId,
            payloadSummary: `${draftOrder.brandId} • ${itemCount} item(s) • ${formatCurrency(totalAmount, state.settings.currency)}`,
            createdAt: now,
            hitCount: 1,
          });

          state.outboxEvents.unshift({
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
            createdAt: now,
          });

          pushMemoryActivity(state, {
            organizationId: resolvedOrganizationId,
            type: "ORDER_CREATED",
            category: "ORDER",
            title: `Order ${draftOrder.id} Injected (${draftOrder.brandId})`,
            details: `${itemCount} item(s) (${formatCurrency(totalAmount, state.settings.currency)}) via ${draftOrder.channel} → ${kitchen.name} (${evaluation.inventoryDecision}).`,
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
            order: cloneOrder(draftOrder),
            invoice: { ...taxInvoice },
            idempotentReplay: false,
            inventoryDecision: evaluation.inventoryDecision,
            inventoryWarnings: evaluation.lowStockItems,
            inventoryUnavailable: evaluation.insufficientStockItems,
          };
        }),
      );

  if (!result.idempotentReplay) {
    const orgId =
      result.order.organizationId ??
      (await resolveKitchenOrganizationId(result.order.kitchenId));
    await publishKitchenRealtimeEvent({
      type: "ORDER_CREATED",
      organizationId: orgId,
      kitchenId: result.order.kitchenId,
      orderId: result.order.id,
      status: result.order.status,
      brandId: result.order.brandId,
      actor: input.actor,
    });
    if (result.inventoryWarnings.length > 0) {
      await publishKitchenRealtimeEvent({
        type: "STOCK_LOW_ALERT",
        organizationId: orgId,
        kitchenId: result.order.kitchenId,
        orderId: result.order.id,
        details: result.inventoryWarnings.join(", "),
      });
    }
  }

  return result;
}

// -----------------------------------------------------------------------------
// Order Status Transitions & Stage-Aware Cancellations
// -----------------------------------------------------------------------------

export async function transitionCanonicalOrder(
  input: TransitionOrderInput,
): Promise<TransitionOrderResult> {
  const result = isPostgresConfigured()
    ? await pgStore.transitionCanonicalOrderPg(input)
    : await withMemoryLock(() => {
        let blockedInsufficientStock: string[] | null = null;

        const inner = runMemoryTransaction((state) => {
          const index = state.orders.findIndex((o) => o.id === input.orderId);
          if (index === -1) {
            throw new Error(`Order not found: ${input.orderId}`);
          }

          const currentOrder = cloneOrder(state.orders[index]);
          const now = new Date().toISOString();

          if (currentOrder.status === input.nextStatus) {
            const existingCancel =
              input.nextStatus === "CANCELLED"
                ? state.cancellations.find(
                    (c) => c.orderId === currentOrder.id,
                  )
                : undefined;
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

          if (input.nextStatus === "CANCELLED") {
            return executeStageAwareCancellationMemory(
              state,
              currentOrder,
          index,
          input,
          now,
        );
      }

      let depletedItems: string[] = [];
      let lowStockAlerts: string[] = [];

      if (input.nextStatus === "PREPARING") {
        if (!currentOrder.inventoryConsumed) {
          const requirements = getRequiredIngredients(
            currentOrder,
            state.menuCatalog,
          );
          const depletion = processOrderDepletion(
            currentOrder,
            state.inventory,
            state.menuCatalog,
          );

          if (depletion.inventoryDecision === "INSUFFICIENT_STOCK") {
            currentOrder.inventoryDecision = "INSUFFICIENT_STOCK";
            currentOrder.inventoryUnavailable =
              depletion.insufficientStockItems;
            currentOrder.updatedAt = now;
            currentOrder.events.push({
              id: makeId(`${currentOrder.id}-EVT`),
              type: "INVENTORY_UNAVAILABLE",
              timestamp: now,
              actor: input.actor,
              details: `Preparation blocked at ${currentOrder.kitchenId} due to insufficient stock: ${depletion.insufficientStockItems.join(", ")}`,
            });
            state.orders[index] = cloneOrder(currentOrder);
            pushMemoryActivity(state, {
              type: "INVENTORY_BLOCKED",
              category: "INVENTORY",
              title: `${currentOrder.id} Prep Blocked (Out of Stock)`,
              details: `Insufficient inventory at ${currentOrder.kitchenId} prevented PENDING -> PREPARING: ${depletion.insufficientStockItems.join(", ")}.`,
              actor: input.actor,
              orderId: currentOrder.id,
              kitchenId: currentOrder.kitchenId,
              brandId: currentOrder.brandId,
              timestamp: now,
              severity: "error",
            });
            blockedInsufficientStock = depletion.insufficientStockItems;
            return {
              order: cloneOrder(currentOrder),
              idempotentReplay: false,
            };
          }

          for (const [invId, reqQty] of requirements) {
            if (reqQty <= 0) continue;
            const beforeItem = findMemoryInventoryItem(
              state.inventory,
              invId,
              currentOrder.kitchenId,
            );
            const afterItem = findMemoryInventoryItem(
              depletion.updatedInventory,
              invId,
              currentOrder.kitchenId,
            );
            if (beforeItem && afterItem) {
              state.inventoryMovements.unshift({
                id: makeId("MOV"),
                inventoryItemId: beforeItem.id,
                itemName: beforeItem.name,
                sku: beforeItem.sku,
                kitchenId: currentOrder.kitchenId,
                type: "SALE_CONSUMPTION",
                quantity: -reqQty,
                previousStock: beforeItem.currentStock,
                newStock: afterItem.currentStock,
                unit: beforeItem.unit,
                costImpact: round2(reqQty * beforeItem.costPerUnit),
                orderId: currentOrder.id,
                actor: input.actor,
                reason: `Recipe consumption on PENDING -> PREPARING for ${currentOrder.id} (${currentOrder.kitchenId})`,
                timestamp: now,
              });
            }
          }

          state.inventory = depletion.updatedInventory;
          currentOrder.inventoryConsumed = true;
          currentOrder.inventoryDecision = depletion.inventoryDecision;
          currentOrder.inventoryWarnings =
            depletion.lowStockAlerts.length > 0
              ? depletion.lowStockAlerts
              : currentOrder.inventoryWarnings;
          currentOrder.inventoryUnavailable = undefined;
          depletedItems = depletion.depletedItems;
          lowStockAlerts = depletion.lowStockAlerts;
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
      currentOrder.status = input.nextStatus;
      currentOrder.updatedAt = now;

      const eventDetails =
        input.nextStatus === "PREPARING"
          ? `Preparation started (${previousStatus} -> PREPARING) at ${currentOrder.kitchenId}. Depleted: ${depletedItems.join(", ") || "No raw recipe items"}.`
          : input.nextStatus === "DRIVER_ASSIGNED"
            ? `Driver ${currentOrder.driverName} assigned (ETA ${currentOrder.courierEtaMins}m).`
            : `Order transitioned ${previousStatus} -> ${input.nextStatus}.`;

      currentOrder.events.push({
        id: makeId(`${currentOrder.id}-EVT`),
        type: input.nextStatus === "PENDING" ? "RECEIVED" : input.nextStatus,
        timestamp: now,
        actor: input.actor,
        details: eventDetails,
      });

      if (lowStockAlerts.length > 0) {
        currentOrder.events.push({
          id: makeId(`${currentOrder.id}-WARN`),
          type: "INVENTORY_WARNING",
          timestamp: now,
          actor: "SYSTEM",
          details: `Reorder threshold breached at ${currentOrder.kitchenId} for: ${lowStockAlerts.join(", ")}.`,
        });
      }

      state.orders[index] = cloneOrder(currentOrder);

      pushMemoryActivity(state, {
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

      return {
        order: cloneOrder(currentOrder),
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

        return inner;
      });

  let finalResult = result;

  if (
    !result.idempotentReplay &&
    result.order.status === "CANCELLED" &&
    result.cancellationRecord?.stage === "BEFORE_PREP" &&
    (result.order.source === "DIRECT_WEB" ||
      result.order.channel === "Direct Web") &&
    result.order.paymentStatus === "CAPTURED"
  ) {
    const txs = await getPaymentTransactions({ orderId: result.order.id });
    const capturedTx = txs.find(
      (t) => t.status === "CAPTURED" && Boolean(t.providerPaymentId),
    );
    if (capturedTx?.providerPaymentId) {
      const refund = await refundRazorpayPayment({
        paymentId: capturedTx.providerPaymentId,
        amountInr: capturedTx.amount,
        notes: {
          orderId: result.order.id,
          reason: result.cancellationRecord.reason,
        },
      });
      const refunded = await recordPaymentRefund({
        transactionId: capturedTx.id,
        orderId: result.order.id,
        providerRefundId: refund.providerRefundId,
        refundedAmount: refund.amountInr,
        actor: input.actor,
        reason: result.cancellationRecord.reason,
        rawMeta: { mode: refund.mode, status: refund.status },
      });
      finalResult = {
        ...result,
        order: refunded.order,
        refundTransaction: refunded.transaction,
      };
    }
  }

  if (!finalResult.idempotentReplay) {
    const orgId =
      finalResult.order.organizationId ??
      (await resolveKitchenOrganizationId(finalResult.order.kitchenId));
    await publishKitchenRealtimeEvent({
      type:
        finalResult.order.status === "CANCELLED"
          ? "ORDER_CANCELLED"
          : "ORDER_STATUS_CHANGED",
      organizationId: orgId,
      kitchenId: finalResult.order.kitchenId,
      orderId: finalResult.order.id,
      status: finalResult.order.status,
      brandId: finalResult.order.brandId,
      actor: input.actor,
    });
    if (finalResult.refundTransaction) {
      await publishKitchenRealtimeEvent({
        type: "PAYMENT_REFUNDED",
        organizationId: orgId,
        kitchenId: finalResult.order.kitchenId,
        orderId: finalResult.order.id,
        status: finalResult.order.paymentStatus,
        brandId: finalResult.order.brandId,
        actor: input.actor,
        details: `Refund ${finalResult.refundTransaction.providerRefundId} processed`,
      });
    }
    if (finalResult.lowStockAlerts && finalResult.lowStockAlerts.length > 0) {
      await publishKitchenRealtimeEvent({
        type: "STOCK_LOW_ALERT",
        organizationId: orgId,
        kitchenId: finalResult.order.kitchenId,
        orderId: finalResult.order.id,
        details: finalResult.lowStockAlerts.join(", "),
      });
    }
  }

  return finalResult;
}

export const createCanonicalOrder = injectCanonicalOrder;

export async function cancelCanonicalOrder(
  input: Omit<TransitionOrderInput, "nextStatus">,
): Promise<TransitionOrderResult> {
  return transitionCanonicalOrder({
    ...input,
    nextStatus: "CANCELLED",
  });
}

function executeStageAwareCancellationMemory(
  state: KitchenState,
  currentOrder: Order,
  orderIndex: number,
  input: TransitionOrderInput,
  now: string,
): TransitionOrderResult {
  const previousStatus = currentOrder.status;
  const requirements = getRequiredIngredients(currentOrder, state.menuCatalog);
  const recipeCost = calculateOrderRecipeCost(
    currentOrder,
    state.inventory,
    state.menuCatalog,
  );
  const orderValue =
    currentOrder.totalAmount ??
    calculateOrderTotalAmount(currentOrder.items, state.menuCatalog);

  let stage: CancellationStage = "BEFORE_PREP";
  let resolution: CancellationResolution = "INVENTORY_RESTORED";
  let financialLoss = 0;
  let claimAmount = 0;
  const restoredIngredients: CancellationRecord["restoredIngredients"] = [];
  const lostIngredients: CancellationRecord["lostIngredients"] = [];

  const shouldRestorePrePrep = input.restoreInventoryOnPrePrepCancel !== false;

  if (previousStatus === "PENDING") {
    stage = "BEFORE_PREP";
    if (currentOrder.inventoryConsumed) {
      if (shouldRestorePrePrep) {
        resolution = "INVENTORY_RESTORED";
        for (const [invId, qty] of requirements) {
          const item = findMemoryInventoryItem(
            state.inventory,
            invId,
            currentOrder.kitchenId,
          );
          if (item && qty > 0) {
            const prevStock = item.currentStock;
            item.currentStock = round4(item.currentStock + qty);
            restoredIngredients.push({
              inventoryItemId: item.id,
              name: item.name,
              quantity: qty,
            });
            state.inventoryMovements.unshift({
              id: makeId("MOV"),
              inventoryItemId: item.id,
              itemName: item.name,
              sku: item.sku,
              kitchenId: currentOrder.kitchenId,
              type: "CANCELLATION_RESTORE",
              quantity: qty,
              previousStock: prevStock,
              newStock: item.currentStock,
              unit: item.unit,
              costImpact: round2(qty * item.costPerUnit),
              orderId: currentOrder.id,
              actor: input.actor,
              reason: `Pre-prep cancellation stock restoration for ${currentOrder.id}`,
              timestamp: now,
            });
          }
        }
        currentOrder.inventoryRestored = true;
      } else {
        resolution = "UNAVOIDABLE_LOSS";
        financialLoss = recipeCost;
        for (const [invId, qty] of requirements) {
          const item = findMemoryInventoryItem(
            state.inventory,
            invId,
            currentOrder.kitchenId,
          );
          if (item && qty > 0) {
            lostIngredients.push({
              inventoryItemId: item.id,
              name: item.name,
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

    for (const [invId, qty] of requirements) {
      const item = findMemoryInventoryItem(
        state.inventory,
        invId,
        currentOrder.kitchenId,
      );
      if (item && qty > 0) {
        lostIngredients.push({
          inventoryItemId: item.id,
          name: item.name,
          quantity: qty,
        });
        state.inventoryMovements.unshift({
          id: makeId("MOV"),
          inventoryItemId: item.id,
          itemName: item.name,
          sku: item.sku,
          kitchenId: currentOrder.kitchenId,
          type: "LOSS",
          quantity: 0,
          previousStock: item.currentStock,
          newStock: item.currentStock,
          unit: item.unit,
          costImpact: round2(qty * item.costPerUnit),
          orderId: currentOrder.id,
          actor: input.actor,
          reason: `Mid-prep cancellation Food & Labor Loss (${previousStatus}); blocked from usable stock return`,
          timestamp: now,
        });
      }
    }
  } else {
    stage = "AFTER_PICKUP";
    resolution = "AGGREGATOR_ACCOUNTING_CLAIM";
    financialLoss = recipeCost;
    claimAmount = orderValue;

    for (const [invId, qty] of requirements) {
      const item = findMemoryInventoryItem(
        state.inventory,
        invId,
        currentOrder.kitchenId,
      );
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

  currentOrder.status = "CANCELLED";
  currentOrder.updatedAt = now;
  currentOrder.cancelledAt = now;
  currentOrder.cancelledBy = input.actor;
  currentOrder.cancellationSource = source;
  currentOrder.cancellationReason = reason;
  currentOrder.cancellationStage = stage;
  currentOrder.cancellationResolution = resolution;
  currentOrder.lossAmount = financialLoss;
  currentOrder.claimAmount = claimAmount;

  const formattedLoss = formatCurrency(financialLoss, state.settings.currency);
  const formattedClaim = formatCurrency(claimAmount, state.settings.currency);

  currentOrder.events.push({
    id: makeId(`${currentOrder.id}-CANCEL`),
    type: "CANCELLED",
    timestamp: now,
    actor: input.actor,
    details: `Order cancelled at ${previousStatus} (${stage}) -> ${resolution}. Loss: ${formattedLoss}, Claim: ${formattedClaim}.`,
  });

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
    dispatchEvidence:
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
        : undefined,
  };

  let creditNoteInvoice: TaxInvoice | undefined;
  if (stage === "BEFORE_PREP") {
    const inv = state.taxInvoices.find(
      (i) => i.orderId === currentOrder.id && i.status === "ISSUED",
    );
    if (inv) {
      inv.status = "CREDIT_NOTE";
      inv.voidedAt = now;
      inv.voidReason = reason;
      creditNoteInvoice = { ...inv };
      currentOrder.events.push({
        id: makeId(`${currentOrder.id}-CN`),
        type: "INVOICE_CREDITED",
        timestamp: now,
        actor: input.actor,
        details: `GST Tax Invoice ${inv.invoiceNumber} converted to CREDIT_NOTE (pre-prep cancellation). Reason: ${reason}.`,
      });
    }
  }

  state.orders[orderIndex] = cloneOrder(currentOrder);
  state.cancellations.unshift(cancellationRecord);

  pushMemoryActivity(state, {
    organizationId: currentOrder.organizationId ?? DEFAULT_ORGANIZATION_ID,
    type: "ORDER_CANCELLED",
    category: "CANCELLATION",
    title: `${currentOrder.id} Cancelled (${stage.replaceAll("_", " ")})`,
    details: `Resolution: ${resolution.replaceAll("_", " ")} • Loss: ${formattedLoss} • Claim: ${formattedClaim}.${creditNoteInvoice ? ` • GST Invoice ${creditNoteInvoice.invoiceNumber} -> CREDIT_NOTE.` : ""}`,
    actor: input.actor,
    orderId: currentOrder.id,
    kitchenId: currentOrder.kitchenId,
    brandId: currentOrder.brandId,
    timestamp: now,
    severity: stage === "BEFORE_PREP" ? "warning" : "error",
  });

  return {
    order: cloneOrder(currentOrder),
    idempotentReplay: false,
    cancellationRecord,
    creditNoteInvoice,
  };
}

// -----------------------------------------------------------------------------
// Per-Kitchen Inventory Mutations & Atomic Inter-Kitchen Stock Transfers
// -----------------------------------------------------------------------------

export async function mutateCanonicalInventory(
  input: InventoryMutationInput,
): Promise<InventoryMutationResult> {
  const result = isPostgresConfigured()
    ? await pgStore.mutateCanonicalInventoryPg(input)
    : await withMemoryLock(() =>
        runMemoryTransaction((state) => {
          const targetKitchenId = input.kitchenId?.trim() || "K1";
          const idx = state.inventory.findIndex(
            (i) =>
              (i.id === input.itemId || i.ingredientId === input.itemId) &&
              i.kitchenId === targetKitchenId,
          );
          if (idx === -1) {
            throw new Error(
              `Inventory item not found in kitchen ${targetKitchenId}: ${input.itemId}`,
            );
          }

          const existing = { ...state.inventory[idx] };
          const previousStock = existing.currentStock;
          const now = new Date().toISOString();

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

          const updatedItem: InventoryItem = {
            ...existing,
            currentStock: nextStock,
            lastRestocked:
              nextStock > previousStock ? now : existing.lastRestocked,
          };

          state.inventory[idx] = updatedItem;

          const movement: InventoryMovement = {
            id: makeId("MOV"),
            inventoryItemId: updatedItem.id,
            itemName: updatedItem.name,
            sku: updatedItem.sku,
            kitchenId: targetKitchenId,
            type: movementType,
            quantity: delta,
            previousStock,
            newStock: nextStock,
            unit: updatedItem.unit,
            costImpact: round2(Math.abs(delta) * updatedItem.costPerUnit),
            actor: input.actor,
            reason:
              input.reason?.trim() ||
              `${movementType.replaceAll("_", " ")} (${previousStock} -> ${nextStock} ${updatedItem.unit})`,
            timestamp: now,
          };

          state.inventoryMovements.unshift(movement);

          pushMemoryActivity(state, {
            type: `INVENTORY_${movementType}`,
            category: "INVENTORY",
            title: `${updatedItem.name} (${targetKitchenId}): ${previousStock} → ${nextStock} ${updatedItem.unit}`,
            details: `${movement.reason} (Cost impact: ${formatCurrency(movement.costImpact, state.settings.currency)})`,
            actor: input.actor,
            kitchenId: targetKitchenId,
            timestamp: now,
            severity:
              movementType === "WASTE" || movementType === "LOSS"
                ? "error"
                : nextStock <= updatedItem.reorderThreshold
                  ? "warning"
                  : "success",
          });

          return {
            item: { ...updatedItem },
            movement: { ...movement },
            inventory: state.inventory.map(cloneInventoryItem),
          };
        }),
      );

  const kitchenId = result.item.kitchenId ?? input.kitchenId ?? "K1";
  const orgId = await resolveKitchenOrganizationId(kitchenId);
  await publishKitchenRealtimeEvent({
    type: "INVENTORY_UPDATED",
    organizationId: orgId,
    kitchenId,
    ingredientId: result.item.id,
    itemName: result.item.name,
    currentStock: result.item.currentStock,
    reorderThreshold: result.item.reorderThreshold,
    actor: input.actor,
  });
  if (result.item.currentStock <= result.item.reorderThreshold) {
    await publishKitchenRealtimeEvent({
      type: "STOCK_LOW_ALERT",
      organizationId: orgId,
      kitchenId,
      ingredientId: result.item.id,
      itemName: result.item.name,
      currentStock: result.item.currentStock,
      reorderThreshold: result.item.reorderThreshold,
      actor: input.actor,
    });
  }

  return result;
}

export async function transferKitchenInventory(
  input: TransferInventoryInput,
): Promise<TransferInventoryResult> {
  const result = isPostgresConfigured()
    ? await pgStore.transferKitchenInventoryPg(input)
    : await withMemoryLock(() =>
        runMemoryTransaction((state) => {
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

          if (!state.kitchens.some((k) => k.id === fromKitchenId)) {
            throw new Error(`Source kitchen not found: ${fromKitchenId}`);
          }
          if (!state.kitchens.some((k) => k.id === toKitchenId)) {
            throw new Error(`Destination kitchen not found: ${toKitchenId}`);
          }

          const fromIdx = state.inventory.findIndex(
            (i) =>
              (i.id === itemId || i.ingredientId === itemId) &&
              i.kitchenId === fromKitchenId,
          );
          const toIdx = state.inventory.findIndex(
            (i) =>
              (i.id === itemId || i.ingredientId === itemId) &&
              i.kitchenId === toKitchenId,
          );

          if (fromIdx === -1) {
            throw new Error(
              `Inventory item ${itemId} not found in source kitchen ${fromKitchenId}.`,
            );
          }
          if (toIdx === -1) {
            throw new Error(
              `Inventory item ${itemId} not found in destination kitchen ${toKitchenId}.`,
            );
          }

          const fromRow = { ...state.inventory[fromIdx] };
          const toRow = { ...state.inventory[toIdx] };

          if (fromRow.currentStock < qty) {
            throw new Error(
              `Insufficient stock in ${fromKitchenId} for ${fromRow.name}: requested ${qty} ${fromRow.unit}, available ${fromRow.currentStock} ${fromRow.unit}.`,
            );
          }

          const now = new Date().toISOString();
          const fromPrev = fromRow.currentStock;
          const toPrev = toRow.currentStock;
          const fromNext = round4(fromPrev - qty);
          const toNext = round4(toPrev + qty);

          fromRow.currentStock = fromNext;
          toRow.currentStock = toNext;
          toRow.lastRestocked = now;

          state.inventory[fromIdx] = fromRow;
          state.inventory[toIdx] = toRow;

          const transferGroupId = makeId("XFER");
          const costImpact = round2(qty * fromRow.costPerUnit);
          const reasonText =
            input.reason?.trim() ||
            `Inter-kitchen stock transfer ${fromKitchenId} → ${toKitchenId}`;

          const outMovement: InventoryMovement = {
            id: makeId("MOV"),
            inventoryItemId: fromRow.id,
            itemName: fromRow.name,
            sku: fromRow.sku,
            kitchenId: fromKitchenId,
            type: "TRANSFER_OUT",
            quantity: -qty,
            previousStock: fromPrev,
            newStock: fromNext,
            unit: fromRow.unit,
            costImpact,
            transferGroupId,
            actor: input.actor,
            reason: `${reasonText} (to ${toKitchenId})`,
            timestamp: now,
          };

          const inMovement: InventoryMovement = {
            id: makeId("MOV"),
            inventoryItemId: toRow.id,
            itemName: toRow.name,
            sku: toRow.sku,
            kitchenId: toKitchenId,
            type: "TRANSFER_IN",
            quantity: qty,
            previousStock: toPrev,
            newStock: toNext,
            unit: toRow.unit,
            costImpact,
            transferGroupId,
            actor: input.actor,
            reason: `${reasonText} (from ${fromKitchenId})`,
            timestamp: now,
          };

          state.inventoryMovements.unshift(inMovement, outMovement);

          pushMemoryActivity(state, {
            type: "INVENTORY_TRANSFER",
            category: "INVENTORY",
            title: `Stock Transfer: ${qty} ${fromRow.unit} ${fromRow.name} (${fromKitchenId} → ${toKitchenId})`,
            details: `${reasonText} • Group ${transferGroupId} • Stock value: ${formatCurrency(costImpact, state.settings.currency)}.`,
            actor: input.actor,
            kitchenId: toKitchenId,
            timestamp: now,
            severity: "success",
          });

          return {
            transferGroupId,
            fromItem: cloneInventoryItem(fromRow),
            toItem: cloneInventoryItem(toRow),
            outMovement: { ...outMovement },
            inMovement: { ...inMovement },
            inventory: state.inventory.map(cloneInventoryItem),
          };
        }),
      );

  const fromOrgId = await resolveKitchenOrganizationId(input.fromKitchenId);
  const toOrgId = await resolveKitchenOrganizationId(input.toKitchenId);
  await Promise.all([
    publishKitchenRealtimeEvent({
      type: "INVENTORY_UPDATED",
      organizationId: fromOrgId,
      kitchenId: input.fromKitchenId,
      ingredientId: result.fromItem.id,
      itemName: result.fromItem.name,
      currentStock: result.fromItem.currentStock,
      reorderThreshold: result.fromItem.reorderThreshold,
      actor: input.actor,
    }),
    publishKitchenRealtimeEvent({
      type: "INVENTORY_UPDATED",
      organizationId: toOrgId,
      kitchenId: input.toKitchenId,
      ingredientId: result.toItem.id,
      itemName: result.toItem.name,
      currentStock: result.toItem.currentStock,
      reorderThreshold: result.toItem.reorderThreshold,
      actor: input.actor,
    }),
  ]);
  if (result.fromItem.currentStock <= result.fromItem.reorderThreshold) {
    await publishKitchenRealtimeEvent({
      type: "STOCK_LOW_ALERT",
      organizationId: fromOrgId,
      kitchenId: input.fromKitchenId,
      ingredientId: result.fromItem.id,
      itemName: result.fromItem.name,
      currentStock: result.fromItem.currentStock,
      reorderThreshold: result.fromItem.reorderThreshold,
      actor: input.actor,
    });
  }

  return result;
}

// -----------------------------------------------------------------------------
// System & Admin Mutations
// -----------------------------------------------------------------------------

export async function toggleBrandKitchenMapping(
  brandId: DbaBrand,
  kitchenId: string,
  actor: string,
): Promise<BrandKitchenConfig[]> {
  if (isPostgresConfigured()) {
    return pgStore.toggleBrandKitchenMappingPg(brandId, kitchenId, actor);
  }
  return withMemoryLock(() =>
    runMemoryTransaction((state) => {
      const existing = state.brandKitchens.find(
        (bk) => bk.brandId === brandId && bk.kitchenId === kitchenId,
      );
      if (existing) {
        existing.active = !existing.active;
      } else {
        state.brandKitchens.push({ brandId, kitchenId, active: true });
      }

      const activeState =
        state.brandKitchens.find(
          (bk) => bk.brandId === brandId && bk.kitchenId === kitchenId,
        )?.active ?? false;

      pushMemoryActivity(state, {
        type: "BRAND_KITCHEN_UPDATED",
        category: "SYSTEM",
        title: `BrandKitchen Matrix: ${brandId} ↔ ${kitchenId} ${activeState ? "ENABLED" : "DISABLED"}`,
        details: `Production authorization between ${brandId} and ${kitchenId} set to ${activeState}.`,
        actor,
        kitchenId,
        brandId,
        severity: activeState ? "success" : "warning",
      });

      return state.brandKitchens.map((bk) => ({ ...bk }));
    }),
  );
}

export async function updateMenuCatalogItem(
  item: Partial<MenuItem> & { id: string },
  actor: string,
): Promise<MenuItem[]> {
  if (isPostgresConfigured()) {
    return pgStore.updateMenuCatalogItemPg(item, actor);
  }
  return withMemoryLock(() =>
    runMemoryTransaction((state) => {
      if (!item || typeof item.id !== "string" || !item.id.trim()) {
        throw new Error("Menu item id is required.");
      }
      const cleanId = item.id.trim();
      const idx = state.menuCatalog.findIndex((m) => m.id === cleanId);
      if (idx !== -1) {
        const existing = state.menuCatalog[idx];
        const nextPrice =
          typeof item.price === "number" &&
          Number.isFinite(item.price) &&
          item.price > 0
            ? round2(item.price)
            : existing.price;
        const nextPrep =
          typeof item.prepTimeMins === "number" &&
          Number.isFinite(item.prepTimeMins) &&
          item.prepTimeMins >= 1
            ? Math.round(item.prepTimeMins)
            : existing.prepTimeMins;

        state.menuCatalog[idx] = {
          ...existing,
          name:
            typeof item.name === "string" && item.name.trim()
              ? item.name.trim()
              : existing.name,
          price: nextPrice,
          station:
            typeof item.station === "string" && item.station.trim()
              ? (item.station as MenuItem["station"])
              : existing.station,
          active:
            typeof item.active === "boolean" ? item.active : existing.active,
          prepTimeMins: nextPrep,
          recipe: Array.isArray(item.recipe)
            ? item.recipe
                .filter(
                  (r) =>
                    r &&
                    typeof r.inventoryItemId === "string" &&
                    typeof r.quantityRequired === "number" &&
                    Number.isFinite(r.quantityRequired) &&
                    r.quantityRequired > 0,
                )
                .map((r) => ({
                  inventoryItemId: r.inventoryItemId,
                  quantityRequired: r.quantityRequired,
                }))
            : existing.recipe,
        };
      } else if (item.brandId && item.name && item.station) {
        const price =
          typeof item.price === "number" &&
          Number.isFinite(item.price) &&
          item.price > 0
            ? round2(item.price)
            : 299;
        state.menuCatalog.push({
          id: cleanId,
          brandId: item.brandId,
          name: item.name.trim(),
          price,
          station: item.station,
          active: typeof item.active === "boolean" ? item.active : true,
          prepTimeMins:
            typeof item.prepTimeMins === "number" && item.prepTimeMins >= 1
              ? Math.round(item.prepTimeMins)
              : 8,
          recipe: Array.isArray(item.recipe) ? item.recipe : [],
        });
      } else {
        throw new Error(
          `Menu item ${cleanId} not found and missing required brandId, name, or station.`,
        );
      }

      pushMemoryActivity(state, {
        type: "MENU_UPDATED",
        category: "SYSTEM",
        title: `Menu Catalog Updated (${cleanId})`,
        details: `Menu item ${item.name || cleanId} updated by ${actor}.`,
        actor,
        brandId: item.brandId,
        severity: "info",
      });

      return state.menuCatalog.map((m) => ({
        ...m,
        recipe: m.recipe.map((r) => ({ ...r })),
      }));
    }),
  );
}

export async function toggleKitchenActive(
  kitchenId: string,
  actor: string,
): Promise<KitchenConfig[]> {
  if (isPostgresConfigured()) {
    return pgStore.toggleKitchenActivePg(kitchenId, actor);
  }
  return withMemoryLock(() =>
    runMemoryTransaction((state) => {
      const kitchen = state.kitchens.find((k) => k.id === kitchenId);
      if (!kitchen) {
        throw new Error(`Kitchen not found: ${kitchenId}`);
      }
      kitchen.active = !kitchen.active;

      pushMemoryActivity(state, {
        type: "KITCHEN_STATUS_CHANGED",
        category: "SYSTEM",
        title: `${kitchen.name} (${kitchen.id}) ${kitchen.active ? "ONLINE" : "MAINTENANCE"}`,
        details: `Physical kitchen facility status toggled by ${actor}.`,
        actor,
        kitchenId,
        severity: kitchen.active ? "success" : "warning",
      });

      return state.kitchens.map((k) => ({ ...k }));
    }),
  );
}

export async function upsertOrganization(
  org: Partial<Organization> & { id: string; name: string; slug: string },
): Promise<Organization> {
  if (isPostgresConfigured()) {
    return pgStore.upsertOrganizationPg(org);
  }
  return withMemoryLock(() =>
    runMemoryTransaction((state) => {
      const cleanId = org.id.trim();
      const idx = state.organizations.findIndex((o) => o.id === cleanId);
      const record: Organization = {
        id: cleanId,
        name: org.name.trim(),
        slug: org.slug.trim().toLowerCase(),
        gstin: org.gstin,
        fssaiLicense: org.fssaiLicense,
        active: typeof org.active === "boolean" ? org.active : true,
        createdAt: org.createdAt ?? new Date().toISOString(),
      };
      if (idx !== -1) {
        state.organizations[idx] = { ...state.organizations[idx], ...record };
      } else {
        state.organizations.push(record);
      }
      return { ...record };
    }),
  );
}

export async function upsertKitchen(
  kitchen: KitchenConfig,
): Promise<KitchenConfig> {
  if (isPostgresConfigured()) {
    return pgStore.upsertKitchenPg(kitchen);
  }
  return withMemoryLock(() =>
    runMemoryTransaction((state) => {
      const cleanId = kitchen.id.trim();
      const orgId = kitchen.organizationId?.trim() || DEFAULT_ORGANIZATION_ID;
      const record: KitchenConfig = {
        ...kitchen,
        id: cleanId,
        organizationId: orgId,
      };
      const idx = state.kitchens.findIndex((k) => k.id === cleanId);
      if (idx !== -1) {
        state.kitchens[idx] = record;
      } else {
        state.kitchens.push(record);
      }
      for (const ing of INVENTORY_DB) {
        const exists = state.inventory.some(
          (row) => row.kitchenId === cleanId && row.id === ing.id,
        );
        if (!exists) {
          state.inventory.push({
            ...ing,
            id: ing.id,
            ingredientId: ing.id,
            kitchenId: cleanId,
          });
        }
      }
      return { ...record };
    }),
  );
}

export async function findOrLinkEmployeeByAuthIdentity(identity: {
  authUserId?: string | null;
  email?: string | null;
  phone?: string | null;
}): Promise<Employee | null> {
  if (isPostgresConfigured()) {
    return pgStore.findOrLinkEmployeeByAuthIdentityPg(identity);
  }
  return withMemoryLock(() => {
    const state = getGlobalState();
    const cleanAuthId = identity.authUserId?.trim() || null;
    const cleanEmail = identity.email?.trim().toLowerCase() || null;
    const cleanPhone = identity.phone?.replace(/[\s-]/g, "").trim() || null;

    const match =
      (cleanAuthId
        ? state.employees.find((e) => e.authUserId === cleanAuthId)
        : undefined) ??
      (cleanEmail
        ? state.employees.find(
            (e) => e.email?.trim().toLowerCase() === cleanEmail,
          )
        : undefined) ??
      (cleanPhone
        ? state.employees.find(
            (e) => e.phone?.replace(/[\s-]/g, "").trim() === cleanPhone,
          )
        : undefined);

    if (!match) return null;

    if (cleanAuthId && !match.authUserId) {
      match.authUserId = cleanAuthId;
    }

    return {
      ...match,
      organizationId: match.organizationId ?? DEFAULT_ORGANIZATION_ID,
    };
  });
}

export async function upsertCanonicalEmployee(
  employee: Partial<Employee> & { employeeCode: string },
  actor: string,
): Promise<Employee[]> {
  if (isPostgresConfigured()) {
    return pgStore.upsertCanonicalEmployeePg(employee, actor);
  }
  return withMemoryLock(() =>
    runMemoryTransaction((state) => {
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

      const idx = state.employees.findIndex(
        (e) =>
          (employee.id && e.id === employee.id) ||
          e.employeeCode.toLowerCase() === cleanCode.toLowerCase(),
      );

      const normalizedEmail =
        typeof employee.email === "string"
          ? employee.email.trim().toLowerCase() || undefined
          : undefined;
      const normalizedPhone =
        typeof employee.phone === "string"
          ? employee.phone.trim() || undefined
          : undefined;
      const normalizedAuthUserId =
        typeof employee.authUserId === "string"
          ? employee.authUserId.trim() || undefined
          : undefined;

      if (idx !== -1) {
        const existing = state.employees[idx];
        const nextRole = employee.role ?? existing.role;
        const targetOrgId =
          typeof employee.organizationId === "string" &&
          employee.organizationId.trim()
            ? employee.organizationId.trim()
            : existing.organizationId ?? DEFAULT_ORGANIZATION_ID;
        state.employees[idx] = {
          id: existing.id,
          organizationId: targetOrgId,
          employeeCode: cleanCode,
          name:
            typeof employee.name === "string" && employee.name.trim()
              ? employee.name.trim()
              : existing.name,
          role: nextRole,
          kitchenId:
            nextRole === "OWNER"
              ? undefined
              : typeof employee.kitchenId === "string" &&
                  employee.kitchenId.trim()
                ? employee.kitchenId.trim()
                : existing.kitchenId,
          email:
            employee.email !== undefined ? normalizedEmail : existing.email,
          phone:
            employee.phone !== undefined ? normalizedPhone : existing.phone,
          authUserId:
            employee.authUserId !== undefined
              ? normalizedAuthUserId
              : existing.authUserId,
          active:
            typeof employee.active === "boolean"
              ? employee.active
              : existing.active,
        };
      } else {
        const nextRole = employee.role ?? "LINE_COOK";
        const targetOrgId =
          typeof employee.organizationId === "string" &&
          employee.organizationId.trim()
            ? employee.organizationId.trim()
            : DEFAULT_ORGANIZATION_ID;
        state.employees.push({
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
              ? undefined
              : typeof employee.kitchenId === "string" &&
                  employee.kitchenId.trim()
                ? employee.kitchenId.trim()
                : "K1",
          email: normalizedEmail,
          phone: normalizedPhone,
          authUserId: normalizedAuthUserId,
          active:
            typeof employee.active === "boolean" ? employee.active : true,
        });
      }

      pushMemoryActivity(state, {
        organizationId:
          typeof employee.organizationId === "string" &&
          employee.organizationId.trim()
            ? employee.organizationId.trim()
            : DEFAULT_ORGANIZATION_ID,
        type: "STAFF_UPDATED",
        category: "AUTH",
        title: `Staff Record Updated (${cleanCode})`,
        details: `Employee ${employee.name || cleanCode} updated by ${actor}.`,
        actor,
        kitchenId: employee.kitchenId,
        severity: "info",
      });

      return state.employees.map((e) => ({ ...e }));
    }),
  );
}

export async function upsertVirtualFile(
  file: Partial<VirtualFileAsset> & { name: string },
  actor: string,
): Promise<VirtualFileAsset[]> {
  if (isPostgresConfigured()) {
    return pgStore.upsertVirtualFilePg(file, actor);
  }
  return withMemoryLock(() =>
    runMemoryTransaction((state) => {
      if (!file || typeof file.name !== "string" || !file.name.trim()) {
        throw new Error(
          "File name is required and must be a non-empty string.",
        );
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

      const now = new Date().toISOString();
      const idx = file.id
        ? state.files.findIndex((f) => f.id === file.id)
        : -1;
      if (idx !== -1) {
        const existing = state.files[idx];
        state.files[idx] = {
          ...existing,
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
          updatedAt: now,
        };
      } else {
        const content =
          typeof file.content === "string" && file.content.trim()
            ? file.content
            : `# ${cleanName}\nUploaded to DarKIT OS Virtual File Explorer by ${actor}.`;
        const computedSize =
          typeof file.size === "string" && file.size.trim()
            ? file.size.trim()
            : `${Math.max(0.2, content.length / 1024).toFixed(1)} KB`;
        state.files.unshift({
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
          brandId: file.brandId,
          uploadedBy: actor,
          updatedAt: now,
          status: safeStatus,
          content,
        });
      }

      pushMemoryActivity(state, {
        type: "FILE_ASSET_SAVED",
        category: "SYSTEM",
        title: `Virtual Explorer Asset Saved: ${cleanName}`,
        details: `Category: ${safeCategory} • Kitchen: ${file.kitchenId || "GLOBAL"}.`,
        actor,
        kitchenId: file.kitchenId,
        brandId: file.brandId,
        severity: "info",
      });

      return state.files.map((f) => ({ ...f }));
    }),
  );
}

export async function deleteVirtualFile(
  fileId: string,
  actor: string,
): Promise<VirtualFileAsset[]> {
  if (isPostgresConfigured()) {
    return pgStore.deleteVirtualFilePg(fileId, actor);
  }
  return withMemoryLock(() =>
    runMemoryTransaction((state) => {
      if (!fileId || typeof fileId !== "string") {
        throw new Error("fileId is required.");
      }
      const target = state.files.find((f) => f.id === fileId);
      state.files = state.files.filter((f) => f.id !== fileId);
      if (target) {
        pushMemoryActivity(state, {
          type: "FILE_ASSET_DELETED",
          category: "SYSTEM",
          title: `Virtual Explorer Asset Deleted: ${target.name}`,
          details: `Removed from operational storage by ${actor}.`,
          actor,
          severity: "warning",
        });
      }
      return state.files.map((f) => ({ ...f }));
    }),
  );
}

export async function updateSystemSettings(
  partial: Partial<SystemSettings>,
  actor: string,
): Promise<SystemSettings> {
  if (isPostgresConfigured()) {
    return pgStore.updateSystemSettingsPg(partial, actor);
  }
  return withMemoryLock(() =>
    runMemoryTransaction((state) => {
      const safeLowStockMultiplier =
        typeof partial.lowStockMultiplier === "number" &&
        Number.isFinite(partial.lowStockMultiplier) &&
        partial.lowStockMultiplier >= 0.5 &&
        partial.lowStockMultiplier <= 3
          ? partial.lowStockMultiplier
          : state.settings.lowStockMultiplier;

      const safePrepSla =
        typeof partial.prepSlaMinutes === "number" &&
        Number.isFinite(partial.prepSlaMinutes) &&
        partial.prepSlaMinutes >= 3 &&
        partial.prepSlaMinutes <= 60
          ? partial.prepSlaMinutes
          : state.settings.prepSlaMinutes;

      const safeDispatchSla =
        typeof partial.dispatchSlaMinutes === "number" &&
        Number.isFinite(partial.dispatchSlaMinutes) &&
        partial.dispatchSlaMinutes >= 3 &&
        partial.dispatchSlaMinutes <= 60
          ? partial.dispatchSlaMinutes
          : state.settings.dispatchSlaMinutes;

      const safeRateLimit =
        typeof partial.rateLimitRps === "number" &&
        Number.isFinite(partial.rateLimitRps) &&
        partial.rateLimitRps >= 10 &&
        partial.rateLimitRps <= 5000
          ? partial.rateLimitRps
          : state.settings.rateLimitRps;

      state.settings = {
        currency:
          partial.currency && ALLOWED_CURRENCIES.includes(partial.currency)
            ? partial.currency
            : state.settings.currency,
        timezone:
          typeof partial.timezone === "string" && partial.timezone.trim()
            ? partial.timezone.trim()
            : state.settings.timezone,
        theme:
          partial.theme && ALLOWED_THEMES.includes(partial.theme)
            ? partial.theme
            : state.settings.theme,
        fluidAnimations:
          typeof partial.fluidAnimations === "boolean"
            ? partial.fluidAnimations
            : state.settings.fluidAnimations,
        syncMode:
          partial.syncMode && ALLOWED_SYNC_MODES.includes(partial.syncMode)
            ? partial.syncMode
            : state.settings.syncMode,
        autoAcceptOrders:
          typeof partial.autoAcceptOrders === "boolean"
            ? partial.autoAcceptOrders
            : state.settings.autoAcceptOrders,
        lowStockMultiplier: safeLowStockMultiplier,
        prepSlaMinutes: safePrepSla,
        dispatchSlaMinutes: safeDispatchSla,
        rlsEnforcement:
          partial.rlsEnforcement &&
          ALLOWED_RLS_MODES.includes(partial.rlsEnforcement)
            ? partial.rlsEnforcement
            : state.settings.rlsEnforcement,
        circuitBreakerState:
          partial.circuitBreakerState &&
          ALLOWED_CIRCUIT_STATES.includes(partial.circuitBreakerState)
            ? partial.circuitBreakerState
            : state.settings.circuitBreakerState,
        rateLimitRps: safeRateLimit,
      };

      pushMemoryActivity(state, {
        type: "SETTINGS_UPDATED",
        category: "SYSTEM",
        title: "System Preferences Updated",
        details: `Currency: ${state.settings.currency} • Theme: ${state.settings.theme} • Sync: ${state.settings.syncMode} • Prep SLA: ${state.settings.prepSlaMinutes}m.`,
        actor,
        severity: "info",
      });

      return { ...state.settings };
    }),
  );
}

export async function updateLeakageVectorStatus(
  id: string,
  status: RevenueLeakageVector["status"],
  actor: string,
): Promise<RevenueLeakageVector[]> {
  if (isPostgresConfigured()) {
    return pgStore.updateLeakageVectorStatusPg(id, status, actor);
  }
  return withMemoryLock(() =>
    runMemoryTransaction((state) => {
      if (!ALLOWED_LEAKAGE_STATUSES.has(status)) {
        throw new Error(`Invalid leakage status: ${String(status)}`);
      }
      const vector = state.leakageVectors.find((v) => v.id === id);
      if (!vector) {
        throw new Error(`Leakage vector not found: ${id}`);
      }
      vector.status = status;
      if (status === "RECOVERED") {
        vector.actualCollected = vector.potentialRevenue;
        vector.leakedAmount = 0;
      }
      pushMemoryActivity(state, {
        type: "LEAKAGE_AUDIT",
        category: "CLOUD7",
        title: `Revenue Leakage Audit (${vector.vector}): ${status}`,
        details: `Cloud-kitchen revenue recovery status updated by ${actor}.`,
        actor,
        severity: status === "RECOVERED" ? "success" : "info",
      });
      return state.leakageVectors.map((l) => ({ ...l }));
    }),
  );
}

// -----------------------------------------------------------------------------
// Payment Transactions & Razorpay Direct Web Capture / Refund
// -----------------------------------------------------------------------------

export async function createPaymentIntentRecord(input: {
  organizationId: string;
  kitchenId: string;
  orderId: string;
  provider: PaymentProvider;
  providerOrderId: string;
  amount: number;
  currency?: string;
  method?: string;
  rawMeta?: Record<string, unknown>;
  actor?: string;
}): Promise<{ transaction: PaymentTransaction; order: Order }> {
  if (isPostgresConfigured()) {
    return pgStore.createPaymentIntentRecordPg(input);
  }
  return withMemoryLock(() =>
    runMemoryTransaction((state) => {
      const order = state.orders.find((o) => o.id === input.orderId);
      if (!order) {
        throw new Error(`Order not found: ${input.orderId}`);
      }
      const now = new Date().toISOString();
      const txRow: PaymentTransaction = {
        id: makeId("PAY"),
        organizationId: input.organizationId,
        kitchenId: input.kitchenId,
        orderId: input.orderId,
        provider: input.provider,
        providerOrderId: input.providerOrderId,
        amount: round2(input.amount),
        refundedAmount: 0,
        currency: input.currency ?? "INR",
        status: "CREATED",
        method: input.method,
        rawMeta: input.rawMeta ? { ...input.rawMeta } : undefined,
        createdAt: now,
        updatedAt: now,
      };
      state.paymentTransactions.unshift(txRow);
      if (order.paymentStatus === "UNPAID" || !order.paymentStatus) {
        order.paymentStatus = "PENDING";
        order.updatedAt = now;
      }
      return {
        transaction: { ...txRow },
        order: cloneOrder(order),
      };
    }),
  );
}

export async function recordRazorpayPaymentCapture(input: {
  webhookEventId?: string;
  providerOrderId?: string;
  providerPaymentId: string;
  orderId?: string;
  amount?: number;
  method?: string;
  rawMeta?: Record<string, unknown>;
  actor?: string;
}): Promise<{
  transaction: PaymentTransaction;
  order: Order;
  idempotentReplay: boolean;
}> {
  const result = isPostgresConfigured()
    ? await pgStore.recordRazorpayPaymentCapturePg(input)
    : await withMemoryLock(() =>
        runMemoryTransaction((state) => {
          const now = new Date().toISOString();
          const actor = input.actor || "RAZORPAY_WEBHOOK";

          if (input.webhookEventId) {
            const byEvent = state.paymentTransactions.find(
              (t) => t.webhookEventId === input.webhookEventId,
            );
            if (byEvent) {
              const ord = state.orders.find((o) => o.id === byEvent.orderId);
              if (!ord) {
                throw new Error(`Order not found: ${byEvent.orderId}`);
              }
              return {
                transaction: { ...byEvent },
                order: cloneOrder(ord),
                idempotentReplay: true,
              };
            }
          }

          const byPayment = state.paymentTransactions.find(
            (t) => t.providerPaymentId === input.providerPaymentId,
          );
          if (
            byPayment &&
            (byPayment.status === "CAPTURED" || byPayment.status === "REFUNDED")
          ) {
            const ord = state.orders.find((o) => o.id === byPayment.orderId);
            if (!ord) {
              throw new Error(`Order not found: ${byPayment.orderId}`);
            }
            return {
              transaction: { ...byPayment },
              order: cloneOrder(ord),
              idempotentReplay: true,
            };
          }

          let matchedTx = byPayment;
          if (!matchedTx && input.providerOrderId) {
            matchedTx = state.paymentTransactions.find(
              (t) => t.providerOrderId === input.providerOrderId,
            );
          }

          const targetOrderId = matchedTx?.orderId || input.orderId;
          if (!targetOrderId) {
            throw new Error(
              `Unable to resolve order for Razorpay payment ${input.providerPaymentId}.`,
            );
          }
          const order = state.orders.find((o) => o.id === targetOrderId);
          if (!order) {
            throw new Error(
              `Order not found for payment capture: ${targetOrderId}`,
            );
          }

          let savedTx: PaymentTransaction;
          if (matchedTx) {
            matchedTx.providerPaymentId = input.providerPaymentId;
            matchedTx.webhookEventId =
              input.webhookEventId ?? matchedTx.webhookEventId;
            matchedTx.status = "CAPTURED";
            matchedTx.method = input.method ?? matchedTx.method ?? "upi";
            if (typeof input.amount === "number" && input.amount > 0) {
              matchedTx.amount = round2(input.amount);
            }
            matchedTx.rawMeta = {
              ...(matchedTx.rawMeta ?? {}),
              ...(input.rawMeta ?? {}),
            };
            matchedTx.updatedAt = now;
            savedTx = matchedTx;
          } else {
            const resolvedAmount =
              typeof input.amount === "number" && input.amount > 0
                ? round2(input.amount)
                : round2(order.totalAmount ?? 0);
            savedTx = {
              id: makeId("PAY"),
              organizationId: order.organizationId ?? DEFAULT_ORGANIZATION_ID,
              kitchenId: order.kitchenId,
              orderId: order.id,
              provider: "RAZORPAY",
              providerOrderId: input.providerOrderId,
              providerPaymentId: input.providerPaymentId,
              webhookEventId: input.webhookEventId,
              amount: resolvedAmount,
              refundedAmount: 0,
              currency: "INR",
              status: "CAPTURED",
              method: input.method ?? "upi",
              rawMeta: input.rawMeta ? { ...input.rawMeta } : undefined,
              createdAt: now,
              updatedAt: now,
            };
            state.paymentTransactions.unshift(savedTx);
          }

          order.paymentStatus = "CAPTURED";
          order.updatedAt = now;
          order.events.push({
            id: makeId(`${order.id}-PAY`),
            type: "PAYMENT_CAPTURED",
            timestamp: now,
            actor,
            details: `Razorpay payment ${input.providerPaymentId} captured (${formatCurrency(savedTx.amount, "INR")} via ${(savedTx.method ?? "upi").toUpperCase()}).`,
          });

          pushMemoryActivity(state, {
            organizationId: order.organizationId ?? DEFAULT_ORGANIZATION_ID,
            type: "PAYMENT_CAPTURED",
            category: "PAYMENT",
            title: `Payment Captured (${order.id})`,
            details: `${formatCurrency(savedTx.amount, "INR")} captured via ${(savedTx.method ?? "upi").toUpperCase()} (${input.providerPaymentId}).`,
            actor,
            orderId: order.id,
            kitchenId: order.kitchenId,
            brandId: order.brandId,
            timestamp: now,
            severity: "success",
          });

          return {
            transaction: { ...savedTx },
            order: cloneOrder(order),
            idempotentReplay: false,
          };
        }),
      );

  if (!result.idempotentReplay) {
    const orgId =
      result.order.organizationId ??
      (await resolveKitchenOrganizationId(result.order.kitchenId));
    await publishKitchenRealtimeEvent({
      type: "PAYMENT_CAPTURED",
      organizationId: orgId,
      kitchenId: result.order.kitchenId,
      orderId: result.order.id,
      status: result.order.paymentStatus,
      brandId: result.order.brandId,
      actor: input.actor || "RAZORPAY_WEBHOOK",
      details: `Payment ${result.transaction.providerPaymentId} captured`,
    });
  }

  return result;
}

export async function recordPaymentRefund(input: {
  transactionId: string;
  orderId: string;
  providerRefundId: string;
  refundedAmount: number;
  actor: string;
  reason: string;
  rawMeta?: Record<string, unknown>;
}): Promise<{ transaction: PaymentTransaction; order: Order }> {
  if (isPostgresConfigured()) {
    return pgStore.recordPaymentRefundPg(input);
  }
  return withMemoryLock(() =>
    runMemoryTransaction((state) => {
      const now = new Date().toISOString();
      const txRow = state.paymentTransactions.find(
        (t) => t.id === input.transactionId,
      );
      if (!txRow) {
        throw new Error(`Payment transaction not found: ${input.transactionId}`);
      }
      const order = state.orders.find((o) => o.id === input.orderId);
      if (!order) {
        throw new Error(`Order not found: ${input.orderId}`);
      }

      txRow.providerRefundId = input.providerRefundId;
      txRow.refundedAmount = round2(input.refundedAmount);
      txRow.status = "REFUNDED";
      txRow.rawMeta = {
        ...(txRow.rawMeta ?? {}),
        ...(input.rawMeta ?? {}),
        refundReason: input.reason,
      };
      txRow.updatedAt = now;

      order.paymentStatus = "REFUNDED";
      order.updatedAt = now;
      order.events.push({
        id: makeId(`${order.id}-RFND`),
        type: "PAYMENT_REFUNDED",
        timestamp: now,
        actor: input.actor,
        details: `Automatic Razorpay refund ${input.providerRefundId} processed (${formatCurrency(input.refundedAmount, "INR")}). Reason: ${input.reason}.`,
      });

      pushMemoryActivity(state, {
        organizationId: order.organizationId ?? DEFAULT_ORGANIZATION_ID,
        type: "PAYMENT_REFUNDED",
        category: "PAYMENT",
        title: `Payment Refunded (${order.id})`,
        details: `Refunded ${formatCurrency(input.refundedAmount, "INR")} (${input.providerRefundId}) after pre-prep cancellation.`,
        actor: input.actor,
        orderId: order.id,
        kitchenId: order.kitchenId,
        brandId: order.brandId,
        timestamp: now,
        severity: "warning",
      });

      return {
        transaction: { ...txRow },
        order: cloneOrder(order),
      };
    }),
  );
}

