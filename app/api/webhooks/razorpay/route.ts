import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";

export const dynamic = "force-dynamic";
import { recordRazorpayPaymentCapture } from "@/lib/store";

interface RazorpayWebhookPayload {
  event?: string;
  event_id?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
        method?: string;
        vpa?: string;
        notes?: Record<string, string>;
      };
    };
    order?: {
      entity?: {
        id?: string;
        receipt?: string;
        amount?: number;
        notes?: Record<string, string>;
      };
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    // 1. Read raw body text BEFORE JSON parsing for exact HMAC verification
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!verifyRazorpayWebhookSignature({ rawBody, signature })) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing Razorpay webhook signature" },
        { status: 401 },
      );
    }

    let parsed: RazorpayWebhookPayload;
    try {
      parsed = JSON.parse(rawBody) as RazorpayWebhookPayload;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON webhook payload" },
        { status: 400 },
      );
    }

    const eventType = String(parsed.event || "").trim();
    const paymentEntity = parsed.payload?.payment?.entity;
    const orderEntity = parsed.payload?.order?.entity;

    if (eventType !== "payment.captured" && eventType !== "order.paid") {
      return NextResponse.json({
        received: true,
        ignored: true,
        event: eventType || "unknown",
      });
    }

    const providerPaymentId = String(paymentEntity?.id || "").trim();
    const providerOrderId = String(
      paymentEntity?.order_id || orderEntity?.id || "",
    ).trim();
    const orderId = String(
      paymentEntity?.notes?.orderId ||
        orderEntity?.notes?.orderId ||
        orderEntity?.receipt ||
        "",
    ).trim();
    const webhookEventId =
      request.headers.get("x-razorpay-event-id")?.trim() ||
      parsed.event_id?.trim() ||
      (providerPaymentId ? `evt_${eventType}_${providerPaymentId}` : undefined);

    if (!providerPaymentId) {
      return NextResponse.json(
        { error: "Missing payment.entity.id in Razorpay webhook payload" },
        { status: 400 },
      );
    }

    const amountPaise =
      typeof paymentEntity?.amount === "number"
        ? paymentEntity.amount
        : typeof orderEntity?.amount === "number"
          ? orderEntity.amount
          : undefined;
    const amountInr =
      typeof amountPaise === "number" && amountPaise > 0
        ? Math.round(amountPaise) / 100
        : undefined;

    const capture = await recordRazorpayPaymentCapture({
      webhookEventId,
      providerOrderId: providerOrderId || undefined,
      providerPaymentId,
      orderId: orderId || undefined,
      amount: amountInr,
      method: paymentEntity?.method || "upi",
      actor: "RAZORPAY_WEBHOOK",
      rawMeta: {
        event: eventType,
        vpa: paymentEntity?.vpa,
        currency: paymentEntity?.currency ?? "INR",
      },
    });

    return NextResponse.json({
      received: true,
      event: eventType,
      idempotentReplay: capture.idempotentReplay,
      orderId: capture.order.id,
      paymentStatus: capture.order.paymentStatus,
      transactionId: capture.transaction.id,
      providerPaymentId: capture.transaction.providerPaymentId,
    });
  } catch (error) {
    console.error("POST /api/webhooks/razorpay failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process Razorpay webhook",
      },
      { status: 400 },
    );
  }
}
