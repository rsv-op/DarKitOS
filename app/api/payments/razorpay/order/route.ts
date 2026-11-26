import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/db";
import { requireAuthenticatedEmployee } from "@/lib/domain/auth-service";
import {
  canAccessKitchen,
  canAccessOrganization,
  hasPermission,
} from "@/lib/domain/permission-service";
import {
  RazorpayPaymentError,
  computeRazorpayWebhookSignature,
  createRazorpayOrder,
  isRazorpaySandboxAllowed,
  verifyRazorpayWebhookSignature,
} from "@/lib/razorpay";
import {
  createPaymentIntentRecord,
  findOrder,
  getKitchens,
  getPaymentTransactions,
  recordRazorpayPaymentCapture,
} from "@/lib/store";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedEmployee(request);
    if (!auth.ok) return auth.response;
    const employee = auth.employee;

    if (
      !hasPermission(employee, "ORDER_INJECT") &&
      !hasPermission(employee, "OWNER_VIEW")
    ) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Payment order creation requires ORDER_INJECT or OWNER_VIEW permission",
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const orderId = String(body?.orderId || "").trim();
    const simulateSandboxCapture = Boolean(body?.simulateSandboxCapture);
    const method =
      typeof body?.method === "string" && body.method.trim()
        ? body.method.trim().toLowerCase()
        : "upi";

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 },
      );
    }

    const [order, kitchens] = await Promise.all([
      findOrder(orderId),
      getKitchens(),
    ]);

    if (!order) {
      return NextResponse.json(
        { error: `Order not found: ${orderId}` },
        { status: 404 },
      );
    }

    if (
      !canAccessOrganization(employee, order.organizationId) ||
      !canAccessKitchen(employee, order.kitchenId, kitchens)
    ) {
      return NextResponse.json(
        {
          error: `Forbidden: Employee ${employee.employeeCode} cannot initiate payment for order ${orderId}`,
        },
        { status: 403 },
      );
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cannot create payment intent for a cancelled order" },
        { status: 409 },
      );
    }

    if (order.paymentStatus === "CAPTURED") {
      const existingTxs = await getPaymentTransactions({ orderId: order.id });
      return NextResponse.json({
        success: true,
        alreadyCaptured: true,
        order,
        transaction: existingTxs[0] ?? null,
      });
    }

    const amountInr = Number(order.totalAmount ?? 0);
    if (!Number.isFinite(amountInr) || amountInr <= 0) {
      return NextResponse.json(
        { error: "Order totalAmount must be greater than ₹0" },
        { status: 400 },
      );
    }

    const orgId =
      order.organizationId ??
      employee.organizationId ??
      DEFAULT_ORGANIZATION_ID;

    const existingTxs = await getPaymentTransactions({ orderId: order.id });
    let pendingTx = existingTxs.find(
      (t) => t.status === "CREATED" && Boolean(t.providerOrderId),
    );
    let razorpayOrderId = pendingTx?.providerOrderId ?? "";
    let keyId = "rzp_test_darkitos_sandbox";
    let mode: "live" | "sandbox" = "sandbox";

    if (!pendingTx) {
      const rzpOrder = await createRazorpayOrder({
        amountInr,
        receipt: order.id,
        notes: {
          organizationId: orgId,
          kitchenId: order.kitchenId,
          orderId: order.id,
          brandId: order.brandId,
        },
      });
      razorpayOrderId = rzpOrder.providerOrderId;
      keyId = rzpOrder.keyId;
      mode = rzpOrder.mode;

      const recorded = await createPaymentIntentRecord({
        organizationId: orgId,
        kitchenId: order.kitchenId,
        orderId: order.id,
        provider: "RAZORPAY",
        providerOrderId: rzpOrder.providerOrderId,
        amount: rzpOrder.amountInr,
        currency: rzpOrder.currency,
        method,
        rawMeta: {
          mode: rzpOrder.mode,
          receipt: rzpOrder.receipt,
          initiatedBy: `${employee.employeeCode} (${employee.name})`,
        },
      });
      pendingTx = recorded.transaction;
    }

    if (simulateSandboxCapture) {
      if (!isRazorpaySandboxAllowed()) {
        return NextResponse.json(
          {
            error:
              "Forbidden: Sandbox UPI capture simulation is disabled in strict production mode.",
          },
          { status: 403 },
        );
      }

      const suffix = crypto.randomBytes(6).toString("hex");
      const paymentId = `pay_sbx_${suffix}`;
      const webhookEventId = `evt_sbx_${suffix}`;
      const syntheticPayload = JSON.stringify({
        event: "payment.captured",
        event_id: webhookEventId,
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: razorpayOrderId,
              amount: Math.round(amountInr * 100),
              currency: "INR",
              status: "captured",
              method,
              vpa: "customer@okaxis",
              notes: { orderId: order.id },
            },
          },
        },
      });
      const sig = computeRazorpayWebhookSignature(syntheticPayload);
      const valid = verifyRazorpayWebhookSignature({
        rawBody: syntheticPayload,
        signature: sig,
      });
      if (!valid) {
        return NextResponse.json(
          { error: "Sandbox webhook HMAC verification failed" },
          { status: 500 },
        );
      }

      const captured = await recordRazorpayPaymentCapture({
        webhookEventId,
        providerOrderId: razorpayOrderId,
        providerPaymentId: paymentId,
        orderId: order.id,
        amount: amountInr,
        method,
        actor: `${employee.employeeCode} (Sandbox UPI)`,
        rawMeta: { sandboxSimulated: true, verifiedHmac: true },
      });

      return NextResponse.json({
        success: true,
        mode: "sandbox",
        simulatedCapture: true,
        keyId,
        razorpayOrderId,
        order: captured.order,
        transaction: captured.transaction,
      });
    }

    return NextResponse.json(
      {
        success: true,
        mode,
        keyId,
        razorpayOrderId,
        amountInr,
        amountPaise: Math.round(amountInr * 100),
        currency: "INR",
        transaction: pendingTx,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof RazorpayPaymentError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    console.error("POST /api/payments/razorpay/order failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Razorpay payment order",
      },
      { status: 500 },
    );
  }
}
