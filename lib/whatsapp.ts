import "server-only";
import crypto from "crypto";
import { formatCurrency } from "@/lib/currency";
import {
  DEFAULT_ORGANIZATION_ID,
  type WhatsAppLogStatus,
  type WhatsAppNotificationLog,
  type WhatsAppProvider,
  type WhatsAppTemplateName,
} from "@/lib/db";
import { roundCurrency2 } from "@/lib/gst";
import {
  findRecentWhatsAppLogByDedupeKey,
  getCancellations,
  getInventory,
  getKitchens,
  getOrders,
  getOrganizations,
  getTaxInvoices,
  insertWhatsAppLog,
  logOperationalActivity,
} from "@/lib/store";

export function getIstDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function resolveWhatsAppProvider(): WhatsAppProvider {
  const explicit = process.env.WHATSAPP_PROVIDER?.trim().toUpperCase();
  if (explicit === "INTERAKT" && process.env.INTERAKT_API_KEY?.trim()) {
    return "INTERAKT";
  }
  if (explicit === "GUPSHUP" && process.env.GUPSHUP_API_KEY?.trim()) {
    return "GUPSHUP";
  }
  if (explicit === "SANDBOX_WHATSAPP" || explicit === "SANDBOX") {
    return "SANDBOX_WHATSAPP";
  }
  if (process.env.INTERAKT_API_KEY?.trim()) {
    return "INTERAKT";
  }
  if (process.env.GUPSHUP_API_KEY?.trim()) {
    return "GUPSHUP";
  }
  return "SANDBOX_WHATSAPP";
}

function splitCountryAndPhone(phone: string): {
  countryCode: string;
  phoneNumber: string;
} {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("91") && digits.length === 12) {
    return { countryCode: "+91", phoneNumber: digits.slice(2) };
  }
  if (digits.length === 10) {
    return { countryCode: "+91", phoneNumber: digits };
  }
  return { countryCode: "+91", phoneNumber: digits || "9810000001" };
}

export interface SendWhatsAppTemplateInput {
  organizationId: string;
  kitchenId?: string;
  templateName: WhatsAppTemplateName;
  recipientPhone: string;
  dedupeKey: string;
  cooldownMinutes: number;
  payload: Record<string, unknown>;
  now?: Date;
}

export interface SendWhatsAppTemplateResult {
  skipped: boolean;
  reason?: "COOLDOWN_ACTIVE";
  log: WhatsAppNotificationLog;
}

export async function sendWhatsAppTemplate(
  input: SendWhatsAppTemplateInput,
): Promise<SendWhatsAppTemplateResult> {
  const nowDate = input.now ?? new Date();
  const nowMs = nowDate.getTime();
  const orgId = input.organizationId || DEFAULT_ORGANIZATION_ID;
  const provider = resolveWhatsAppProvider();

  if (input.cooldownMinutes > 0 && input.dedupeKey) {
    const sinceIso = new Date(
      nowMs - input.cooldownMinutes * 60_000,
    ).toISOString();
    const recent = await findRecentWhatsAppLogByDedupeKey(
      orgId,
      input.dedupeKey,
      sinceIso,
    );
    if (recent) {
      const skippedLog = await insertWhatsAppLog({
        organizationId: orgId,
        kitchenId: input.kitchenId,
        templateName: input.templateName,
        recipientPhone: input.recipientPhone,
        dedupeKey: input.dedupeKey,
        provider,
        status: "SKIPPED_COOLDOWN",
        payload: {
          ...input.payload,
          suppressedByLogId: recent.id,
          cooldownMinutes: input.cooldownMinutes,
        },
      });
      return {
        skipped: true,
        reason: "COOLDOWN_ACTIVE",
        log: skippedLog,
      };
    }
  }

  let status: WhatsAppLogStatus = "SANDBOX_LOGGED";
  let providerMessageId: string | undefined;
  let errorMessage: string | undefined;

  if (provider === "INTERAKT") {
    const apiKey = process.env.INTERAKT_API_KEY!.trim();
    const { countryCode, phoneNumber } = splitCountryAndPhone(
      input.recipientPhone,
    );
    try {
      const res = await fetch("https://api.interakt.ai/v1/public/message/", {
        method: "POST",
        headers: {
          Authorization: `Basic ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          countryCode,
          phoneNumber,
          type: "Template",
          template: {
            name: input.templateName.toLowerCase(),
            languageCode: "en",
            bodyValues: [
              String(input.payload.formattedSummary ?? JSON.stringify(input.payload)),
            ],
          },
        }),
      });
      if (!res.ok) {
        status = "FAILED";
        errorMessage = `Interakt HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
      } else {
        const body = (await res.json().catch(() => ({}))) as {
          id?: string;
          messageId?: string;
        };
        status = "SENT";
        providerMessageId = body.id || body.messageId || `wa_int_${Date.now()}`;
      }
    } catch (err) {
      status = "FAILED";
      errorMessage =
        err instanceof Error ? err.message : "Interakt network error";
    }
  } else if (provider === "GUPSHUP") {
    const apiKey = process.env.GUPSHUP_API_KEY!.trim();
    const source = process.env.GUPSHUP_SOURCE_NUMBER?.trim() || "917834811114";
    const appName = process.env.GUPSHUP_APP_NAME?.trim() || "DarKitOS";
    try {
      const form = new URLSearchParams({
        channel: "whatsapp",
        source,
        destination: input.recipientPhone.replace(/[^0-9]/g, ""),
        "src.name": appName,
        message: JSON.stringify({
          type: "text",
          text: String(
            input.payload.formattedSummary ??
              `${input.templateName}: ${JSON.stringify(input.payload)}`,
          ),
        }),
      });
      const res = await fetch("https://api.gupshup.io/wa/api/v1/msg", {
        method: "POST",
        headers: {
          apikey: apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      if (!res.ok) {
        status = "FAILED";
        errorMessage = `Gupshup HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
      } else {
        const body = (await res.json().catch(() => ({}))) as {
          messageId?: string;
        };
        status = "SENT";
        providerMessageId = body.messageId || `wa_gup_${Date.now()}`;
      }
    } catch (err) {
      status = "FAILED";
      errorMessage =
        err instanceof Error ? err.message : "Gupshup network error";
    }
  } else {
    const hash = crypto
      .createHash("sha256")
      .update(`${orgId}:${input.dedupeKey}:${nowMs}`)
      .digest("hex")
      .slice(0, 14);
    status = "SANDBOX_LOGGED";
    providerMessageId = `wa_sbx_${hash}`;
  }

  const log = await insertWhatsAppLog({
    organizationId: orgId,
    kitchenId: input.kitchenId,
    templateName: input.templateName,
    recipientPhone: input.recipientPhone,
    dedupeKey: input.dedupeKey,
    provider,
    providerMessageId,
    status,
    payload: input.payload,
    errorMessage,
  });

  return { skipped: false, log };
}

export async function triggerLowStockSupplierAlert(params: {
  organizationId: string;
  kitchenId: string;
  ingredientId: string;
  sku: string;
  itemName: string;
  currentStock: number;
  reorderThreshold: number;
  unit: string;
  actor: string;
  cooldownMinutes?: number;
}): Promise<SendWhatsAppTemplateResult> {
  const orgId = params.organizationId || DEFAULT_ORGANIZATION_ID;
  const dedupeKey = `low-stock:${orgId}:${params.kitchenId}:${params.ingredientId}`;
  const recipientPhone =
    process.env.SUPPLIER_WHATSAPP_PHONE?.trim() || "+919810000099";

  const formattedSummary = `LOW STOCK ALERT (${params.kitchenId}): ${params.itemName} [${params.sku}] is at ${params.currentStock} ${params.unit} (reorder threshold: ${params.reorderThreshold} ${params.unit}). Please arrange replenishment.`;

  const result = await sendWhatsAppTemplate({
    organizationId: orgId,
    kitchenId: params.kitchenId,
    templateName: "LOW_STOCK_SUPPLIER_ALERT",
    recipientPhone,
    dedupeKey,
    cooldownMinutes: params.cooldownMinutes ?? 360,
    payload: {
      kitchenId: params.kitchenId,
      ingredientId: params.ingredientId,
      sku: params.sku,
      itemName: params.itemName,
      currentStock: params.currentStock,
      reorderThreshold: params.reorderThreshold,
      unit: params.unit,
      formattedSummary,
    },
  });

  if (!result.skipped) {
    await logOperationalActivity({
      organizationId: orgId,
      type: "WHATSAPP_LOW_STOCK_ALERT",
      category: "WHATSAPP",
      title: `WhatsApp Low-Stock Alert (${params.sku})`,
      details: `${formattedSummary} [${result.log.status} • ${result.log.providerMessageId ?? result.log.id}]`,
      actor: params.actor,
      kitchenId: params.kitchenId,
      severity: "warning",
    });
  }

  return result;
}

export interface DailyInrDigestMetrics {
  organizationId: string;
  organizationName: string;
  istDate: string;
  totalOrders: number;
  grossInrSales: number;
  netInrSales: number;
  totalGstCollected: number;
  midPrepLossInr: number;
  postPickupClaimsInr: number;
  lowStockSkuCount: number;
  lowStockSkus: Array<{
    kitchenId: string;
    sku: string;
    name: string;
    currentStock: number;
    reorderThreshold: number;
    unit: string;
  }>;
  formattedSummary: string;
}

export interface DailyDigestOrgOutcome {
  organizationId: string;
  istDate: string;
  skipped: boolean;
  reason?: "COOLDOWN_ACTIVE";
  metrics: DailyInrDigestMetrics;
  log: WhatsAppNotificationLog;
}

export async function runDailyOwnerInrDigest(options?: {
  organizationId?: string;
  istDate?: string;
  now?: Date;
  force?: boolean;
  actor?: string;
}): Promise<{
  istDate: string;
  results: DailyDigestOrgOutcome[];
}> {
  const nowDate = options?.now ?? new Date();
  const istDate = options?.istDate ?? getIstDateKey(nowDate);
  const todayIst = getIstDateKey(nowDate);

  const [organizations, kitchens, allOrders, allInvoices, allCancellations, allInventory] =
    await Promise.all([
      getOrganizations(),
      getKitchens(),
      getOrders(),
      getTaxInvoices(),
      getCancellations(),
      getInventory(),
    ]);

  const targetOrgs = options?.organizationId
    ? organizations.filter((o) => o.id === options.organizationId)
    : organizations;

  const recipientPhone =
    process.env.OWNER_WHATSAPP_PHONE?.trim() || "+919810000001";

  const results: DailyDigestOrgOutcome[] = [];

  for (const org of targetOrgs) {
    const orgKitchenIds = new Set(
      kitchens
        .filter((k) => (k.organizationId ?? DEFAULT_ORGANIZATION_ID) === org.id)
        .map((k) => k.id),
    );

    const orgOrdersAll = allOrders.filter(
      (o) =>
        (o.organizationId ?? DEFAULT_ORGANIZATION_ID) === org.id ||
        orgKitchenIds.has(o.kitchenId),
    );

    let matchedOrders = orgOrdersAll.filter(
      (o) => getIstDateKey(new Date(o.createdAt)) === istDate,
    );

    // Midnight IST rollover fallback when running for today's live date
    if (matchedOrders.length === 0 && istDate === todayIst) {
      const last24hMs = nowDate.getTime() - 24 * 60 * 60_000;
      matchedOrders = orgOrdersAll.filter(
        (o) => new Date(o.createdAt).getTime() >= last24hMs,
      );
    }

    const matchedOrderIds = new Set(matchedOrders.map((o) => o.id));

    const grossInrSales = roundCurrency2(
      matchedOrders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0),
    );
    const netInrSales = roundCurrency2(
      matchedOrders
        .filter((o) => o.status !== "CANCELLED")
        .reduce((sum, o) => sum + (o.totalAmount ?? 0), 0),
    );

    const matchedInvoices = allInvoices.filter(
      (inv) =>
        inv.organizationId === org.id &&
        inv.status === "ISSUED" &&
        (matchedOrderIds.has(inv.orderId) ||
          getIstDateKey(new Date(inv.issuedAt)) === istDate),
    );
    const totalGstCollected = roundCurrency2(
      matchedInvoices.reduce((sum, inv) => sum + inv.totalTax, 0),
    );

    const matchedCancels = allCancellations.filter(
      (c) =>
        orgKitchenIds.has(c.kitchenId) &&
        (matchedOrderIds.has(c.orderId) ||
          getIstDateKey(new Date(c.timestamp)) === istDate),
    );
    const midPrepLossInr = roundCurrency2(
      matchedCancels
        .filter((c) => c.stage === "DURING_OR_AFTER_PREP")
        .reduce((sum, c) => sum + c.financialLoss, 0),
    );
    const postPickupClaimsInr = roundCurrency2(
      matchedCancels
        .filter((c) => c.stage === "AFTER_PICKUP")
        .reduce((sum, c) => sum + c.claimAmount, 0),
    );

    const lowStockSkus = allInventory
      .filter(
        (item) =>
          item.kitchenId &&
          orgKitchenIds.has(item.kitchenId) &&
          item.currentStock <= item.reorderThreshold,
      )
      .map((item) => ({
        kitchenId: item.kitchenId!,
        sku: item.sku,
        name: item.name,
        currentStock: item.currentStock,
        reorderThreshold: item.reorderThreshold,
        unit: item.unit,
      }));

    const formattedSummary = `DarKitOS Daily INR Digest (${org.name} • ${istDate} IST): ${matchedOrders.length} orders | Gross ${formatCurrency(grossInrSales, "INR")} | Net ${formatCurrency(netInrSales, "INR")} | GST ${formatCurrency(totalGstCollected, "INR")} | Mid-Prep Loss ${formatCurrency(midPrepLossInr, "INR")} | Claims ${formatCurrency(postPickupClaimsInr, "INR")} | Low-Stock SKUs: ${lowStockSkus.length}.`;

    const metrics: DailyInrDigestMetrics = {
      organizationId: org.id,
      organizationName: org.name,
      istDate,
      totalOrders: matchedOrders.length,
      grossInrSales,
      netInrSales,
      totalGstCollected,
      midPrepLossInr,
      postPickupClaimsInr,
      lowStockSkuCount: lowStockSkus.length,
      lowStockSkus,
      formattedSummary,
    };

    const dedupeKey = `daily-digest:${org.id}:${istDate}`;
    const sendResult = await sendWhatsAppTemplate({
      organizationId: org.id,
      templateName: "DAILY_OWNER_INR_DIGEST",
      recipientPhone,
      dedupeKey,
      cooldownMinutes: options?.force ? 0 : 1200,
      payload: metrics as unknown as Record<string, unknown>,
      now: nowDate,
    });

    if (!sendResult.skipped) {
      await logOperationalActivity({
        organizationId: org.id,
        type: "WHATSAPP_DAILY_DIGEST",
        category: "WHATSAPP",
        title: `Daily INR Digest Dispatched (${istDate} IST)`,
        details: `${formattedSummary} [${sendResult.log.status}]`,
        actor: options?.actor ?? "DAILY_DIGEST_WORKER",
        severity: "success",
      });
    }

    results.push({
      organizationId: org.id,
      istDate,
      skipped: sendResult.skipped,
      reason: sendResult.reason,
      metrics,
      log: sendResult.log,
    });
  }

  return { istDate, results };
}
