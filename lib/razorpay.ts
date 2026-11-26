import "server-only";
import crypto from "crypto";

const SANDBOX_KEY_ID = "rzp_test_darkitos_sandbox";
const SANDBOX_KEY_SECRET = "rzp_secret_darkitos_sandbox_dev_only";
const SANDBOX_WEBHOOK_SECRET = "whsec_darkitos_sandbox_dev_only";

export class RazorpayPaymentError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "RazorpayPaymentError";
    this.statusCode = statusCode;
  }
}

export function isRazorpayLiveConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() &&
      process.env.RAZORPAY_KEY_SECRET?.trim(),
  );
}

export function isRazorpaySandboxAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.DEMO_SANDBOX_MODE === "true"
  );
}

export function getRazorpayPublicKeyId(): string | null {
  const configured = process.env.RAZORPAY_KEY_ID?.trim();
  if (configured) return configured;
  return isRazorpaySandboxAllowed() ? SANDBOX_KEY_ID : null;
}

function resolveKeySecret(override?: string): string | null {
  if (override?.trim()) return override.trim();
  const configured = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (configured) return configured;
  return isRazorpaySandboxAllowed() ? SANDBOX_KEY_SECRET : null;
}

export function resolveRazorpayWebhookSecret(override?: string): string | null {
  if (override?.trim()) return override.trim();
  const configured = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (configured) return configured;
  return isRazorpaySandboxAllowed() ? SANDBOX_WEBHOOK_SECRET : null;
}

function timingSafeHexEqual(expectedHex: string, actualHex: string): boolean {
  const normalizedActual = actualHex.trim().toLowerCase();
  const normalizedExpected = expectedHex.trim().toLowerCase();
  if (
    !normalizedActual ||
    normalizedActual.length !== normalizedExpected.length ||
    !/^[0-9a-f]+$/.test(normalizedActual)
  ) {
    return false;
  }
  const expectedBuf = Buffer.from(normalizedExpected, "hex");
  const actualBuf = Buffer.from(normalizedActual, "hex");
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export interface CreateRazorpayOrderInput {
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreateRazorpayOrderResult {
  providerOrderId: string;
  amountInr: number;
  amountPaise: number;
  currency: "INR";
  receipt: string;
  status: string;
  mode: "live" | "sandbox";
  keyId: string;
}

export async function createRazorpayOrder(
  input: CreateRazorpayOrderInput,
): Promise<CreateRazorpayOrderResult> {
  const amountInr = Math.round((Number(input.amountInr) || 0) * 100) / 100;
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    throw new RazorpayPaymentError(
      "Razorpay order amount must be greater than ₹0",
      400,
    );
  }
  const amountPaise = Math.round(amountInr * 100);
  const receipt = input.receipt.slice(0, 40);

  if (isRazorpayLiveConfigured()) {
    const keyId = process.env.RAZORPAY_KEY_ID!.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET!.trim();
    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt,
        notes: input.notes ?? {},
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new RazorpayPaymentError(
        `Razorpay order creation failed (${res.status}): ${errorText.slice(0, 200)}`,
        res.status >= 400 && res.status < 500 ? res.status : 502,
      );
    }

    const payload = (await res.json()) as {
      id: string;
      amount: number;
      currency: string;
      receipt: string;
      status: string;
    };

    return {
      providerOrderId: payload.id,
      amountInr,
      amountPaise: payload.amount ?? amountPaise,
      currency: "INR",
      receipt: payload.receipt ?? receipt,
      status: payload.status ?? "created",
      mode: "live",
      keyId,
    };
  }

  if (!isRazorpaySandboxAllowed()) {
    throw new RazorpayPaymentError(
      "Razorpay payment credentials are not configured for production.",
      503,
    );
  }

  const hash = crypto
    .createHash("sha256")
    .update(`${receipt}:${amountPaise}:${Date.now()}:${crypto.randomBytes(4).toString("hex")}`)
    .digest("hex")
    .slice(0, 14);

  return {
    providerOrderId: `order_sbx_${hash}`,
    amountInr,
    amountPaise,
    currency: "INR",
    receipt,
    status: "created",
    mode: "sandbox",
    keyId: SANDBOX_KEY_ID,
  };
}

export function verifyRazorpayCheckoutSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret?: string;
}): boolean {
  const secret = resolveKeySecret(params.secret);
  if (!secret || !params.orderId || !params.paymentId || !params.signature) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");
  return timingSafeHexEqual(expected, params.signature);
}

export function verifyRazorpayWebhookSignature(params: {
  rawBody: string;
  signature: string | null | undefined;
  secret?: string;
}): boolean {
  const secret = resolveRazorpayWebhookSecret(params.secret);
  if (!secret || !params.rawBody || !params.signature) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(params.rawBody, "utf8")
    .digest("hex");
  return timingSafeHexEqual(expected, params.signature);
}

export function computeRazorpayWebhookSignature(
  rawBody: string,
  secret?: string,
): string {
  const resolved = resolveRazorpayWebhookSecret(secret);
  if (!resolved) {
    throw new RazorpayPaymentError(
      "Razorpay webhook secret is not configured.",
      503,
    );
  }
  return crypto
    .createHmac("sha256", resolved)
    .update(rawBody, "utf8")
    .digest("hex");
}

export interface RefundRazorpayPaymentInput {
  paymentId: string;
  amountInr: number;
  notes?: Record<string, string>;
}

export interface RefundRazorpayPaymentResult {
  providerRefundId: string;
  paymentId: string;
  amountInr: number;
  amountPaise: number;
  status: string;
  mode: "live" | "sandbox";
}

export async function refundRazorpayPayment(
  input: RefundRazorpayPaymentInput,
): Promise<RefundRazorpayPaymentResult> {
  const amountInr = Math.round((Number(input.amountInr) || 0) * 100) / 100;
  const amountPaise = Math.round(amountInr * 100);
  if (!input.paymentId || amountPaise <= 0) {
    throw new RazorpayPaymentError(
      "Valid paymentId and positive refund amount are required.",
      400,
    );
  }

  const isSandboxPayment = input.paymentId.startsWith("pay_sbx_");

  if (isRazorpayLiveConfigured() && !isSandboxPayment) {
    const keyId = process.env.RAZORPAY_KEY_ID!.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET!.trim();
    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const res = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountPaise,
          speed: "normal",
          notes: input.notes ?? {},
        }),
      },
    );

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new RazorpayPaymentError(
        `Razorpay refund failed (${res.status}): ${errorText.slice(0, 200)}`,
        res.status >= 400 && res.status < 500 ? res.status : 502,
      );
    }

    const payload = (await res.json()) as {
      id: string;
      status: string;
      amount: number;
    };

    return {
      providerRefundId: payload.id,
      paymentId: input.paymentId,
      amountInr,
      amountPaise: payload.amount ?? amountPaise,
      status: payload.status ?? "processed",
      mode: "live",
    };
  }

  if (!isRazorpaySandboxAllowed() && !isSandboxPayment) {
    throw new RazorpayPaymentError(
      "Razorpay refund credentials are not configured for production.",
      503,
    );
  }

  const hash = crypto
    .createHash("sha256")
    .update(`${input.paymentId}:${amountPaise}`)
    .digest("hex")
    .slice(0, 14);

  return {
    providerRefundId: `rfnd_sbx_${hash}`,
    paymentId: input.paymentId,
    amountInr,
    amountPaise,
    status: "processed",
    mode: "sandbox",
  };
}
