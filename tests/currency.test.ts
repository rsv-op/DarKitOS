import { describe, expect, it } from "vitest";
import {
  DEFAULT_CURRENCY,
  formatCurrency,
  formatINR,
  getCurrencySymbol,
} from "@/lib/currency";

describe("lib/currency", () => {
  it("defaults to INR", () => {
    expect(DEFAULT_CURRENCY).toBe("INR");
    expect(getCurrencySymbol("INR")).toBe("₹");
    expect(getCurrencySymbol("USD")).toBe("$");
    expect(getCurrencySymbol("EUR")).toBe("€");
  });

  it("formats Indian Rupee amounts with en-IN lakh/crore grouping", () => {
    expect(formatINR(349)).toBe("₹349");
    expect(formatINR(124500)).toBe("₹1,24,500");
    expect(formatINR(1250000)).toBe("₹12,50,000");
    expect(formatINR(887.5)).toBe("₹887.50");
    expect(formatINR(0)).toBe("₹0");
  });

  it("supports USD and EUR formatting when currency setting changes", () => {
    expect(formatCurrency(1250.5, "USD")).toBe("$1,250.50");
    expect(formatCurrency(99.9, "EUR")).toContain("99.90");
    expect(formatCurrency(99.9, "EUR")).toContain("€");
  });

  it("handles non-finite values safely without throwing", () => {
    expect(formatCurrency(Number.NaN, "INR")).toBe("₹0");
    expect(formatCurrency(Number.POSITIVE_INFINITY, "INR")).toBe("₹0");
  });
});
