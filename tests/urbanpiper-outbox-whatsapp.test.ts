import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  GET as getMappingsRoute,
  POST as postMappingsRoute,
} from "@/app/api/integrations/urbanpiper-mappings/route";
import { GET as getOrdersRoute } from "@/app/api/orders/route";
import { POST as postUrbanPiperWebhook } from "@/app/api/webhooks/aggregators/urbanpiper/route";
import { POST as postDailyDigestWorker } from "@/app/api/workers/daily-digest/route";
import { POST as postOutboxWorker } from "@/app/api/workers/outbox/route";
import { signToken } from "@/lib/auth";
import {
  calculateOutboxBackoffSeconds,
  processOutboxQueue,
} from "@/lib/outbox-dispatcher";
import {
  enqueueOutboxEvent,
  getActivities,
  getInventory,
  getOrders,
  getOutboxEvents,
  getTaxInvoices,
  getWhatsAppLogs,
  mutateCanonicalInventory,
  resetStore,
  retryOutboxEvent,
  transitionCanonicalOrder,
  upsertKitchen,
  upsertOrganization,
} from "@/lib/store";
import { computeUrbanPiperSignature } from "@/lib/urbanpiper";
import { getIstDateKey, triggerLowStockSupplierAlert } from "@/lib/whatsapp";

function buildUrbanPiperRequest(
  payload: Record<string, unknown>,
  options?: { signatureOverride?: string | null; secret?: string },
): NextRequest {
  const rawBody = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (options?.signatureOverride === undefined) {
    headers["x-urbanpiper-signature"] = computeUrbanPiperSignature(
      rawBody,
      options?.secret,
    );
  } else if (options.signatureOverride !== null) {
    headers["x-urbanpiper-signature"] = options.signatureOverride;
  }

  return new NextRequest(
    "http://localhost:3000/api/webhooks/aggregators/urbanpiper",
    {
      method: "POST",
      headers,
      body: rawBody,
    },
  );
}

describe("Sprint 3B — UrbanPiper Webhooks, Durable Outbox & WhatsApp Alerts", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const originalQstashCurrent = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const originalUpSecret = process.env.URBANPIPER_WEBHOOK_SECRET;
  const originalDemoMode = process.env.DEMO_SANDBOX_MODE;

  beforeEach(async () => {
    process.env.CRON_SECRET = "test_cron_secret_3b_2026";
    process.env.QSTASH_CURRENT_SIGNING_KEY = "test_qstash_signing_key_3b_2026";
    process.env.URBANPIPER_WEBHOOK_SECRET = "test_up_webhook_secret_3b_2026";
    process.env.DEMO_SANDBOX_MODE = "true";
    await resetStore();
  });

  afterEach(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;

    if (originalQstashCurrent === undefined) {
      delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    } else {
      process.env.QSTASH_CURRENT_SIGNING_KEY = originalQstashCurrent;
    }

    if (originalUpSecret === undefined) {
      delete process.env.URBANPIPER_WEBHOOK_SECRET;
    } else {
      process.env.URBANPIPER_WEBHOOK_SECRET = originalUpSecret;
    }

    if (originalDemoMode === undefined) delete process.env.DEMO_SANDBOX_MODE;
    else process.env.DEMO_SANDBOX_MODE = originalDemoMode;
  });

  // ===========================================================================
  // Suite 1: UrbanPiper Webhook HMAC Verification, SKU Mapping & Idempotency
  // ===========================================================================
  describe("Suite 1: UrbanPiper Webhook Verification, Mapping & Idempotency", () => {
    it("rejects missing or forged X-UrbanPiper-Signature with 401 and creates no order", async () => {
      const beforeOrders = await getOrders();
      const payload = {
        event_type: "order.placed",
        external_order_id: "UP-SWG-FORGED-001",
        external_store_id: "UP-STORE-GGN-01",
        channel: "swiggy",
        customer_name: "Spoofed Caller",
        items: [{ external_item_id: "UP-SKU-MENU-BF-01", quantity: 1 }],
      };

      const missingSigRes = await postUrbanPiperWebhook(
        buildUrbanPiperRequest(payload, { signatureOverride: null }),
      );
      expect(missingSigRes.status).toBe(401);

      const forgedSigRes = await postUrbanPiperWebhook(
        buildUrbanPiperRequest(payload, {
          signatureOverride: "deadbeef".repeat(8),
        }),
      );
      expect(forgedSigRes.status).toBe(401);

      const afterOrders = await getOrders();
      expect(afterOrders.length).toBe(beforeOrders.length);
    });

    it("rejects unmapped SKUs with 422 and logs a warning operational Activity", async () => {
      const payload = {
        event_type: "order.placed",
        external_order_id: "UP-SWG-UNMAPPED-002",
        external_store_id: "UP-STORE-GGN-01",
        channel: "swiggy",
        customer_name: "Ananya Verma",
        items: [{ external_item_id: "UP-SKU-DOES-NOT-EXIST", quantity: 2 }],
      };

      const res = await postUrbanPiperWebhook(buildUrbanPiperRequest(payload));
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.unmappedSkus).toEqual(["UP-SKU-DOES-NOT-EXIST"]);

      const activities = await getActivities();
      const warning = activities.find(
        (a) =>
          a.type === "AGGREGATOR_UNMAPPED_SKU" &&
          a.severity === "warning" &&
          a.details.includes("UP-SKU-DOES-NOT-EXIST"),
      );
      expect(warning).toBeDefined();
    });

    it("creates canonical order + GST invoice on valid order.placed and replays idempotently without advancing invoice sequence", async () => {
      const invoicesBefore = await getTaxInvoices({ kitchenId: "K1" });
      const ordersBefore = await getOrders();

      const payload = {
        event_type: "order.placed",
        external_order_id: "UP-SWG-994411",
        external_store_id: "UP-STORE-GGN-01",
        channel: "swiggy",
        customer_name: "Rohan Mehta",
        packaging_fee: 25,
        items: [{ external_item_id: "UP-SKU-MENU-BF-01", quantity: 2 }],
      };

      const firstRes = await postUrbanPiperWebhook(
        buildUrbanPiperRequest(payload),
      );
      expect(firstRes.status).toBe(201);
      const firstBody = await firstRes.json();
      expect(firstBody.ok).toBe(true);
      expect(firstBody.duplicate).toBe(false);
      expect(firstBody.order.kitchenId).toBe("K1");
      expect(firstBody.order.brandId).toBe("BurgerForge");
      expect(firstBody.order.source).toBe("SWIGGY");
      expect(firstBody.order.paymentStatus).toBe("AGGREGATOR_SETTLED");
      expect(firstBody.invoice.invoiceNumber).toMatch(
        /^FY\d{2}-\d{2}\/GGN-01\/\d{4,}$/,
      );

      const ordersAfterFirst = await getOrders();
      const invoicesAfterFirst = await getTaxInvoices({ kitchenId: "K1" });
      expect(ordersAfterFirst.length).toBe(ordersBefore.length + 1);
      expect(invoicesAfterFirst.length).toBe(invoicesBefore.length + 1);

      // Replay exact same webhook
      const replayRes = await postUrbanPiperWebhook(
        buildUrbanPiperRequest(payload),
      );
      expect(replayRes.status).toBe(200);
      const replayBody = await replayRes.json();
      expect(replayBody.duplicate).toBe(true);
      expect(replayBody.order.id).toBe(firstBody.order.id);
      expect(replayBody.invoice.invoiceNumber).toBe(
        firstBody.invoice.invoiceNumber,
      );

      const ordersAfterReplay = await getOrders();
      const invoicesAfterReplay = await getTaxInvoices({ kitchenId: "K1" });
      expect(ordersAfterReplay.length).toBe(ordersAfterFirst.length);
      expect(invoicesAfterReplay.length).toBe(invoicesAfterFirst.length);
    });
  });

  // ===========================================================================
  // Suite 2: UrbanPiper order.cancelled Stage-Aware Webhook
  // ===========================================================================
  describe("Suite 2: UrbanPiper order.cancelled Stage-Aware Webhook", () => {
    it("handles pre-prep order.cancelled by issuing GST CREDIT_NOTE and zero loss", async () => {
      const placeRes = await postUrbanPiperWebhook(
        buildUrbanPiperRequest({
          event_type: "order.placed",
          external_order_id: "UP-ZMT-PREPREP-101",
          external_store_id: "UP-STORE-GGN-01",
          channel: "zomato",
          customer_name: "Priya Nair",
          items: [{ external_item_id: "UP-SKU-MENU-BF-01", quantity: 1 }],
        }),
      );
      expect(placeRes.status).toBe(201);
      const placed = await placeRes.json();

      const cancelRes = await postUrbanPiperWebhook(
        buildUrbanPiperRequest({
          event_type: "order.cancelled",
          external_order_id: "UP-ZMT-PREPREP-101",
          reason: "Customer cancelled via Zomato app before kitchen prep",
          cancelled_by: "ZOMATO_CUSTOMER",
        }),
      );
      expect(cancelRes.status).toBe(200);
      const cancelled = await cancelRes.json();
      expect(cancelled.order.status).toBe("CANCELLED");
      expect(cancelled.order.cancellationSource).toBe("AGGREGATOR_WEBHOOK");
      expect(cancelled.cancellation.stage).toBe("BEFORE_PREP");
      expect(cancelled.cancellation.financialLoss).toBe(0);
      expect(cancelled.creditNoteInvoice.status).toBe("CREDIT_NOTE");

      const invoices = await getTaxInvoices({ kitchenId: "K1" });
      const matchingInv = invoices.find((i) => i.orderId === placed.order.id);
      expect(matchingInv?.status).toBe("CREDIT_NOTE");
    });

    it("handles post-pickup order.cancelled by filing claimAmount === totalAmount and enqueuing AGGREGATOR_CLAIM_SUBMITTED", async () => {
      const placeRes = await postUrbanPiperWebhook(
        buildUrbanPiperRequest({
          event_type: "order.placed",
          external_order_id: "UP-SWG-AFTERPICKUP-202",
          external_store_id: "UP-STORE-GGN-01",
          channel: "swiggy",
          customer_name: "Kabir Singh",
          items: [{ external_item_id: "UP-SKU-MENU-BF-01", quantity: 1 }],
        }),
      );
      const placed = await placeRes.json();
      const orderId = placed.order.id as string;

      await transitionCanonicalOrder({
        orderId,
        nextStatus: "PREPARING",
        actor: "Chef Test",
      });
      await transitionCanonicalOrder({
        orderId,
        nextStatus: "READY_FOR_PICKUP",
        actor: "Chef Test",
      });
      await transitionCanonicalOrder({
        orderId,
        nextStatus: "DRIVER_ASSIGNED",
        actor: "Dispatch Test",
        driverName: "Amit Rider",
      });
      await transitionCanonicalOrder({
        orderId,
        nextStatus: "PICKED_UP",
        actor: "Dispatch Test",
      });

      const cancelRes = await postUrbanPiperWebhook(
        buildUrbanPiperRequest({
          event_type: "order.cancelled",
          external_order_id: "UP-SWG-AFTERPICKUP-202",
          reason: "Customer unreachable after courier pickup",
        }),
      );
      expect(cancelRes.status).toBe(200);
      const cancelled = await cancelRes.json();
      expect(cancelled.cancellation.stage).toBe("AFTER_PICKUP");
      expect(cancelled.cancellation.claimAmount).toBe(placed.order.totalAmount);

      const outbox = await getOutboxEvents();
      const claimEvt = outbox.find(
        (e) =>
          e.aggregateId === orderId &&
          e.eventType === "AGGREGATOR_CLAIM_SUBMITTED" &&
          e.destination === "URBANPIPER",
      );
      expect(claimEvt).toBeDefined();
      expect(claimEvt?.status).toBe("PENDING");
    });
  });

  // ===========================================================================
  // Suite 3: Durable Outbox Enqueue, Exponential Backoff & Dead-Letter
  // ===========================================================================
  describe("Suite 3: Durable Outbox Enqueue, Exponential Backoff & Dead-Letter", () => {
    it("enqueues ORDER_ACCEPTED, FOOD_READY, ORDER_DISPATCHED and exposes OUTBOX_QUEUED -> SYNCED in GET /api/orders", async () => {
      const placeRes = await postUrbanPiperWebhook(
        buildUrbanPiperRequest({
          event_type: "order.placed",
          external_order_id: "UP-SWG-LIFECYCLE-303",
          external_store_id: "UP-STORE-GGN-01",
          channel: "swiggy",
          customer_name: "Meera Kapoor",
          items: [{ external_item_id: "UP-SKU-MENU-BF-01", quantity: 1 }],
        }),
      );
      const placed = await placeRes.json();
      const orderId = placed.order.id as string;

      await transitionCanonicalOrder({
        orderId,
        nextStatus: "PREPARING",
        actor: "Chef Test",
      });
      await transitionCanonicalOrder({
        orderId,
        nextStatus: "READY_FOR_PICKUP",
        actor: "Chef Test",
      });
      await transitionCanonicalOrder({
        orderId,
        nextStatus: "DRIVER_ASSIGNED",
        actor: "Dispatch Test",
      });
      await transitionCanonicalOrder({
        orderId,
        nextStatus: "PICKED_UP",
        actor: "Dispatch Test",
      });
      await transitionCanonicalOrder({
        orderId,
        nextStatus: "DISPATCHED",
        actor: "Dispatch Test",
      });

      const outboxBefore = (await getOutboxEvents()).filter(
        (e) => e.aggregateId === orderId && e.destination === "URBANPIPER",
      );
      expect(outboxBefore.map((e) => e.eventType).sort()).toEqual([
        "FOOD_READY",
        "ORDER_ACCEPTED",
        "ORDER_DISPATCHED",
      ]);

      // GET /api/orders reflects OUTBOX_QUEUED before worker flush
      const ordersResBefore = await getOrdersRoute(
        new NextRequest("http://localhost:3000/api/orders"),
      );
      const ordersJsonBefore = await ordersResBefore.json();
      const matchedBefore = ordersJsonBefore.orders.find(
        (o: { id: string }) => o.id === orderId,
      );
      expect(matchedBefore.aggregatorSyncStatus).toBe("OUTBOX_QUEUED");

      // Flush queue -> all DELIVERED
      const flushResult = await processOutboxQueue({ limit: 25 });
      expect(flushResult.delivered).toBeGreaterThanOrEqual(3);

      const ordersResAfter = await getOrdersRoute(
        new NextRequest("http://localhost:3000/api/orders"),
      );
      const ordersJsonAfter = await ordersResAfter.json();
      const matchedAfter = ordersJsonAfter.orders.find(
        (o: { id: string }) => o.id === orderId,
      );
      expect(matchedAfter.aggregatorSyncStatus).toBe("SYNCED");
    });

    it("applies 30s * 4^(attempt-1) exponential backoff, dead-letters at maxAttempts, and supports manual retry", async () => {
      expect(calculateOutboxBackoffSeconds(1)).toBe(30);
      expect(calculateOutboxBackoffSeconds(2)).toBe(120);
      expect(calculateOutboxBackoffSeconds(3)).toBe(480);

      const evt = await enqueueOutboxEvent({
        organizationId: "ORG-001",
        kitchenId: "K1",
        destination: "URBANPIPER",
        eventType: "ORDER_ACCEPTED",
        aggregateId: "ORD-BACKOFF-TEST",
        payload: { externalOrderId: "UP-FAIL-999", newStatus: "ORDER_ACCEPTED" },
        maxAttempts: 3,
      });

      const t0 = new Date(Date.now() + 1000);

      // Attempt 1 fails -> RETRYING (+30s)
      const r1 = await processOutboxQueue({
        now: t0,
        deliverFn: async () => {
          throw new Error("UrbanPiper 503 Service Unavailable");
        },
      });
      expect(r1.retrying).toBe(1);
      const after1 = r1.events.find((e) => e.id === evt.id)!;
      expect(after1.status).toBe("RETRYING");
      expect(after1.attempt).toBe(1);
      expect(new Date(after1.nextRetryAt!).getTime() - t0.getTime()).toBe(
        30_000,
      );

      // Before +30s -> skipped (not due yet)
      const rEarly = await processOutboxQueue({
        now: new Date(t0.getTime() + 10_000),
      });
      expect(rEarly.processed).toBe(0);

      // Attempt 2 fails at t0 + 31s -> RETRYING (+120s)
      const t1 = new Date(t0.getTime() + 31_000);
      const r2 = await processOutboxQueue({
        now: t1,
        deliverFn: async () => {
          throw new Error("UrbanPiper 504 Gateway Timeout");
        },
      });
      const after2 = r2.events.find((e) => e.id === evt.id)!;
      expect(after2.status).toBe("RETRYING");
      expect(after2.attempt).toBe(2);
      expect(new Date(after2.nextRetryAt!).getTime() - t1.getTime()).toBe(
        120_000,
      );

      // Attempt 3 fails at t1 + 121s -> DEAD-LETTER (FAILED) + error Activity
      const t2 = new Date(t1.getTime() + 121_000);
      const r3 = await processOutboxQueue({
        now: t2,
        deliverFn: async () => {
          throw new Error("UrbanPiper Permanent Rejection");
        },
      });
      expect(r3.failed).toBe(1);
      const after3 = r3.events.find((e) => e.id === evt.id)!;
      expect(after3.status).toBe("FAILED");
      expect(after3.attempt).toBe(3);

      const activities = await getActivities();
      expect(
        activities.some(
          (a) =>
            a.type === "OUTBOX_DEAD_LETTER" &&
            a.severity === "error" &&
            a.details.includes(evt.id),
        ),
      ).toBe(true);

      // Manual retry re-queues to PENDING (attempt 0) and next flush succeeds
      const requeued = await retryOutboxEvent(evt.id, "Vikram Owner");
      expect(requeued.status).toBe("PENDING");
      expect(requeued.attempt).toBe(0);

      const r4 = await processOutboxQueue({ now: new Date(t2.getTime() + 1000) });
      const after4 = r4.events.find((e) => e.id === evt.id)!;
      expect(after4.status).toBe("DELIVERED");
      expect(after4.deliveredAt).toBeTruthy();
    });
  });

  // ===========================================================================
  // Suite 4: Automated Low-Stock WhatsApp Alert + Cooldown Deduplication
  // ===========================================================================
  describe("Suite 4: Automated Low-Stock WhatsApp Alert + Cooldown Deduplication", () => {
    it("sends exactly one SANDBOX_LOGGED WhatsApp alert on stock drop and deduplicates within cooldown", async () => {
      const k1Inventory = await getInventory("K1");
      // Pick an ingredient currently above reorderThreshold
      const target = k1Inventory.find(
        (i) => i.currentStock > i.reorderThreshold,
      )!;
      expect(target).toBeDefined();

      const dropQty = target.currentStock - target.reorderThreshold + 10;
      await mutateCanonicalInventory({
        itemId: target.id,
        kitchenId: "K1",
        action: "WASTE",
        quantity: dropQty,
        actor: "Chef Arjun",
        reason: "Spillage during lunch rush",
      });

      const logsAfterFirst = await getWhatsAppLogs({
        organizationId: "ORG-001",
        kitchenId: "K1",
        templateName: "LOW_STOCK_SUPPLIER_ALERT",
      });
      const sentForIngredient = logsAfterFirst.filter(
        (l) =>
          l.dedupeKey === `low-stock:ORG-001:K1:${target.ingredientId ?? target.id}` &&
          (l.status === "SANDBOX_LOGGED" || l.status === "SENT"),
      );
      expect(sentForIngredient.length).toBe(1);
      expect(sentForIngredient[0].providerMessageId).toMatch(/^wa_sbx_/);

      // Second trigger within cooldown window -> skipped: true, reason: COOLDOWN_ACTIVE
      const secondTrigger = await triggerLowStockSupplierAlert({
        organizationId: "ORG-001",
        kitchenId: "K1",
        ingredientId: target.ingredientId ?? target.id,
        sku: target.sku,
        itemName: target.name,
        currentStock: Math.max(0, target.reorderThreshold - 15),
        reorderThreshold: target.reorderThreshold,
        unit: target.unit,
        actor: "Chef Arjun",
      });
      expect(secondTrigger.skipped).toBe(true);
      expect(secondTrigger.reason).toBe("COOLDOWN_ACTIVE");

      const logsAfterSecond = await getWhatsAppLogs({
        organizationId: "ORG-001",
        kitchenId: "K1",
        templateName: "LOW_STOCK_SUPPLIER_ALERT",
      });
      const sentCountAfterSecond = logsAfterSecond.filter(
        (l) =>
          l.dedupeKey === `low-stock:ORG-001:K1:${target.ingredientId ?? target.id}` &&
          (l.status === "SANDBOX_LOGGED" || l.status === "SENT"),
      );
      expect(sentCountAfterSecond.length).toBe(1);
    });
  });

  // ===========================================================================
  // Suite 5: Daily IST INR Digest & Worker Auth / RBAC Security
  // ===========================================================================
  describe("Suite 5: Daily IST INR Digest & Worker Auth / RBAC Security", () => {
    it("strictly rejects unauthenticated calls to /api/workers/outbox and /api/workers/daily-digest with 401", async () => {
      const unauthOutbox = await postOutboxWorker(
        new NextRequest("http://localhost:3000/api/workers/outbox", {
          method: "POST",
        }),
      );
      expect(unauthOutbox.status).toBe(401);

      const unauthDigest = await postDailyDigestWorker(
        new NextRequest("http://localhost:3000/api/workers/daily-digest", {
          method: "POST",
        }),
      );
      expect(unauthDigest.status).toBe(401);
    });

    it("authenticates /api/workers/outbox via Bearer CRON_SECRET and Upstash-Signature JWT", async () => {
      await enqueueOutboxEvent({
        organizationId: "ORG-001",
        kitchenId: "K1",
        destination: "URBANPIPER",
        eventType: "FOOD_READY",
        aggregateId: "ORD-QSTASH-AUTH",
        payload: { externalOrderId: "UP-QSTASH-01", newStatus: "FOOD_READY" },
      });

      // 1. Valid Bearer CRON_SECRET
      const cronRes = await postOutboxWorker(
        new NextRequest("http://localhost:3000/api/workers/outbox", {
          method: "POST",
          headers: {
            authorization: `Bearer ${process.env.CRON_SECRET}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ limit: 10 }),
        }),
      );
      expect(cronRes.status).toBe(200);
      const cronJson = await cronRes.json();
      expect(cronJson.authMethod).toBe("CRON_SECRET");
      expect(cronJson.delivered).toBeGreaterThanOrEqual(1);

      // 2. Valid Upstash-Signature JWT
      const key = new TextEncoder().encode(
        process.env.QSTASH_CURRENT_SIGNING_KEY!,
      );
      const qstashJwt = await new SignJWT({ sub: "https://darkitos.app/api/workers/outbox" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer("Upstash")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(key);

      const qstashRes = await postOutboxWorker(
        new NextRequest("http://localhost:3000/api/workers/outbox", {
          method: "POST",
          headers: { "upstash-signature": qstashJwt },
        }),
      );
      expect(qstashRes.status).toBe(200);
      const qstashJson = await qstashRes.json();
      expect(qstashJson.authMethod).toBe("QSTASH_SIGNATURE");
    });

    it("generates accurate IST Daily INR Digest and deduplicates repeat runs on the same IST date", async () => {
      // Cancel seeded PICKED_UP order ORD-906 so postPickupClaimsInr = ₹798 is verified alongside seeded mid-prep loss
      await transitionCanonicalOrder({
        orderId: "ORD-906",
        nextStatus: "CANCELLED",
        actor: "Patric Revuelto",
        cancellationSource: "AGGREGATOR_WEBHOOK",
        cancellationReason: "Customer unreachable after courier pickup",
      });

      const todayIst = getIstDateKey(new Date());
      const firstRes = await postDailyDigestWorker(
        new NextRequest("http://localhost:3000/api/workers/daily-digest", {
          method: "POST",
          headers: {
            authorization: `Bearer ${process.env.CRON_SECRET}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            organizationId: "ORG-001",
            istDate: todayIst,
          }),
        }),
      );
      expect(firstRes.status).toBe(200);
      const firstJson = await firstRes.json();
      expect(firstJson.ok).toBe(true);
      expect(firstJson.results.length).toBe(1);
      const orgDigest = firstJson.results[0];
      expect(orgDigest.skipped).toBe(false);
      expect(orgDigest.metrics.totalOrders).toBeGreaterThan(0);
      expect(orgDigest.metrics.grossInrSales).toBeGreaterThan(0);
      expect(orgDigest.metrics.totalGstCollected).toBeGreaterThan(0);
      expect(orgDigest.metrics.midPrepLossInr).toBeGreaterThan(0);
      expect(orgDigest.metrics.postPickupClaimsInr).toBeGreaterThanOrEqual(798);
      expect(orgDigest.log.templateName).toBe("DAILY_OWNER_INR_DIGEST");
      expect(orgDigest.log.status).toBe("SANDBOX_LOGGED");

      // Second trigger for the exact same IST date -> deduplicated
      const secondRes = await postDailyDigestWorker(
        new NextRequest("http://localhost:3000/api/workers/daily-digest", {
          method: "POST",
          headers: {
            authorization: `Bearer ${process.env.CRON_SECRET}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            organizationId: "ORG-001",
            istDate: todayIst,
          }),
        }),
      );
      expect(secondRes.status).toBe(200);
      const secondJson = await secondRes.json();
      expect(secondJson.results[0].skipped).toBe(true);
      expect(secondJson.results[0].reason).toBe("COOLDOWN_ACTIVE");
    });

    it("enforces OWNER_VIEW and cross-org kitchen isolation on /api/integrations/urbanpiper-mappings", async () => {
      await upsertOrganization({
        id: "ORG-002",
        name: "Rival Cloud Kitchens Pvt Ltd",
        slug: "rival-cloud",
      });
      await upsertKitchen({
        id: "K9",
        organizationId: "ORG-002",
        name: "Mumbai Andheri Pod",
        code: "BOM-09",
        location: "Andheri West, Mumbai",
        stateCode: "27",
        timezone: "Asia/Kolkata",
        active: true,
      });

      const cookToken = await signToken({
        userId: "EMP-K1-COOK-01",
        organizationId: "ORG-001",
        employeeCode: "2001",
        name: "K1 Line Cook",
        role: "LINE_COOK",
        kitchenId: "K1",
      });

      const cookGet = await getMappingsRoute(
        new NextRequest(
          "http://localhost:3000/api/integrations/urbanpiper-mappings",
          {
            method: "GET",
            headers: { cookie: `dark_cloud_session=${cookToken}` },
          },
        ),
      );
      expect(cookGet.status).toBe(403);

      const ownerToken = await signToken({
        userId: "EMP-OWNER-01",
        organizationId: "ORG-001",
        employeeCode: "OWNER-01",
        name: "Patric Revuelto",
        role: "OWNER",
        kitchenId: "ALL",
      });

      // Cross-org kitchen K9 belongs to ORG-002 -> ORG-001 owner gets 403
      const crossOrgPost = await postMappingsRoute(
        new NextRequest(
          "http://localhost:3000/api/integrations/urbanpiper-mappings",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              cookie: `dark_cloud_session=${ownerToken}`,
            },
            body: JSON.stringify({
              kitchenId: "K9",
              brandId: "BurgerForge",
              menuItemId: "MENU-BF-01",
              channel: "SWIGGY",
              externalStoreId: "UP-STORE-CROSS",
              externalItemId: "UP-SKU-CROSS",
            }),
          },
        ),
      );
      expect(crossOrgPost.status).toBe(403);

      // Same-org kitchen K1 succeeds
      const sameOrgPost = await postMappingsRoute(
        new NextRequest(
          "http://localhost:3000/api/integrations/urbanpiper-mappings",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              cookie: `dark_cloud_session=${ownerToken}`,
            },
            body: JSON.stringify({
              kitchenId: "K1",
              brandId: "BurgerForge",
              menuItemId: "MENU-BF-01",
              channel: "SWIGGY",
              externalStoreId: "UP-STORE-GGN-01",
              externalItemId: "UP-SKU-PROMO-BF",
            }),
          },
        ),
      );
      expect(sameOrgPost.status).toBe(201);
    });
  });
});
