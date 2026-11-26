/**
 * Client-safe Indian GST & Financial Year Calculation Engine.
 * Strictly zero server-only, crypto, Drizzle, or database imports.
 */

export const DEFAULT_GST_RATE_PCT = 5;
export const DEFAULT_SAC_RESTAURANT_SERVICE = "996331";

export const INDIAN_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "19": "West Bengal",
  "24": "Gujarat",
  "27": "Maharashtra",
  "29": "Karnataka",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "36": "Telangana",
};

export function roundCurrency2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeStateCode(code?: string | null, fallback = "06"): string {
  const cleaned = (code ?? "").replace(/\D/g, "").trim();
  if (!cleaned) return fallback.padStart(2, "0").slice(0, 2);
  return cleaned.padStart(2, "0").slice(0, 2);
}

export function getIndianStateName(stateCode?: string | null): string {
  const normalized = normalizeStateCode(stateCode, "06");
  return INDIAN_STATE_CODES[normalized] ?? `State ${normalized}`;
}

/**
 * Computes the Indian Financial Year (April 1 – March 31) in `FYxx-yy` format.
 * Examples:
 *  - 2026-11-26 -> "FY26-27"
 *  - 2027-02-15 -> "FY26-27"
 *  - 2027-03-31 -> "FY26-27"
 *  - 2027-04-01 -> "FY27-28"
 */
export function getIndianFinancialYear(dateInput: Date | string = new Date()): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;
  const year = safeDate.getUTCFullYear();
  const month = safeDate.getUTCMonth() + 1; // 1..12
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return `FY${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

export interface IndianGstInput {
  itemsSubtotal: number;
  packagingFee?: number;
  sellerStateCode: string;
  placeOfSupplyStateCode?: string;
  gstRatePct?: number;
}

export interface IndianGstBreakup {
  itemsSubtotal: number;
  packagingFee: number;
  taxableSubtotal: number;
  sellerStateCode: string;
  placeOfSupplyStateCode: string;
  isInterState: boolean;
  gstRatePct: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  grandTotal: number;
}

/**
 * Calculates Indian GST breakup (paise-rounded to 2 decimals):
 * - Intra-state (sellerStateCode === placeOfSupplyStateCode): 50/50 CGST + SGST (e.g., 2.5% + 2.5%), 0% IGST
 * - Inter-state (sellerStateCode !== placeOfSupplyStateCode): full IGST (e.g., 5%), 0% CGST, 0% SGST
 */
export function calculateIndianGstBreakup(
  input: IndianGstInput,
): IndianGstBreakup {
  const gstRatePct =
    typeof input.gstRatePct === "number" &&
    Number.isFinite(input.gstRatePct) &&
    input.gstRatePct >= 0
      ? roundCurrency2(input.gstRatePct)
      : DEFAULT_GST_RATE_PCT;

  const itemsSubtotal = roundCurrency2(Math.max(0, Number(input.itemsSubtotal) || 0));
  const packagingFee = roundCurrency2(Math.max(0, Number(input.packagingFee) || 0));
  const taxableSubtotal = roundCurrency2(itemsSubtotal + packagingFee);

  const sellerStateCode = normalizeStateCode(input.sellerStateCode, "06");
  const placeOfSupplyStateCode = normalizeStateCode(
    input.placeOfSupplyStateCode || sellerStateCode,
    sellerStateCode,
  );
  const isInterState = sellerStateCode !== placeOfSupplyStateCode;

  if (isInterState) {
    const igstRate = gstRatePct;
    const igstAmount = roundCurrency2((taxableSubtotal * igstRate) / 100);
    const totalTax = igstAmount;
    const grandTotal = roundCurrency2(taxableSubtotal + totalTax);
    return {
      itemsSubtotal,
      packagingFee,
      taxableSubtotal,
      sellerStateCode,
      placeOfSupplyStateCode,
      isInterState: true,
      gstRatePct,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate,
      igstAmount,
      totalTax,
      grandTotal,
    };
  }

  const cgstRate = roundCurrency2(gstRatePct / 2);
  const sgstRate = roundCurrency2(gstRatePct - cgstRate);
  const cgstAmount = roundCurrency2((taxableSubtotal * cgstRate) / 100);
  const sgstAmount = roundCurrency2((taxableSubtotal * sgstRate) / 100);
  const totalTax = roundCurrency2(cgstAmount + sgstAmount);
  const grandTotal = roundCurrency2(taxableSubtotal + totalTax);

  return {
    itemsSubtotal,
    packagingFee,
    taxableSubtotal,
    sellerStateCode,
    placeOfSupplyStateCode,
    isInterState: false,
    gstRatePct,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate: 0,
    igstAmount: 0,
    totalTax,
    grandTotal,
  };
}

/**
 * Formats an Indian GST sequential tax invoice number.
 * Example: formatTaxInvoiceNumber({ financialYear: "FY26-27", kitchenCode: "GGN", sequenceNumber: 1 })
 *          -> "FY26-27/GGN/0001"
 */
export function formatTaxInvoiceNumber(params: {
  financialYear: string;
  kitchenCode: string;
  sequenceNumber: number;
}): string {
  const fy = params.financialYear.trim() || getIndianFinancialYear();
  const cleanCode =
    params.kitchenCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "") || "HUB";
  const seq = String(Math.max(1, Math.floor(params.sequenceNumber))).padStart(
    4,
    "0",
  );
  return `${fy}/${cleanCode}/${seq}`;
}
