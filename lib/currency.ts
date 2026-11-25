export type CurrencyCode = "INR" | "USD" | "EUR";
export type SupportedCurrency = CurrencyCode;

export const DEFAULT_CURRENCY: CurrencyCode = "INR";

const CURRENCY_LOCALES: Record<CurrencyCode, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "en-IE",
};

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
};

export function getCurrencySymbol(
  currency: CurrencyCode = DEFAULT_CURRENCY,
): string {
  return CURRENCY_SYMBOLS[currency] ?? "₹";
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  options?: { decimals?: number },
): string {
  const safe =
    typeof amount === "number" && Number.isFinite(amount)
      ? amount
      : 0;
  const resolvedCurrency: CurrencyCode =
    currency in CURRENCY_LOCALES ? currency : DEFAULT_CURRENCY;

  const hasFraction = Math.abs(safe - Math.trunc(safe)) > 0.0001;
  const decimals =
    typeof options?.decimals === "number"
      ? options.decimals
      : hasFraction
        ? 2
        : 0;

  return new Intl.NumberFormat(
    CURRENCY_LOCALES[resolvedCurrency],
    {
      style: "currency",
      currency: resolvedCurrency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    },
  ).format(safe);
}

export function formatINR(
  amount: number,
  decimals?: number,
): string {
  return formatCurrency(amount, "INR", { decimals });
}
