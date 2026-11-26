import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedEmployee } from "@/lib/domain/auth-service";

export const dynamic = "force-dynamic";
import {
  canAccessKitchen,
  canAccessOrganization,
  hasPermission,
} from "@/lib/domain/permission-service";
import {
  findOrder,
  findTaxInvoiceById,
  findTaxInvoiceByOrderId,
  getKitchens,
  getOrganizations,
  getPaymentTransactions,
} from "@/lib/store";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireAuthenticatedEmployee(request);
    if (!auth.ok) return auth.response;
    const employee = auth.employee;

    if (!hasPermission(employee, "OWNER_VIEW")) {
      return NextResponse.json(
        { error: "Forbidden: GST invoice details require OWNER or MANAGER role" },
        { status: 403 },
      );
    }

    const rawId = decodeURIComponent(params.id || "").trim();
    if (!rawId) {
      return NextResponse.json({ error: "Invoice ID is required" }, { status: 400 });
    }

    const invoice =
      (await findTaxInvoiceById(rawId)) ?? (await findTaxInvoiceByOrderId(rawId));

    if (!invoice) {
      return NextResponse.json(
        { error: `Tax invoice not found: ${rawId}` },
        { status: 404 },
      );
    }

    const kitchens = await getKitchens();
    if (
      !canAccessOrganization(employee, invoice.organizationId) ||
      !canAccessKitchen(employee, invoice.kitchenId, kitchens)
    ) {
      return NextResponse.json(
        {
          error: `Forbidden: Employee ${employee.employeeCode} cannot access invoice ${invoice.invoiceNumber}`,
        },
        { status: 403 },
      );
    }

    const [order, organizations, paymentTransactions] = await Promise.all([
      findOrder(invoice.orderId),
      getOrganizations(),
      getPaymentTransactions({ orderId: invoice.orderId }),
    ]);

    const kitchen = kitchens.find((k) => k.id === invoice.kitchenId);
    const organization = organizations.find(
      (o) => o.id === invoice.organizationId,
    );

    return NextResponse.json({
      invoice,
      order: order ?? null,
      kitchen: kitchen ?? null,
      organization: organization ?? null,
      paymentTransactions,
    });
  } catch (error) {
    console.error("GET /api/invoices/[id] failed:", error);
    return NextResponse.json(
      { error: "Unable to load tax invoice details" },
      { status: 500 },
    );
  }
}
