import { NextRequest, NextResponse } from "next/server";
import type {
  CancellationSource,
  OrderStatus,
} from "@/lib/db";
import { getAuthenticatedEmployee } from "@/lib/domain/auth-service";
import { hasPermission } from "@/lib/domain/permission-service";
import { transitionCanonicalOrder } from "@/lib/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const employee =
      await getAuthenticatedEmployee(request);

    if (!employee) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const nextStatus = String(
      body?.status || body?.action || "",
    ).trim() as OrderStatus;

    if (!nextStatus) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 },
      );
    }

    if (
      nextStatus === "PREPARING" ||
      nextStatus === "READY_FOR_PICKUP"
    ) {
      if (
        !hasPermission(
          employee,
          "COOK_ORDERS",
        ) &&
        !hasPermission(
          employee,
          "OWNER_VIEW",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Forbidden: Requires COOK_ORDERS permission",
          },
          { status: 403 },
        );
      }
    } else if (
      nextStatus === "DRIVER_ASSIGNED" ||
      nextStatus === "PICKED_UP" ||
      nextStatus === "DISPATCHED"
    ) {
      if (
        !hasPermission(
          employee,
          "DISPATCH_ORDERS",
        ) &&
        !hasPermission(
          employee,
          "OWNER_VIEW",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Forbidden: Requires DISPATCH_ORDERS permission",
          },
          { status: 403 },
        );
      }
    } else if (nextStatus === "CANCELLED") {
      if (
        !hasPermission(
          employee,
          "ORDER_CANCEL",
        ) &&
        !hasPermission(
          employee,
          "OWNER_VIEW",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Forbidden: Requires ORDER_CANCEL permission",
          },
          { status: 403 },
        );
      }
    }

    const actorLabel = `${employee.employeeCode} (${employee.name})`;

    const result = transitionCanonicalOrder({
      orderId: params.id,
      nextStatus,
      actor: actorLabel,
      driverName: body?.driverName,
      courierEtaMins:
        typeof body?.courierEtaMins === "number"
          ? body.courierEtaMins
          : undefined,
      cancellationSource:
        body?.cancellationSource as
          | CancellationSource
          | undefined,
      cancellationReason:
        body?.cancellationReason,
      restoreInventoryOnPrePrepCancel:
        body?.restoreInventoryOnPrePrepCancel,
    });

    return NextResponse.json({
      success: true,
      order: result.order,
      idempotentReplay:
        result.idempotentReplay,
      depletedItems: result.depletedItems,
      lowStockAlerts: result.lowStockAlerts,
      cancellationRecord:
        result.cancellationRecord,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update order status";
    const status = message.includes(
      "Order not found",
    )
      ? 404
      : message.includes(
            "Invalid status transition",
          ) ||
          message.includes(
            "Insufficient inventory",
          )
        ? 409
        : 400;

    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
