import { NextRequest, NextResponse } from "next/server";
import type { CancellationSource } from "@/lib/db";
import { requireAuthenticatedEmployee } from "@/lib/domain/auth-service";
import { executeAuthorizedOrderTransition } from "@/lib/domain/order-transitions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireAuthenticatedEmployee(request);
    if (!auth.ok) return auth.response;
    const employee = auth.employee;

    const body = await request.json();
    const outcome = await executeAuthorizedOrderTransition({
      employee,
      orderId: params.id,
      nextStatusRaw: String(body?.status || body?.action || ""),
      driverName:
        typeof body?.driverName === "string" ? body.driverName : undefined,
      courierEtaMins:
        typeof body?.courierEtaMins === "number"
          ? body.courierEtaMins
          : undefined,
      cancellationSource: body?.cancellationSource as
        | CancellationSource
        | undefined,
      cancellationReason:
        typeof body?.cancellationReason === "string"
          ? body.cancellationReason
          : undefined,
      restoreInventoryOnPrePrepCancel:
        typeof body?.restoreInventoryOnPrePrepCancel === "boolean"
          ? body.restoreInventoryOnPrePrepCancel
          : undefined,
    });

    if (!outcome.ok) {
      return NextResponse.json(
        { error: outcome.error },
        { status: outcome.status },
      );
    }

    return NextResponse.json({
      success: true,
      order: outcome.result.order,
      idempotentReplay: outcome.result.idempotentReplay,
      depletedItems: outcome.result.depletedItems,
      lowStockAlerts: outcome.result.lowStockAlerts,
      cancellationRecord: outcome.result.cancellationRecord,
      creditNoteInvoice: outcome.result.creditNoteInvoice,
      refundTransaction: outcome.result.refundTransaction,
    });
  } catch (error) {
    console.error("PATCH /api/orders/[id]/status failed:", error);
    return NextResponse.json(
      { error: "Unable to update order status" },
      { status: 400 },
    );
  }
}
