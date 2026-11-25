import { beforeEach, describe, expect, it } from "vitest";
import {
  MID_PREP_LABOR_ALLOWANCE_INR,
  clearOrdersStore,
  findOrder,
  getCancellations,
  getEmployees,
  getInventory,
  getOutboxEvents,
  getSettings,
  getWebhookEvents,
  injectCanonicalOrder,
  mutateCanonicalInventory,
  resetStore,
  transitionCanonicalOrder,
  updateSystemSettings,
  upsertCanonicalEmployee,
  upsertVirtualFile,
} from "@/lib/store";

describe("lib/store canonical domain invariants", () => {
  beforeEach(() => {
    resetStore();
  });

  it("initializes with INR currency and HTTP_POLLING sync mode", () => {
    const settings = getSettings();
    expect(settings.currency).toBe("INR");
    expect(settings.syncMode).toBe("HTTP_POLLING");
  });

  it("enforces canonical BrandKitchen authorization on order injection", () => {
    // WingProtocol is NOT authorized in K2 (Noida)
    expect(() =>
      injectCanonicalOrder({
        brandId: "WingProtocol",
        kitchenId: "K2",
        channel: "Zomato",
        items: [{ menuItemId: "MENU-WP-01", quantity: 1 }],
        actor: "OWNER-01 (Arvind Singhania)",
      }),
    ).toThrow(/BrandKitchen violation/);
  });

  it("deduplicates repeated webhook idempotency keys cleanly", () => {
    const first = injectCanonicalOrder({
      idempotencyKey: "idem-test-001",
      brandId: "BurgerForge",
      kitchenId: "K1",
      channel: "Swiggy",
      items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
      actor: "OWNER-01",
    });

    const replay = injectCanonicalOrder({
      idempotencyKey: "idem-test-001",
      brandId: "BurgerForge",
      kitchenId: "K1",
      channel: "Swiggy",
      items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
      actor: "OWNER-01",
    });

    expect(first.idempotentReplay).toBe(false);
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.order.id).toBe(first.order.id);
    const webhook = getWebhookEvents().find(
      (w) => w.idempotencyKey === "idem-test-001",
    );
    expect(webhook?.hitCount).toBe(2);
  });

  it("rejects duplicate explicit order IDs", () => {
    expect(() =>
      injectCanonicalOrder({
        id: "ORD-901",
        brandId: "BurgerForge",
        kitchenId: "K1",
        channel: "Swiggy",
        items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
        actor: "OWNER-01",
      }),
    ).toThrow(/already exists/);
  });

  it("depletes complete recipe BOM including MENU-BF-02 Truffle Fries", () => {
    const friesBefore = getInventory().find((i) => i.id === "INV-011")!;
    const pkgBefore = getInventory().find((i) => i.id === "INV-010")!;

    const created = injectCanonicalOrder({
      brandId: "BurgerForge",
      kitchenId: "K1",
      channel: "Swiggy",
      items: [{ menuItemId: "MENU-BF-02", quantity: 2 }],
      actor: "OWNER-01",
    });

    transitionCanonicalOrder({
      orderId: created.order.id,
      nextStatus: "PREPARING",
      actor: "2001 (Rajesh Kumar)",
    });

    const friesAfter = getInventory().find((i) => i.id === "INV-011")!;
    const pkgAfter = getInventory().find((i) => i.id === "INV-010")!;
    expect(friesAfter.currentStock).toBe(friesBefore.currentStock - 2);
    expect(pkgAfter.currentStock).toBe(pkgBefore.currentStock - 2);
  });

  it("persists INVENTORY_UNAVAILABLE audit event without deducting stock when insufficient stock blocks PREPARING", () => {
    // Reduce Brioche Buns (INV-002) to 1 unit
    mutateCanonicalInventory({
      itemId: "INV-002",
      action: "SET_STOCK",
      currentStock: 1,
      actor: "OWNER-01",
    });
    const beefBefore = getInventory().find((i) => i.id === "INV-001")!
      .currentStock;

    // Create order requiring 3 Double Smash Burgers (6 beef patties, 3 brioche buns)
    const created = injectCanonicalOrder({
      brandId: "BurgerForge",
      kitchenId: "K1",
      channel: "Swiggy",
      items: [{ menuItemId: "MENU-BF-01", quantity: 3 }],
      actor: "OWNER-01",
    });

    expect(() =>
      transitionCanonicalOrder({
        orderId: created.order.id,
        nextStatus: "PREPARING",
        actor: "2001 (Rajesh Kumar)",
      }),
    ).toThrow(/Insufficient inventory/);

    // Stock MUST remain untouched (atomic)
    const beefAfter = getInventory().find((i) => i.id === "INV-001")!
      .currentStock;
    const bunsAfter = getInventory().find((i) => i.id === "INV-002")!
      .currentStock;
    expect(beefAfter).toBe(beefBefore);
    expect(bunsAfter).toBe(1);

    // Audit event & decision MUST be persisted (not rolled back!)
    const persisted = findOrder(created.order.id)!;
    expect(persisted.status).toBe("PENDING");
    expect(persisted.inventoryDecision).toBe("INSUFFICIENT_STOCK");
    expect(persisted.inventoryUnavailable).toContain("Brioche Buns");
    expect(
      persisted.events.some((e) => e.type === "INVENTORY_UNAVAILABLE"),
    ).toBe(true);
  });

  it("does not fabricate stock restoration or loss when cancelling PENDING order before stock consumption", () => {
    const beefBefore = getInventory().find((i) => i.id === "INV-001")!
      .currentStock;

    const created = injectCanonicalOrder({
      brandId: "BurgerForge",
      kitchenId: "K1",
      channel: "Zomato",
      items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
      actor: "OWNER-01",
    });

    const cancelled = transitionCanonicalOrder({
      orderId: created.order.id,
      nextStatus: "CANCELLED",
      actor: "0001 (Priya Sharma)",
      restoreInventoryOnPrePrepCancel: true,
    });

    expect(cancelled.cancellationRecord?.stage).toBe("BEFORE_PREP");
    expect(cancelled.cancellationRecord?.financialLoss).toBe(0);
    expect(cancelled.cancellationRecord?.restoredIngredients).toEqual([]);
    expect(
      getInventory().find((i) => i.id === "INV-001")!.currentStock,
    ).toBe(beefBefore);
  });

  it("logs INR Food & Labor Loss (COGS + ₹75) on mid-prep cancellation without returning cooked stock", () => {
    const created = injectCanonicalOrder({
      brandId: "BurgerForge",
      kitchenId: "K1",
      channel: "Zomato",
      items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
      actor: "OWNER-01",
    });

    transitionCanonicalOrder({
      orderId: created.order.id,
      nextStatus: "PREPARING",
      actor: "2001 (Rajesh Kumar)",
    });

    const beefAfterPrep = getInventory().find((i) => i.id === "INV-001")!
      .currentStock;

    const cancelled = transitionCanonicalOrder({
      orderId: created.order.id,
      nextStatus: "CANCELLED",
      actor: "0001 (Priya Sharma)",
      cancellationSource: "CUSTOMER",
    });

    // Double Smash Burger recipe COGS = 2 * ₹85 + 1 * ₹28 = ₹198
    const expectedLoss = 198 + MID_PREP_LABOR_ALLOWANCE_INR;
    expect(cancelled.cancellationRecord?.stage).toBe("DURING_OR_AFTER_PREP");
    expect(cancelled.cancellationRecord?.resolution).toBe(
      "FOOD_AND_LABOR_LOSS",
    );
    expect(cancelled.cancellationRecord?.financialLoss).toBe(expectedLoss);
    expect(cancelled.cancellationRecord?.restoredIngredients).toEqual([]);
    // Stock must NOT increase back
    expect(
      getInventory().find((i) => i.id === "INV-001")!.currentStock,
    ).toBe(beefAfterPrep);
  });

  it("creates post-pickup aggregator accounting claim with courier evidence", () => {
    // ORD-906 starts in PICKED_UP status (total ₹798)
    const cancelled = transitionCanonicalOrder({
      orderId: "ORD-906",
      nextStatus: "CANCELLED",
      actor: "OWNER-01",
      cancellationSource: "AGGREGATOR",
    });

    expect(cancelled.cancellationRecord?.stage).toBe("AFTER_PICKUP");
    expect(cancelled.cancellationRecord?.resolution).toBe(
      "AGGREGATOR_ACCOUNTING_CLAIM",
    );
    expect(cancelled.cancellationRecord?.claimAmount).toBe(798);
    expect(cancelled.cancellationRecord?.dispatchEvidence?.driverName).toBe(
      "Suresh Solanki",
    );
  });

  it("does not override RESTOCK action when stray currentStock is passed", () => {
    const bunsBefore = getInventory().find((i) => i.id === "INV-002")!
      .currentStock;
    const result = mutateCanonicalInventory({
      itemId: "INV-002",
      action: "RESTOCK",
      quantity: 20,
      currentStock: 0, // stray field must NOT wipe stock during RESTOCK
      actor: "OWNER-01",
    });

    expect(result.item.currentStock).toBe(bunsBefore + 20);
    expect(result.movement.type).toBe("RESTOCK");
  });

  it("deep-clones cancellations and clears webhooks/outbox on clearOrdersStore", () => {
    const records = getCancellations();
    expect(records.length).toBeGreaterThan(0);
    records[0].lostIngredients.push({
      inventoryItemId: "FAKE",
      name: "Mutated",
      quantity: 99,
    });
    expect(
      getCancellations()[0].lostIngredients.some(
        (i) => i.inventoryItemId === "FAKE",
      ),
    ).toBe(false);

    clearOrdersStore();
    expect(getWebhookEvents()).toEqual([]);
    expect(getOutboxEvents()).toEqual([]);
    expect(getCancellations()).toEqual([]);
  });

  it("strips plaintext pins on employee upsert and rejects malformed files/settings", () => {
    upsertCanonicalEmployee(
      {
        employeeCode: "COOK-99",
        name: "Test Chef",
        role: "LINE_COOK",
        kitchenId: "K1",
        pin: "9999",
      },
      "OWNER-01",
    );
    const saved = getEmployees().find((e) => e.employeeCode === "COOK-99");
    expect(saved).toBeDefined();
    expect(saved?.pin).toBeUndefined();

    expect(() =>
      upsertVirtualFile({ name: "   " }, "OWNER-01"),
    ).toThrow(/File name is required/);

    const sanitized = updateSystemSettings(
      { prepSlaMinutes: -50, lowStockMultiplier: Number.NaN },
      "OWNER-01",
    );
    expect(sanitized.prepSlaMinutes).toBe(12);
    expect(sanitized.lowStockMultiplier).toBe(1);
  });
});
