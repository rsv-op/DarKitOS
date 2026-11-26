import { NextRequest, NextResponse } from "next/server";
import type { TaxInvoiceStatus } from "@/lib/db";

export const dynamic = "force-dynamic";
import { requireAuthenticatedEmployee } from "@/lib/domain/auth-service";
import {
  canAccessOrganization,
  getAccessibleKitchenIds,
  hasGlobalScope,
  hasPermission,
} from "@/lib/domain/permission-service";
import { roundCurrency2 } from "@/lib/gst";
import { getKitchens, getOrders, getTaxInvoices } from "@/lib/store";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedEmployee(request);
    if (!auth.ok) return auth.response;
    const employee = auth.employee;

    if (!hasPermission(employee, "OWNER_VIEW")) {
      return NextResponse.json(
        { error: "Forbidden: GST invoice ledger requires OWNER or MANAGER role" },
        { status: 403 },
      );
    }

    const { searchParams } = request.nextUrl;
    const requestedKitchenId = (searchParams.get("kitchenId") || "").trim();
    const financialYear = (searchParams.get("financialYear") || "").trim();
    const statusParam = (searchParams.get("status") || "").trim() as
      | TaxInvoiceStatus
      | "";
    const from = (searchParams.get("from") || "").trim() || undefined;
    const to = (searchParams.get("to") || "").trim() || undefined;

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
            error: `Forbidden: Employee ${employee.employeeCode} cannot access invoices for kitchen ${requestedKitchenId}`,
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

    const kitchenMap = new Map(kitchens.map((k) => [k.id, k]));
    const orderMap = new Map(orders.map((o) => [o.id, o]));

    const invoices = scoped.map((inv) => {
      const kitchen = kitchenMap.get(inv.kitchenId);
      const order = orderMap.get(inv.orderId);
      return {
        ...inv,
        kitchenName: kitchen?.name ?? inv.kitchenId,
        kitchenCode: kitchen?.code ?? inv.kitchenId,
        brandId: order?.brandId,
        channel: order?.channel,
        orderStatus: order?.status,
        paymentStatus: order?.paymentStatus ?? "AGGREGATOR_SETTLED",
      };
    });

    const summary = scoped.reduce(
      (acc, inv) => {
        const sign = inv.status === "ISSUED" ? 1 : 0;
        acc.totalCount += 1;
        if (inv.status === "ISSUED") acc.issuedCount += 1;
        if (inv.status === "CREDIT_NOTE") acc.creditNoteCount += 1;
        if (inv.status === "VOIDED") acc.voidedCount += 1;
        acc.taxableSubtotal = roundCurrency2(
          acc.taxableSubtotal + inv.taxableSubtotal * sign,
        );
        acc.cgstTotal = roundCurrency2(acc.cgstTotal + inv.cgstAmount * sign);
        acc.sgstTotal = roundCurrency2(acc.sgstTotal + inv.sgstAmount * sign);
        acc.igstTotal = roundCurrency2(acc.igstTotal + inv.igstAmount * sign);
        acc.totalTax = roundCurrency2(acc.totalTax + inv.totalTax * sign);
        acc.grandTotal = roundCurrency2(acc.grandTotal + inv.grandTotal * sign);
        return acc;
      },
      {
        totalCount: 0,
        issuedCount: 0,
        creditNoteCount: 0,
        voidedCount: 0,
        taxableSubtotal: 0,
        cgstTotal: 0,
        sgstTotal: 0,
        igstTotal: 0,
        totalTax: 0,
        grandTotal: 0,
      },
    );

    return NextResponse.json({
      invoices,
      summary,
      total: invoices.length,
    });
  } catch (error) {
    console.error("GET /api/invoices failed:", error);
    return NextResponse.json(
      { error: "Unable to load GST tax invoices" },
      { status: 500 },
    );
  }
}
