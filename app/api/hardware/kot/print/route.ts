import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedEmployee } from "@/lib/domain/auth-service";
import {
  canAccessOrder,
  hasPermission,
} from "@/lib/domain/permission-service";
import {
  buildKotTicketData,
  renderEscPosTextPayload,
} from "@/lib/kot-format";
import { dispatchKotPrintJob } from "@/lib/kot-printer";
import {
  findOrder,
  getBrands,
  getKitchens,
  recordActivity,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedEmployee(request);
  if (!auth.ok) return auth.response;
  const employee = auth.employee;

  if (
    !hasPermission(employee, "KITCHEN_OPERATE") &&
    !hasPermission(employee, "OWNER_VIEW")
  ) {
    return NextResponse.json(
      { error: "Forbidden: KITCHEN_OPERATE or OWNER_VIEW permission required." },
      { status: 403 },
    );
  }

  let body: { orderId?: unknown };
  try {
    body = (await request.json()) as { orderId?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const orderId = String(body?.orderId ?? "").trim();
  if (!orderId) {
    return NextResponse.json(
      { error: "orderId is required to print an 80mm KOT ticket." },
      { status: 400 },
    );
  }

  const [order, kitchens, brands] = await Promise.all([
    findOrder(orderId),
    getKitchens(),
    getBrands(),
  ]);

  if (!order) {
    return NextResponse.json(
      { error: `Order not found: ${orderId}` },
      { status: 404 },
    );
  }

  if (!canAccessOrder(employee, order, kitchens)) {
    return NextResponse.json(
      {
        error: `Forbidden: You do not have access to print KOT tickets for kitchen ${order.kitchenId}.`,
      },
      { status: 403 },
    );
  }

  const kitchen = kitchens.find((k) => k.id === order.kitchenId) ?? null;
  const brand = brands.find((b) => b.id === order.brandId) ?? null;

  const ticket = buildKotTicketData({ order, kitchen, brand });
  const escPosPayload = renderEscPosTextPayload(ticket);

  try {
    const dispatchResult = await dispatchKotPrintJob({
      ticket,
      escPosPayload,
      actor: employee.name,
    });

    await recordActivity({
      organizationId: employee.organizationId,
      type: "KOT_PRINTED",
      category: "HARDWARE",
      title: "80mm KOT Printed",
      details: `Printed 80mm thermal KOT for ${order.id} (${ticket.brandName} @ ${ticket.kitchenCode}) via ${dispatchResult.mode} [${dispatchResult.printJobId}].`,
      actor: employee.name,
      orderId: order.id,
      kitchenId: order.kitchenId,
      brandId: order.brandId,
      severity: "info",
    });

    return NextResponse.json({
      ok: true,
      printJobId: dispatchResult.printJobId,
      mode: dispatchResult.mode,
      signed: dispatchResult.signed,
      ticket,
      escPosPayload,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to dispatch 80mm KOT print job.",
      },
      { status: 502 },
    );
  }
}
