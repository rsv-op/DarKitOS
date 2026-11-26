import { describe, expect, it } from "vitest";
import {
  BOTTLENECK_CATALOG,
  generateOwnerBottleneckBrief,
} from "@/lib/bottleneck-brief";

describe("lib/bottleneck-brief", () => {
  it("generates a dated Markdown brief with live INR telemetry and locked architecture guardrails", () => {
    const result = generateOwnerBottleneckBrief({
      ownerName: "Arvind Singhania",
      kitchenScope: "K1 — Gurugram Central Hub",
      selectedBottleneckIds: ["multi-kitchen-inventory", "gst-invoicing-upi"],
      dailyOrderVolume: "200–400 orders/day",
      monthlyRevenueBand: "₹15L – ₹35L / month",
      urgency: "THIS_MONTH",
      customNotes: "Dinner rush causes Brioche Buns stockouts on Swiggy.",
      generatedAtIso: "2026-11-25T10:30:00.000Z",
      telemetry: {
        grossRevenue: 124500,
        aov: 498,
        activeOrdersCount: 12,
        completedOrdersCount: 238,
        cancelledOrdersCount: 5,
        totalLoss: 1365,
        totalClaims: 798,
        totalLeakage: 57200,
        lowStockItems: ["Brioche Buns (18 units)"],
        activeBrandsCount: 4,
        onlineKitchensCount: 4,
        currency: "INR",
      },
    });

    expect(result.fileName).toBe("darkitos-owner-brief-2026-11-25.md");
    expect(result.selectedCount).toBe(2);
    expect(result.markdown).toContain("₹1,24,500");
    expect(result.markdown).toContain("₹57,200");
    expect(result.markdown).toContain("Per-Kitchen Inventory & Stock Transfers");
    expect(result.markdown).toContain("GST Invoices (CGST/SGST) & Direct UPI Checkout");
    expect(result.markdown).toContain("Dinner rush causes Brioche Buns stockouts on Swiggy.");
    expect(result.markdown).toContain("Supabase PostgreSQL (Mumbai `ap-south-1`) + Drizzle ORM");
    expect(result.markdown).toContain("UrbanPiper");
    expect(result.markdown).toContain("Razorpay");
    expect(BOTTLENECK_CATALOG.length).toBeGreaterThanOrEqual(6);
  });
});
