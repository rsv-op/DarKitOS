import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb } from "@/lib/db-client";
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
  beforeEach(async () => {
    await resetStore();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("initializes with INR currency, HTTP_POLLING sync mode, and 44 per-kitchen stock rows (4 hubs × 11 SKUs)", async () => {
    const settings = await getSettings();
    expect(settings.currency).toBe("INR");
    expect(settings.syncMode).toBe("HTTP_POLLING");

    const allStock = await getInventory();
    expect(allStock).toHaveLength(44);
    expect(await getInventory("K1")).toHaveLength(11);
    expect(await getInventory("K2")).toHaveLength(11);
    expect(await getInventory("K3")).toHaveLength(11);
    expect(await getInventory("K4")).toHaveLength(11);
  });

  it("enforces canonical BrandKitchen authorization on order injection", async () => {
    // WingProtocol is NOT authorized in K2 (Noida)
    await expect(
      injectCanonicalOrder({
        brandId: "WingProtocol",
        kitchenId: "K2",
        channel: "Zomato",
        items: [{ menuItemId: "MENU-WP-01", quantity: 1 }],
        actor: "OWNER-01 (Patric Revuelto)",
      }),
    ).rejects.toThrow(/BrandKitchen violation/);
  });

  it("deduplicates repeated webhook idempotency keys cleanly", async () => {
    const first = await injectCanonicalOrder({
      idempotencyKey: "idem-test-001",
      brandId: "BurgerForge",
      kitchenId: "K1",
      channel: "Swiggy",
      items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
      actor: "OWNER-01",
    });

    const replay = await injectCanonicalOrder({
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
    const webhook = (await getWebhookEvents()).find(
      (w) => w.idempotencyKey === "idem-test-001",
    );
    expect(webhook?.hitCount).toBe(2);
  });

  it("rejects duplicate explicit order IDs", async () => {
    await expect(
      injectCanonicalOrder({
        id: "ORD-901",
        brandId: "BurgerForge",
        kitchenId: "K1",
        channel: "Swiggy",
        items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
        actor: "OWNER-01",
      }),
    ).rejects.toThrow(/already exists/);
  });

  it("depletes complete recipe BOM including MENU-BF-02 Truffle Fries scoped to K1", async () => {
    const k1Before = await getInventory("K1");
    const friesBefore = k1Before.find((i) => i.id === "INV-011")!;
    const pkgBefore = k1Before.find((i) => i.id === "INV-010")!;

    const created = await injectCanonicalOrder({
      brandId: "BurgerForge",
      kitchenId: "K1",
      channel: "Swiggy",
      items: [{ menuItemId: "MENU-BF-02", quantity: 2 }],
      actor: "OWNER-01",
    });

    await transitionCanonicalOrder({
      orderId: created.order.id,
      nextStatus: "PREPARING",
      actor: "2001 (Rajesh Kumar)",
    });

    const k1After = await getInventory("K1");
    const friesAfter = k1After.find((i) => i.id === "INV-011")!;
    const pkgAfter = k1After.find((i) => i.id === "INV-010")!;
    expect(friesAfter.currentStock).toBe(friesBefore.currentStock - 2);
    expect(pkgAfter.currentStock).toBe(pkgBefore.currentStock - 2);
  });

  it("persists INVENTORY_UNAVAILABLE audit event without deducting stock when insufficient stock blocks PREPARING", async () => {
    await mutateCanonicalInventory({
      itemId: "INV-002",
      kitchenId: "K1",
      action: "SET_STOCK",
      currentStock: 1,
      actor: "OWNER-01",
    });
    const beefBefore = (await getInventory("K1")).find(
      (i) => i.id === "INV-001",
    )!.currentStock;

    const created = await injectCanonicalOrder({
      brandId: "BurgerForge",
      kitchenId: "K1",
      channel: "Swiggy",
      items: [{ menuItemId: "MENU-BF-01", quantity: 3 }],
      actor: "OWNER-01",
    });

    await expect(
      transitionCanonicalOrder({
        orderId: created.order.id,
        nextStatus: "PREPARING",
        actor: "2001 (Rajesh Kumar)",
      }),
    ).rejects.toThrow(/Insufficient inventory/);

    const k1After = await getInventory("K1");
    expect(k1After.find((i) => i.id === "INV-001")!.currentStock).toBe(
      beefBefore,
    );
    expect(k1After.find((i) => i.id === "INV-002")!.currentStock).toBe(1);

    const persisted = (await findOrder(created.order.id))!;
    expect(persisted.status).toBe("PENDING");
    expect(persisted.inventoryDecision).toBe("INSUFFICIENT_STOCK");
    expect(persisted.inventoryUnavailable).toContain("Brioche Buns");
    expect(
      persisted.events.some((e) => e.type === "INVENTORY_UNAVAILABLE"),
    ).toBe(true);
  });

  it("does not fabricate stock restoration or loss when cancelling PENDING order before stock consumption", async () => {
    const beefBefore = (await getInventory("K1")).find(
      (i) => i.id === "INV-001",
    )!.currentStock;

    const created = await injectCanonicalOrder({
      brandId: "BurgerForge",
      kitchenId: "K1",
      channel: "Zomato",
      items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
      actor: "OWNER-01",
    });

    const cancelled = await transitionCanonicalOrder({
      orderId: created.order.id,
      nextStatus: "CANCELLED",
      actor: "0001 (Priya Sharma)",
      restoreInventoryOnPrePrepCancel: true,
    });

    expect(cancelled.cancellationRecord?.stage).toBe("BEFORE_PREP");
    expect(cancelled.cancellationRecord?.financialLoss).toBe(0);
    expect(cancelled.cancellationRecord?.restoredIngredients).toEqual([]);
    expect(
      (await getInventory("K1")).find((i) => i.id === "INV-001")!.currentStock,
    ).toBe(beefBefore);
  });

  it("logs INR Food & Labor Loss (COGS + ₹75) on mid-prep cancellation without returning cooked stock", async () => {
    const created = await injectCanonicalOrder({
      brandId: "BurgerForge",
      kitchenId: "K1",
      channel: "Zomato",
      items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
      actor: "OWNER-01",
    });

    await transitionCanonicalOrder({
      orderId: created.order.id,
      nextStatus: "PREPARING",
      actor: "2001 (Rajesh Kumar)",
    });

    const beefAfterPrep = (await getInventory("K1")).find(
      (i) => i.id === "INV-001",
    )!.currentStock;

    const cancelled = await transitionCanonicalOrder({
      orderId: created.order.id,
      nextStatus: "CANCELLED",
      actor: "0001 (Priya Sharma)",
      cancellationSource: "CUSTOMER",
    });

    const expectedLoss = 198 + MID_PREP_LABOR_ALLOWANCE_INR;
    expect(cancelled.cancellationRecord?.stage).toBe("DURING_OR_AFTER_PREP");
    expect(cancelled.cancellationRecord?.resolution).toBe(
      "FOOD_AND_LABOR_LOSS",
    );
    expect(cancelled.cancellationRecord?.financialLoss).toBe(expectedLoss);
    expect(cancelled.cancellationRecord?.restoredIngredients).toEqual([]);
    expect(
      (await getInventory("K1")).find((i) => i.id === "INV-001")!.currentStock,
    ).toBe(beefAfterPrep);
  });

  it("creates post-pickup aggregator accounting claim with courier evidence", async () => {
    const cancelled = await transitionCanonicalOrder({
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

  it("does not override RESTOCK action when stray currentStock is passed", async () => {
    const bunsBefore = (await getInventory("K1")).find(
      (i) => i.id === "INV-002",
    )!.currentStock;
    const result = await mutateCanonicalInventory({
      itemId: "INV-002",
      kitchenId: "K1",
      action: "RESTOCK",
      quantity: 20,
      currentStock: 0,
      actor: "OWNER-01",
    });

    expect(result.item.currentStock).toBe(bunsBefore + 20);
    expect(result.movement.type).toBe("RESTOCK");
  });

  it("deep-clones cancellations and clears webhooks/outbox on clearOrdersStore", async () => {
    const records = await getCancellations();
    expect(records.length).toBeGreaterThan(0);
    records[0].lostIngredients.push({
      inventoryItemId: "FAKE",
      name: "Mutated",
      quantity: 99,
    });
    expect(
      (await getCancellations())[0].lostIngredients.some(
        (i) => i.inventoryItemId === "FAKE",
      ),
    ).toBe(false);

    await clearOrdersStore();
    expect(await getWebhookEvents()).toEqual([]);
    expect(await getOutboxEvents()).toEqual([]);
    expect(await getCancellations()).toEqual([]);
  });

  it("strips plaintext pins on employee upsert and rejects malformed files/settings", async () => {
    await upsertCanonicalEmployee(
      {
        employeeCode: "COOK-99",
        name: "Test Chef",
        role: "LINE_COOK",
        kitchenId: "K1",
        pin: "9999",
      },
      "OWNER-01",
    );
    const saved = (await getEmployees()).find(
      (e) => e.employeeCode === "COOK-99",
    );
    expect(saved).toBeDefined();
    expect(saved?.pin).toBeUndefined();

    await expect(
      upsertVirtualFile({ name: "   " }, "OWNER-01"),
    ).rejects.toThrow(/File name is required/);

    const sanitized = await updateSystemSettings(
      { prepSlaMinutes: -50, lowStockMultiplier: Number.NaN },
      "OWNER-01",
    );
    expect(sanitized.prepSlaMinutes).toBe(12);
    expect(sanitized.lowStockMultiplier).toBe(1);
  });
});
