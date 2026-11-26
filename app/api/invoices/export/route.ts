import { NextRequest, NextResponse } from "next/server";
import type { TaxInvoice, TaxInvoiceStatus } from "@/lib/db";

export const dynamic = "force-dynamic";
import { requireAuthenticatedEmployee } from "@/lib/domain/auth-service";
import {
  canAccessOrganization,
  getAccessibleKitchenIds,
  hasGlobalScope,
  hasPermission,
} from "@/lib/domain/permission-service";
import {
  DEFAULT_SAC_RESTAURANT_SERVICE,
  getIndianStateName,
  roundCurrency2,
} from "@/lib/gst";
import { getKitchens, getOrders, getTaxInvoices } from "@/lib/store";

function escapeCsvCell(raw: string | number | null | undefined): string {
  const str = raw === null || raw === undefined ? "" : String(raw);
  // Neutralize spreadsheet CSV formula injection
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function formatIsoDate(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function buildTallyCsv(invoices: TaxInvoice[]): string {
  const headers = [
    "Voucher Date",
    "Voucher Type",
    "Invoice Number",
    "Party Name",
    "Party GSTIN",
    "Seller GSTIN",
    "Place of Supply",
    "SAC Code",
    "Taxable Value",
    "CGST Rate",
    "CGST Amount",
    "SGST Rate",
    "SGST Amount",
    "IGST Rate",
    "IGST Amount",
    "Total Tax",
    "Invoice Total",
    "Status",
  ];

  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const inv of invoices) {
    const voucherType = inv.status === "CREDIT_NOTE" ? "Credit Note" : "Sales";
    const placeOfSupply = `${inv.placeOfSupplyStateCode}-${getIndianStateName(inv.placeOfSupplyStateCode)}`;
    lines.push(
      [
        formatIsoDate(inv.issuedAt),
        voucherType,
        inv.invoiceNumber,
        inv.customerName || "Walk-In / Aggregator Guest",
        inv.customerGstin || "",
        inv.sellerGstin,
        placeOfSupply,
        DEFAULT_SAC_RESTAURANT_SERVICE,
        inv.taxableSubtotal.toFixed(2),
        inv.cgstRate.toFixed(2),
        inv.cgstAmount.toFixed(2),
        inv.sgstRate.toFixed(2),
        inv.sgstAmount.toFixed(2),
        inv.igstRate.toFixed(2),
        inv.igstAmount.toFixed(2),
        inv.totalTax.toFixed(2),
        inv.grandTotal.toFixed(2),
        inv.status,
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

function buildZohoCsv(
  invoices: TaxInvoice[],
  orderMap: Map<string, { brandId: string; channel: string }>,
): string {
  const headers = [
    "Invoice Date",
    "Invoice Number",
    "Customer Name",
    "Customer GSTIN",
    "Place of Supply",
    "Item Name",
    "SAC/HSN",
    "Item Price",
    "Tax Name",
    "Tax Percentage",
    "CGST Amount",
    "SGST Amount",
    "IGST Amount",
    "SubTotal",
    "Total",
    "Status",
  ];

  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const inv of invoices) {
    const ord = orderMap.get(inv.orderId);
    const isInterState = inv.igstRate > 0;
    const taxRate = isInterState
      ? inv.igstRate
      : roundCurrency2(inv.cgstRate + inv.sgstRate);
    const taxName = isInterState
      ? `IGST${taxRate}`
      : `GST${taxRate}`;
    const itemName = ord
      ? `${ord.brandId} Cloud Kitchen Meal (${ord.channel})`
      : `Cloud Kitchen Restaurant Supply (${inv.orderId})`;
    const placeOfSupply = `${inv.placeOfSupplyStateCode}-${getIndianStateName(inv.placeOfSupplyStateCode)}`;

    lines.push(
      [
        formatIsoDate(inv.issuedAt),
        inv.invoiceNumber,
        inv.customerName || "Walk-In / Aggregator Guest",
        inv.customerGstin || "",
        placeOfSupply,
        itemName,
        DEFAULT_SAC_RESTAURANT_SERVICE,
        inv.taxableSubtotal.toFixed(2),
        taxName,
        taxRate.toFixed(2),
        inv.cgstAmount.toFixed(2),
        inv.sgstAmount.toFixed(2),
        inv.igstAmount.toFixed(2),
        inv.taxableSubtotal.toFixed(2),
        inv.grandTotal.toFixed(2),
        inv.status,
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedEmployee(request);
    if (!auth.ok) return auth.response;
    const employee = auth.employee;

    if (!hasPermission(employee, "OWNER_VIEW")) {
      return NextResponse.json(
        { error: "Forbidden: Accounting exports require OWNER or MANAGER role" },
        { status: 403 },
      );
    }

    const { searchParams } = request.nextUrl;
    const format = (searchParams.get("format") || "tally_csv").trim().toLowerCase();
    const requestedKitchenId = (searchParams.get("kitchenId") || "").trim();
    const financialYear = (searchParams.get("financialYear") || "").trim();
    const statusParam = (searchParams.get("status") || "").trim() as
      | TaxInvoiceStatus
      | "";
    const from = (searchParams.get("from") || "").trim() || undefined;
    const to = (searchParams.get("to") || "").trim() || undefined;

    if (
      format !== "tally_csv" &&
      format !== "zoho_csv" &&
      format !== "gst_summary_json"
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported export format. Use tally_csv, zoho_csv, or gst_summary_json.",
        },
        { status: 400 },
      );
    }

    const [kitchens, orders, allInvoices] = await Promise.all([
      getKitchens(),
      getOrders(),
      getTaxInvoices({
        organizationId: employee.organizationId,
        financialYear: financialYear || undefined,
        status:
          statusParam === "ISSUED" ||
          statusParam === "VOIDED" ||
          statusParam === "CREDIT_NOTE"
            ? statusParam
            : undefined,
        from,
        to,
      }),
    ]);

    const accessibleKitchens = getAccessibleKitchenIds(employee, kitchens);

    if (requestedKitchenId && requestedKitchenId !== "ALL") {
      const targetKitchen = kitchens.find((k) => k.id === requestedKitchenId);
      if (
        targetKitchen &&
        !canAccessOrganization(employee, targetKitchen.organizationId)
      ) {
        return NextResponse.json(
          {
            error: `Forbidden: Kitchen ${requestedKitchenId} belongs to another organization`,
          },
          { status: 403 },
        );
      }
      if (!accessibleKitchens.has(requestedKitchenId)) {
        return NextResponse.json(
          {
            error: `Forbidden: Employee ${employee.employeeCode} cannot export invoices for kitchen ${requestedKitchenId}`,
          },
          { status: 403 },
        );
      }
    }

    let scoped = allInvoices.filter(
      (inv) =>
        canAccessOrganization(employee, inv.organizationId) &&
        accessibleKitchens.has(inv.kitchenId),
    );

    if (
      hasGlobalScope(employee) &&
      requestedKitchenId &&
      requestedKitchenId !== "ALL"
    ) {
      scoped = scoped.filter((inv) => inv.kitchenId === requestedKitchenId);
    }

    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "tally_csv") {
      const csv = buildTallyCsv(scoped);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="darkitos-tally-gst-${stamp}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format === "zoho_csv") {
      const orderMap = new Map(
        orders.map((o) => [o.id, { brandId: o.brandId, channel: o.channel }]),
      );
      const csv = buildZohoCsv(scoped, orderMap);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="darkitos-zoho-books-gst-${stamp}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // GSTR-1 style JSON summary
    const byStateMap = new Map<
      string,
      {
        placeOfSupplyStateCode: string;
        stateName: string;
        invoiceCount: number;
        creditNoteCount: number;
        netTaxableValue: number;
        netCgst: number;
        netSgst: number;
        netIgst: number;
        netTax: number;
        netGrandTotal: number;
      }
    >();

    const totals = {
      issuedCount: 0,
      creditNoteCount: 0,
      voidedCount: 0,
      grossTaxableValue: 0,
      creditNoteTaxableValue: 0,
      netTaxableValue: 0,
      netCgst: 0,
      netSgst: 0,
      netIgst: 0,
      netTax: 0,
      netGrandTotal: 0,
    };

    for (const inv of scoped) {
      const stateKey = inv.placeOfSupplyStateCode;
      const entry = byStateMap.get(stateKey) ?? {
        placeOfSupplyStateCode: stateKey,
        stateName: getIndianStateName(stateKey),
        invoiceCount: 0,
        creditNoteCount: 0,
        netTaxableValue: 0,
        netCgst: 0,
        netSgst: 0,
        netIgst: 0,
        netTax: 0,
        netGrandTotal: 0,
      };

      if (inv.status === "ISSUED") {
        totals.issuedCount += 1;
        totals.grossTaxableValue = roundCurrency2(
          totals.grossTaxableValue + inv.taxableSubtotal,
        );
        totals.netTaxableValue = roundCurrency2(
          totals.netTaxableValue + inv.taxableSubtotal,
        );
        totals.netCgst = roundCurrency2(totals.netCgst + inv.cgstAmount);
        totals.netSgst = roundCurrency2(totals.netSgst + inv.sgstAmount);
        totals.netIgst = roundCurrency2(totals.netIgst + inv.igstAmount);
        totals.netTax = roundCurrency2(totals.netTax + inv.totalTax);
        totals.netGrandTotal = roundCurrency2(
          totals.netGrandTotal + inv.grandTotal,
        );

        entry.invoiceCount += 1;
        entry.netTaxableValue = roundCurrency2(
          entry.netTaxableValue + inv.taxableSubtotal,
        );
        entry.netCgst = roundCurrency2(entry.netCgst + inv.cgstAmount);
        entry.netSgst = roundCurrency2(entry.netSgst + inv.sgstAmount);
        entry.netIgst = roundCurrency2(entry.netIgst + inv.igstAmount);
        entry.netTax = roundCurrency2(entry.netTax + inv.totalTax);
        entry.netGrandTotal = roundCurrency2(
          entry.netGrandTotal + inv.grandTotal,
        );
      } else if (inv.status === "CREDIT_NOTE") {
        totals.creditNoteCount += 1;
        totals.creditNoteTaxableValue = roundCurrency2(
          totals.creditNoteTaxableValue + inv.taxableSubtotal,
        );
        entry.creditNoteCount += 1;
      } else {
        totals.voidedCount += 1;
      }

      byStateMap.set(stateKey, entry);
    }

    return NextResponse.json({
      schema: "GSTR1_SUMMARY_V1",
      generatedAt: new Date().toISOString(),
      organizationId: employee.organizationId,
      sacCode: DEFAULT_SAC_RESTAURANT_SERVICE,
      filters: {
        kitchenId: requestedKitchenId || "ALL",
        financialYear: financialYear || "ALL",
        from: from ?? null,
        to: to ?? null,
      },
      totals,
      byPlaceOfSupply: Array.from(byStateMap.values()),
      invoiceCount: scoped.length,
    });
  } catch (error) {
    console.error("GET /api/invoices/export failed:", error);
    return NextResponse.json(
      { error: "Unable to export GST accounting ledger" },
      { status: 500 },
    );
  }
}
