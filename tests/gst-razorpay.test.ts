import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { signToken } from "@/lib/auth";
import { closeDb } from "@/lib/db-client";
import {
  calculateIndianGstBreakup,
  formatTaxInvoiceNumber,
  getIndianFinancialYear,
} from "@/lib/gst";
import {
  computeRazorpayWebhookSignature,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from "@/lib/razorpay";
import {
  cancelCanonicalOrder,
  findOrder,
  findTaxInvoiceByOrderId,
  getPaymentTransactions,
  getTaxInvoices,
  injectCanonicalOrder,
  resetStore,
  toggleBrandKitchenMapping,
  upsertCanonicalEmployee,
  upsertKitchen,
  upsertOrganization,
} from "@/lib/store";
import { GET as getInvoicesHandler } from "@/app/api/invoices/route";
import { GET as getInvoiceByIdHandler } from "@/app/api/invoices/[id]/route";
import { GET as exportInvoicesHandler } from "@/app/api/invoices/export/route";
import { POST as createRazorpayOrderHandler } from "@/app/api/payments/razorpay/order/route";
import { POST as razorpayWebhookHandler } from "@/app/api/webhooks/razorpay/route";

function makeJsonRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  const headers = new Headers(options.headers || {});
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
    body:
      options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

function makeRawWebhookRequest(
  rawBody: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/razorpay", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: rawBody,
  });
}

async function makeSessionCookie(
  employeeCode: string,
  role: "OWNER" | "MANAGER" | "LINE_COOK" | "DISPATCH",
  name: string,
  kitchenId?: string,
  organizationId = "ORG-001",
) {
  const token = await signToken({
    userId: employeeCode,
    employeeCode,
    role,
    name,
    kitchenId,
    organizationId,
    authProvider: "demo_jwt",
  });
  return { dark_cloud_session: token };
}

describe("Sprint 3A — Indian GST Invoicing Engine, Accounting Exports & Razorpay Direct Web", () => {
  beforeEach(async () => {
    await resetStore();
  });

  afterAll(async () => {
    await closeDb();
  });

  // ---------------------------------------------------------------------------
  // 1. GST & Financial Year Calculation Suite
  // ---------------------------------------------------------------------------
  describe("1. Indian GST & Financial Year calculations (lib/gst.ts)", () => {
    it("computes intra-state 2.5% CGST + 2.5% SGST with paise rounding and 0% IGST", () => {
      const gst = calculateIndianGstBreakup({
        itemsSubtotal: 599,
        packagingFee: 20,
        sellerStateCode: "06",
        placeOfSupplyStateCode: "06",
        gstRatePct: 5,
      });

      expect(gst.isInterState).toBe(false);
      expect(gst.taxableSubtotal).toBe(619);
      expect(gst.cgstRate).toBe(2.5);
      expect(gst.sgstRate).toBe(2.5);
      expect(gst.igstRate).toBe(0);
      expect(gst.cgstAmount).toBe(15.48);
      expect(gst.sgstAmount).toBe(15.48);
      expect(gst.igstAmount).toBe(0);
      expect(gst.totalTax).toBe(30.96);
      expect(gst.grandTotal).toBe(649.96);
    });

    it("computes inter-state 5% IGST with 0% CGST and 0% SGST", () => {
      const gst = calculateIndianGstBreakup({
        itemsSubtotal: 760,
        packagingFee: 0,
        sellerStateCode: "06",
        placeOfSupplyStateCode: "07",
        gstRatePct: 5,
      });

      expect(gst.isInterState).toBe(true);
      expect(gst.cgstRate).toBe(0);
      expect(gst.cgstAmount).toBe(0);
      expect(gst.sgstRate).toBe(0);
      expect(gst.sgstAmount).toBe(0);
      expect(gst.igstRate).toBe(5);
      expect(gst.igstAmount).toBe(38);
      expect(gst.totalTax).toBe(38);
      expect(gst.grandTotal).toBe(798);
    });

    it("evaluates Indian financial year boundaries (Apr 1 – Mar 31) and formats invoice numbers", () => {
      expect(getIndianFinancialYear(new Date("2026-11-26T00:00:00.000Z"))).toBe("FY26-27");
      expect(getIndianFinancialYear(new Date("2027-02-15T00:00:00.000Z"))).toBe("FY26-27");
      expect(getIndianFinancialYear(new Date("2027-03-31T23:59:59.000Z"))).toBe("FY26-27");
      expect(getIndianFinancialYear(new Date("2027-04-01T00:00:00.000Z"))).toBe("FY27-28");

      expect(
        formatTaxInvoiceNumber({
          financialYear: "FY26-27",
          kitchenCode: "GGN",
          sequenceNumber: 1,
        }),
      ).toBe("FY26-27/GGN/0001");
      expect(
        formatTaxInvoiceNumber({
          financialYear: "FY26-27",
          kitchenCode: "ggn-01",
          sequenceNumber: 42,
        }),
      ).toBe("FY26-27/GGN-01/0042");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Concurrent Gapless Sequential Invoice Allocation Suite
  // ---------------------------------------------------------------------------
  describe("2. Concurrent gapless sequential GST invoice allocation", () => {
    it("issues 10 strictly monotonic, gapless sequential invoices under Promise.all concurrency", async () => {
      const fy = getIndianFinancialYear();
      const beforeInvoices = await getTaxInvoices({
        organizationId: "ORG-001",
        kitchenId: "K1",
        financialYear: fy,
      });
      const baseMaxSeq = beforeInvoices.reduce(
        (max, inv) => Math.max(max, inv.sequenceNumber),
        0,
      );

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, idx) =>
          injectCanonicalOrder({
            idempotencyKey: `idem-gst-conc-${idx}`,
            brandId: "BurgerForge",
            kitchenId: "K1",
            channel: "Swiggy",
            items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
            actor: "OWNER-01",
          }),
        ),
      );

      expect(results).toHaveLength(10);
      const sequences = results
        .map((r) => r.invoice!.sequenceNumber)
        .sort((a, b) => a - b);
      const expected = Array.from({ length: 10 }, (_, i) => baseMaxSeq + i + 1);
      expect(sequences).toEqual(expected);

      const uniqueNumbers = new Set(results.map((r) => r.invoice!.invoiceNumber));
      expect(uniqueNumbers.size).toBe(10);

      // Replaying an idempotency key does NOT consume another invoice sequence
      const replay = await injectCanonicalOrder({
        idempotencyKey: "idem-gst-conc-0",
        brandId: "BurgerForge",
        kitchenId: "K1",
        channel: "Swiggy",
        items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
        actor: "OWNER-01",
      });
      expect(replay.idempotentReplay).toBe(true);
      expect(replay.invoice?.invoiceNumber).toBe(results[0].invoice?.invoiceNumber);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Multi-Tenant & Kitchen-Scoped Invoice RBAC & Accounting CSV Exports
  // ---------------------------------------------------------------------------
  describe("3. Org/Kitchen RBAC on /api/invoices & Tally/Zoho/GSTR-1 exports", () => {
    it("enforces 401/403 RBAC and isolates Tally CSV, Zoho CSV, and GSTR-1 exports by org & kitchen", async () => {
      // Seed second organization + kitchen + manager + invoice
      await upsertOrganization({
        id: "ORG-002",
        name: "SpiceRoute Cloud Foods Pvt. Ltd.",
        slug: "spiceroute-cloud",
        gstin: "27AABCS9876K1Z2",
        fssaiLicense: "11524999000999",
        active: true,
        createdAt: new Date().toISOString(),
      });
      await upsertKitchen({
        id: "K9",
        organizationId: "ORG-002",
        name: "Mumbai Andheri Hub",
        code: "BOM-09",
        location: "Andheri West, Mumbai",
        areaCode: "BOM-09",
        stateCode: "27",
        gstin: "27AABCS9876K1Z2",
        fssaiLicense: "11524999000999",
        active: true,
        timezone: "Asia/Kolkata",
        capacityPerHour: 100,
      });
      await toggleBrandKitchenMapping("BurgerForge", "K9", "SYSTEM");
      await upsertCanonicalEmployee(
        {
          employeeCode: "MGR-K9",
          name: "Aarav Mehta",
          role: "MANAGER",
          kitchenId: "K9",
          organizationId: "ORG-002",
        },
        "SYSTEM",
      );
      await upsertCanonicalEmployee(
        {
          employeeCode: "MGR-K2",
          name: "Neha Verma",
          role: "MANAGER",
          kitchenId: "K2",
          organizationId: "ORG-001",
        },
        "OWNER-01",
      );

      // Create an invoice in ORG-002 / K9 and an inter-state invoice in ORG-001 / K2
      const org2Order = await injectCanonicalOrder({
        organizationId: "ORG-002",
        brandId: "BurgerForge",
        kitchenId: "K9",
        channel: "Swiggy",
        customerName: "Mumbai Guest",
        items: [{ menuItemId: "MENU-BF-01", quantity: 1 }],
        actor: "MGR-K9",
      });
      const k2Order = await injectCanonicalOrder({
        organizationId: "ORG-001",
        brandId: "BurgerForge",
        kitchenId: "K2",
        channel: "Zomato",
        customerName: "Noida B2B Buyer",
        placeOfSupplyStateCode: "07", // Inter-state UP (09) -> Delhi (07)
        items: [{ menuItemId: "MENU-BF-01", quantity: 2 }],
        actor: "MGR-K2",
      });

      // Unauthenticated (with DEMO_SANDBOX_MODE disabled) -> 401
      const prevSandbox = process.env.DEMO_SANDBOX_MODE;
      process.env.DEMO_SANDBOX_MODE = "false";
      try {
        const unauthRes = await getInvoicesHandler(
          makeJsonRequest("http://localhost:3000/api/invoices"),
        );
        expect(unauthRes.status).toBe(401);
      } finally {
        if (prevSandbox === undefined) delete process.env.DEMO_SANDBOX_MODE;
        else process.env.DEMO_SANDBOX_MODE = prevSandbox;
      }

      // LINE_COOK -> 403
      const cookCookies = await makeSessionCookie("2001", "LINE_COOK", "Rajesh Kumar", "K1");
      const cookRes = await getInvoicesHandler(
        makeJsonRequest("http://localhost:3000/api/invoices", { cookies: cookCookies }),
      );
      expect(cookRes.status).toBe(403);

      // ORG-001 MANAGER (K2) sees ONLY K2 invoices, blocked from K1 and ORG-002 K9
      const mgrK2Cookies = await makeSessionCookie("MGR-K2", "MANAGER", "Neha Verma", "K2");
      const mgrListRes = await getInvoicesHandler(
        makeJsonRequest("http://localhost:3000/api/invoices", { cookies: mgrK2Cookies }),
      );
      expect(mgrListRes.status).toBe(200);
      const mgrListBody = await mgrListRes.json();
      expect(mgrListBody.invoices.length).toBeGreaterThan(0);
      expect(
        mgrListBody.invoices.every(
          (i: { kitchenId: string; organizationId: string }) =>
            i.kitchenId === "K2" && i.organizationId === "ORG-001",
        ),
      ).toBe(true);

      // Cross-kitchen query by K2 manager -> 403
      const crossKitchenRes = await getInvoicesHandler(
        makeJsonRequest("http://localhost:3000/api/invoices?kitchenId=K1", {
          cookies: mgrK2Cookies,
        }),
      );
      expect(crossKitchenRes.status).toBe(403);

      // Cross-org invoice detail lookup -> 403
      const crossOrgDetailRes = await getInvoiceByIdHandler(
        makeJsonRequest(
          `http://localhost:3000/api/invoices/${org2Order.invoice!.id}`,
          { cookies: mgrK2Cookies },
        ),
        { params: { id: org2Order.invoice!.id } },
      );
      expect(crossOrgDetailRes.status).toBe(403);

      // K2 Manager Tally CSV export -> text/csv, SAC 996331, contains K2 invoice, NEVER K1 or ORG-002
      const tallyRes = await exportInvoicesHandler(
        makeJsonRequest(
          "http://localhost:3000/api/invoices/export?format=tally_csv",
          { cookies: mgrK2Cookies },
        ),
      );
      expect(tallyRes.status).toBe(200);
      expect(tallyRes.headers.get("content-type")).toContain("text/csv");
      expect(tallyRes.headers.get("content-disposition")).toContain("attachment");
      const tallyCsv = await tallyRes.text();
      expect(tallyCsv).toContain("Voucher Date,Voucher Type,Invoice Number");
      expect(tallyCsv).toContain("996331");
      expect(tallyCsv).toContain(k2Order.invoice!.invoiceNumber);
      expect(tallyCsv).not.toContain(org2Order.invoice!.invoiceNumber);
      expect(tallyCsv).not.toContain("/GGN-01/");

      // ORG-001 OWNER Zoho CSV & GSTR-1 JSON -> contains ORG-001 only, zero ORG-002 leakage
      const ownerCookies = await makeSessionCookie("OWNER-01", "OWNER", "Patric Revuelto");
      const zohoRes = await exportInvoicesHandler(
        makeJsonRequest(
          "http://localhost:3000/api/invoices/export?format=zoho_csv",
          { cookies: ownerCookies },
        ),
      );
      expect(zohoRes.status).toBe(200);
      const zohoCsv = await zohoRes.text();
      expect(zohoCsv).toContain("Invoice Date,Invoice Number,Customer Name");
      expect(zohoCsv).toContain("IGST5");
      expect(zohoCsv).not.toContain(org2Order.invoice!.invoiceNumber);

      const gstrRes = await exportInvoicesHandler(
        makeJsonRequest(
          "http://localhost:3000/api/invoices/export?format=gst_summary_json",
          { cookies: ownerCookies },
        ),
      );
      expect(gstrRes.status).toBe(200);
      const gstrJson = await gstrRes.json();
      expect(gstrJson.schema).toBe("GSTR1_SUMMARY_V1");
      expect(gstrJson.organizationId).toBe("ORG-001");
      expect(gstrJson.totals.netIgst).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Razorpay Webhook HMAC Verification & Idempotency Suite
  // ---------------------------------------------------------------------------
  describe("4. Razorpay Direct Web checkout, timingSafeEqual HMAC & webhook idempotency", () => {
    it("rejects invalid/missing signatures with 401 and captures idempotently on valid HMAC", async () => {
      const ownerCookies = await makeSessionCookie("OWNER-01", "OWNER", "Patric Revuelto");

      // Direct Web orders start as UNPAID
      const created = await injectCanonicalOrder({
        brandId: "BurgerForge",
        kitchenId: "K1",
        channel: "Direct Web",
        customerName: "Ananya Kapoor",
        items: [{ menuItemId: "MENU-BF-01", quantity: 2 }],
        actor: "OWNER-01",
      });
      expect(created.order.paymentStatus).toBe("UNPAID");
      expect(created.order.totalAmount).toBeGreaterThan(0);

      // Initiate Razorpay order -> sandbox order_sbx_... + paymentStatus PENDING
      const initRes = await createRazorpayOrderHandler(
        makeJsonRequest("http://localhost:3000/api/payments/razorpay/order", {
          method: "POST",
          cookies: ownerCookies,
          body: { orderId: created.order.id },
        }),
      );
      expect(initRes.status).toBe(201);
      const initBody = await initRes.json();
      expect(initBody.razorpayOrderId).toMatch(/^order_sbx_/);
      expect(initBody.mode).toBe("sandbox");

      const afterInit = await findOrder(created.order.id);
      expect(afterInit?.paymentStatus).toBe("PENDING");

      const webhookBody = JSON.stringify({
        event: "payment.captured",
        event_id: "evt_test_capture_001",
        payload: {
          payment: {
            entity: {
              id: "pay_sbx_test_001",
              order_id: initBody.razorpayOrderId,
              amount: Math.round((created.order.totalAmount ?? 0) * 100),
              currency: "INR",
              status: "captured",
              method: "upi",
              vpa: "ananya@okhdfcbank",
              notes: { orderId: created.order.id },
            },
          },
        },
      });

      // Missing signature -> 401
      const missingSigRes = await razorpayWebhookHandler(
        makeRawWebhookRequest(webhookBody),
      );
      expect(missingSigRes.status).toBe(401);

      // Invalid/tampered signature -> 401
      const badSigRes = await razorpayWebhookHandler(
        makeRawWebhookRequest(webhookBody, {
          "x-razorpay-signature": "deadbeef".repeat(8),
        }),
      );
      expect(badSigRes.status).toBe(401);
      expect((await findOrder(created.order.id))?.paymentStatus).toBe("PENDING");

      // Valid HMAC-SHA256 signature -> 200 & CAPTURED
      const validSig = computeRazorpayWebhookSignature(webhookBody);
      expect(
        verifyRazorpayWebhookSignature({
          rawBody: webhookBody,
          signature: validSig,
        }),
      ).toBe(true);

      const okRes = await razorpayWebhookHandler(
        makeRawWebhookRequest(webhookBody, {
          "x-razorpay-signature": validSig,
          "x-razorpay-event-id": "evt_test_capture_001",
        }),
      );
      expect(okRes.status).toBe(200);
      const okBody = await okRes.json();
      expect(okBody.received).toBe(true);
      expect(okBody.idempotentReplay).toBe(false);
      expect(okBody.paymentStatus).toBe("CAPTURED");

      // Duplicate webhook replay -> 200 idempotentReplay: true, zero duplicate rows/events
      const replayRes = await razorpayWebhookHandler(
        makeRawWebhookRequest(webhookBody, {
          "x-razorpay-signature": validSig,
          "x-razorpay-event-id": "evt_test_capture_001",
        }),
      );
      expect(replayRes.status).toBe(200);
      const replayBody = await replayRes.json();
      expect(replayBody.idempotentReplay).toBe(true);

      const capturedOrder = await findOrder(created.order.id);
      expect(capturedOrder?.paymentStatus).toBe("CAPTURED");
      expect(
        capturedOrder?.events.filter((e) => e.type === "PAYMENT_CAPTURED"),
      ).toHaveLength(1);
      const txs = await getPaymentTransactions({ orderId: created.order.id });
      expect(txs).toHaveLength(1);
      expect(txs[0].status).toBe("CAPTURED");
      expect(txs[0].providerPaymentId).toBe("pay_sbx_test_001");

      // Also verify checkout HMAC helper rejects malformed signature
      expect(
        verifyRazorpayCheckoutSignature({
          orderId: initBody.razorpayOrderId,
          paymentId: "pay_sbx_test_001",
          signature: "invalid",
        }),
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Automated Razorpay Refund & GST Credit Note on BEFORE_PREP Cancel
  // ---------------------------------------------------------------------------
  describe("5. Automated BEFORE_PREP refund & GST CREDIT_NOTE conversion", () => {
    it("auto-refunds captured Direct Web order and marks linked tax invoice as CREDIT_NOTE", async () => {
      const ownerCookies = await makeSessionCookie("OWNER-01", "OWNER", "Patric Revuelto");

      // 1. Create Direct Web order
      const created = await injectCanonicalOrder({
        brandId: "TacoMatrix",
        kitchenId: "K1",
        channel: "Direct Web",
        customerName: "Rohan Malhotra",
        items: [{ menuItemId: "MENU-TM-01", quantity: 1 }],
        actor: "OWNER-01",
      });

      // 2. Capture payment via server-side Sandbox UPI flow
      const capRes = await createRazorpayOrderHandler(
        makeJsonRequest("http://localhost:3000/api/payments/razorpay/order", {
          method: "POST",
          cookies: ownerCookies,
          body: {
            orderId: created.order.id,
            simulateSandboxCapture: true,
            method: "upi",
          },
        }),
      );
      expect(capRes.status).toBe(200);
      const capBody = await capRes.json();
      expect(capBody.order.paymentStatus).toBe("CAPTURED");

      // 3. Cancel while still PENDING (BEFORE_PREP)
      const cancelled = await cancelCanonicalOrder({
        orderId: created.order.id,
        actor: "OWNER-01 (Patric Revuelto)",
        cancellationSource: "CUSTOMER",
        cancellationReason: "Customer changed delivery address prior to kitchen prep",
      });

      expect(cancelled.order.status).toBe("CANCELLED");
      expect(cancelled.cancellationRecord?.stage).toBe("BEFORE_PREP");
      expect(cancelled.order.paymentStatus).toBe("REFUNDED");
      expect(cancelled.refundTransaction?.status).toBe("REFUNDED");
      expect(cancelled.refundTransaction?.providerRefundId).toMatch(/^rfnd_sbx_/);
      expect(cancelled.refundTransaction?.refundedAmount).toBe(
        created.order.totalAmount,
      );
      expect(cancelled.creditNoteInvoice?.status).toBe("CREDIT_NOTE");
      expect(cancelled.creditNoteInvoice?.voidedAt).toBeTruthy();
      expect(cancelled.creditNoteInvoice?.voidReason).toContain("delivery address");

      const persistedInvoice = await findTaxInvoiceByOrderId(created.order.id);
      expect(persistedInvoice?.status).toBe("CREDIT_NOTE");

      const persistedOrder = await findOrder(created.order.id);
      expect(
        persistedOrder?.events.some((e) => e.type === "PAYMENT_REFUNDED"),
      ).toBe(true);
      expect(
        persistedOrder?.events.some((e) => e.type === "INVOICE_CREDITED"),
      ).toBe(true);

      // Tally CSV reflects Credit Note voucher type
      const tallyRes = await exportInvoicesHandler(
        makeJsonRequest(
          "http://localhost:3000/api/invoices/export?format=tally_csv&kitchenId=K1",
          { cookies: ownerCookies },
        ),
      );
      const csv = await tallyRes.text();
      expect(csv).toContain(`Credit Note,${persistedInvoice!.invoiceNumber}`);
    });
  });
});
