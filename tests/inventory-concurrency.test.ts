import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb } from "@/lib/db-client";
import {
  findOrder,
  getInventory,
  getInventoryMovements,
  getOrders,
  getWebhookEvents,
  injectCanonicalOrder,
  mutateCanonicalInventory,
  resetStore,
  transferKitchenInventory,
  transitionCanonicalOrder,
} from "@/lib/store";
import { POST as loginHandler } from "@/app/api/login/route";
import {
  GET as getInventoryHandler,
  PATCH as patchInventoryHandler,
} from "@/app/api/inventory/route";

function makeRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    cookies?: Record<string, string>;
  } = {},
): NextRequest {
  const headers = new Headers();
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (options.cookies && Object.keys(options.cookies).length > 0) {
    headers.set(
      "cookie",
      Object.entries(options.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    );
  }
  return new NextRequest(url, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

async function loginAs(code: string): Promise<string> {
  const res = await loginHandler(
    makeRequest("http://localhost:3000/api/login", {
      method: "POST",
      body: { employeeCode: code },
    }),
  );
  expect(res.status).toBe(200);
  return res.cookies.get("dark_cloud_session")!.value;
}

describe("Per-kitchen inventory isolation, concurrency locking & atomic transfers", () => {
  beforeEach(async () => {
    process.env.DEMO_SANDBOX_MODE = "true";
    await resetStore();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("isolates inventory stock strictly per kitchen (K1 depletion never touches K2/K3/K4)", async () => {
    const k1BeefBefore = (await getInventory("K1")).find(
      (i) => i.id === "INV-001",
    )!.currentStock;
    const k2BeefBefore = (await getInventory("K2")).find(
      (i) => i.id === "INV-001",
    )!.currentStock;
    const k3BeefBefore = (await getInventory("K3")).find(
      (i) => i.id === "INV-001",
    )!.currentStock;
    const k4BeefBefore = (await getInventory("K4")).find(
      (i) => i.id === "INV-001",
    )!.currentStock;

    // Zero out Brioche Buns at K1 ONLY
    await mutateCanonicalInventory({
      itemId: "INV-002",
      kitchenId: "K1",
      action: "SET_STOCK",
      currentStock: 0,
      actor: "OWNER-01",
    });

    // K1 burger order should report INSUFFICIENT_STOCK at intake
    const k1Order = await injectCanonicalOrder({
      brandId: "BurgerForge",
      kitchenId: "K1",
      channel: "Swiggy",
      items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
      actor: "OWNER-01",
    });
    expect(k1Order.inventoryDecision).toBe("INSUFFICIENT_STOCK");

    // Meanwhile K2 still has 88 Brioche Buns, so a K2 burger order succeeds & depletes ONLY K2!
    const k2Order = await injectCanonicalOrder({
      brandId: "BurgerForge",
      kitchenId: "K2",
      channel: "Swiggy",
      items: [{ menuItemId: "MENU-BF-01", quantity: 2 }],
      actor: "OWNER-01",
    });
    expect(k2Order.inventoryDecision).toBe("AVAILABLE");

    await transitionCanonicalOrder({
      orderId: k2Order.order.id,
      nextStatus: "PREPARING",
      actor: "2002 (Sunita Rao)",
    });

    const k1BeefAfter = (await getInventory("K1")).find(
      (i) => i.id === "INV-001",
    )!.currentStock;
    const k2BeefAfter = (await getInventory("K2")).find(
      (i) => i.id === "INV-001",
    )!.currentStock;
    const k3BeefAfter = (await getInventory("K3")).find(
      (i) => i.id === "INV-001",
    )!.currentStock;
    const k4BeefAfter = (await getInventory("K4")).find(
      (i) => i.id === "INV-001",
    )!.currentStock;

    expect(k1BeefAfter).toBe(k1BeefBefore);
    expect(k2BeefAfter).toBe(k2BeefBefore - 4); // 2 burgers × 2 patties
    expect(k3BeefAfter).toBe(k3BeefBefore);
    expect(k4BeefAfter).toBe(k4BeefBefore);
  });

  it("prevents negative stock under concurrent PENDING -> PREPARING contention", async () => {
    // Set K1 Brioche Buns to exactly 2 units (enough for ONE 2-burger order, NOT two!)
    await mutateCanonicalInventory({
      itemId: "INV-002",
      kitchenId: "K1",
      action: "SET_STOCK",
      currentStock: 2,
      actor: "OWNER-01",
    });

    const [ordA, ordB] = await Promise.all([
      injectCanonicalOrder({
        id: "ORD-RACE-A",
        brandId: "BurgerForge",
        kitchenId: "K1",
        channel: "Swiggy",
        items: [{ menuItemId: "MENU-BF-01", quantity: 2 }],
        actor: "OWNER-01",
      }),
      injectCanonicalOrder({
        id: "ORD-RACE-B",
        brandId: "BurgerForge",
        kitchenId: "K1",
        channel: "Zomato",
        items: [{ menuItemId: "MENU-BF-01", quantity: 2 }],
        actor: "OWNER-01",
      }),
    ]);

    // Race both orders into PREPARING simultaneously
    const outcomes = await Promise.allSettled([
      transitionCanonicalOrder({
        orderId: ordA.order.id,
        nextStatus: "PREPARING",
        actor: "2001 (Rajesh Kumar)",
      }),
      transitionCanonicalOrder({
        orderId: ordB.order.id,
        nextStatus: "PREPARING",
        actor: "2001 (Rajesh Kumar)",
      }),
    ]);

    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter((o) => o.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(
      /Insufficient inventory/,
    );

    // K1 stock must be exactly 0 (NEVER negative!)
    const bunsFinal = (await getInventory("K1")).find(
      (i) => i.id === "INV-002",
    )!.currentStock;
    expect(bunsFinal).toBe(0);

    // Exactly one order is PREPARING, the other remains PENDING with INVENTORY_UNAVAILABLE audit event
    const [afterA, afterB] = await Promise.all([
      findOrder("ORD-RACE-A"),
      findOrder("ORD-RACE-B"),
    ]);
    const states = [afterA!, afterB!];
    const winner = states.find((o) => o.status === "PREPARING");
    const loser = states.find((o) => o.status === "PENDING");

    expect(winner).toBeDefined();
    expect(winner!.inventoryConsumed).toBe(true);
    expect(loser).toBeDefined();
    expect(loser!.inventoryDecision).toBe("INSUFFICIENT_STOCK");
    expect(
      loser!.events.some((e) => e.type === "INVENTORY_UNAVAILABLE"),
    ).toBe(true);
  });

  it("executes atomic inter-kitchen transfers with paired TRANSFER_OUT / TRANSFER_IN movements and rolls back on shortage", async () => {
    const k2Before = (await getInventory("K2")).find(
      (i) => i.id === "INV-002",
    )!.currentStock;
    const k1Before = (await getInventory("K1")).find(
      (i) => i.id === "INV-002",
    )!.currentStock;
    const k3Before = (await getInventory("K3")).find(
      (i) => i.id === "INV-002",
    )!.currentStock;

    const transfer = await transferKitchenInventory({
      itemId: "INV-002",
      fromKitchenId: "K2",
      toKitchenId: "K1",
      quantity: 20,
      reason: "Evening rush brioche rebalance",
      actor: "OWNER-01 (Patric Revuelto)",
    });

    expect(transfer.transferGroupId).toMatch(/^XFER-/);
    expect(transfer.fromItem.currentStock).toBe(k2Before - 20);
    expect(transfer.toItem.currentStock).toBe(k1Before + 20);
    expect(transfer.outMovement.type).toBe("TRANSFER_OUT");
    expect(transfer.outMovement.quantity).toBe(-20);
    expect(transfer.outMovement.kitchenId).toBe("K2");
    expect(transfer.inMovement.type).toBe("TRANSFER_IN");
    expect(transfer.inMovement.quantity).toBe(20);
    expect(transfer.inMovement.kitchenId).toBe("K1");
    expect(transfer.outMovement.transferGroupId).toBe(
      transfer.inMovement.transferGroupId,
    );

    // K3 untouched
    expect(
      (await getInventory("K3")).find((i) => i.id === "INV-002")!.currentStock,
    ).toBe(k3Before);

    // Paired ledger rows persisted
    const pairedMovements = (await getInventoryMovements()).filter(
      (m) => m.transferGroupId === transfer.transferGroupId,
    );
    expect(pairedMovements).toHaveLength(2);

    // Over-transfer exceeding K2 stock must reject cleanly without partial mutation
    await expect(
      transferKitchenInventory({
        itemId: "INV-002",
        fromKitchenId: "K2",
        toKitchenId: "K1",
        quantity: 9999,
        actor: "OWNER-01",
      }),
    ).rejects.toThrow(/Insufficient stock/);

    expect(
      (await getInventory("K2")).find((i) => i.id === "INV-002")!.currentStock,
    ).toBe(k2Before - 20);
    expect(
      (await getInventory("K1")).find((i) => i.id === "INV-002")!.currentStock,
    ).toBe(k1Before + 20);
  });

  it("enforces dual-kitchen RBAC on GET & PATCH /api/inventory transfers", async () => {
    const ownerJwt = await loginAs("OWNER-01");
    const k1MgrJwt = await loginAs("0001"); // K1 MANAGER
    const k1CookJwt = await loginAs("2001"); // K1 LINE_COOK

    // LINE_COOK blocked from viewing K2 inventory
    const cookCrossView = await getInventoryHandler(
      makeRequest("http://localhost:3000/api/inventory?kitchenId=K2", {
        cookies: { dark_cloud_session: k1CookJwt },
      }),
    );
    expect(cookCrossView.status).toBe(403);

    // LINE_COOK viewing default inventory gets strictly K1's 11 rows
    const cookOwnView = await getInventoryHandler(
      makeRequest("http://localhost:3000/api/inventory", {
        cookies: { dark_cloud_session: k1CookJwt },
      }),
    );
    expect(cookOwnView.status).toBe(200);
    const cookData = await cookOwnView.json();
    expect(cookData.inventory).toHaveLength(11);
    expect(
      cookData.inventory.every(
        (i: { kitchenId: string }) => i.kitchenId === "K1",
      ),
    ).toBe(true);

    // K1 MANAGER blocked from transferring across K2 -> K1 (no K2 access)
    const mgrTransfer = await patchInventoryHandler(
      makeRequest("http://localhost:3000/api/inventory", {
        method: "PATCH",
        cookies: { dark_cloud_session: k1MgrJwt },
        body: {
          action: "TRANSFER",
          itemId: "INV-002",
          fromKitchenId: "K2",
          toKitchenId: "K1",
          quantity: 10,
        },
      }),
    );
    expect(mgrTransfer.status).toBe(403);

    // Global OWNER succeeds on K2 -> K1 transfer
    const ownerTransfer = await patchInventoryHandler(
      makeRequest("http://localhost:3000/api/inventory", {
        method: "PATCH",
        cookies: { dark_cloud_session: ownerJwt },
        body: {
          action: "TRANSFER",
          itemId: "INV-002",
          fromKitchenId: "K2",
          toKitchenId: "K1",
          quantity: 15,
          reason: "Owner rebalancing test",
        },
      }),
    );
    expect(ownerTransfer.status).toBe(200);
    const transferJson = await ownerTransfer.json();
    expect(transferJson.success).toBe(true);
    expect(transferJson.transferGroupId).toMatch(/^XFER-/);
    expect(transferJson.fromItem.kitchenId).toBe("K2");
    expect(transferJson.toItem.kitchenId).toBe("K1");
  });

  it("deduplicates 5 parallel identical webhook injections into exactly 1 order", async () => {
    const key = "idem-parallel-burst-999";
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        injectCanonicalOrder({
          idempotencyKey: key,
          brandId: "BurgerForge",
          kitchenId: "K1",
          channel: "Swiggy",
          items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
          actor: "SWIGGY_WEBHOOK",
        }),
      ),
    );

    const uniqueOrderIds = new Set(results.map((r) => r.order.id));
    expect(uniqueOrderIds.size).toBe(1);

    const freshCount = results.filter((r) => !r.idempotentReplay).length;
    const replayCount = results.filter((r) => r.idempotentReplay).length;
    expect(freshCount).toBe(1);
    expect(replayCount).toBe(4);

    const matchingOrders = (await getOrders()).filter(
      (o) => o.idempotencyKey === key,
    );
    expect(matchingOrders).toHaveLength(1);

    const webhook = (await getWebhookEvents()).find(
      (w) => w.idempotencyKey === key,
    );
    expect(webhook?.hitCount).toBe(5);
  });
});
