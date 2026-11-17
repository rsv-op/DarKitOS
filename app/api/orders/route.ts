import { NextRequest, NextResponse } from "next/server";
import {
  MENU_CATALOG,
  type CancellationSource,
  type DbaBrand,
  type OrderChannel,
  type OrderSource,
  type OrderStatus,
} from "@/lib/db";
import { getAuthenticatedEmployee } from "@/lib/domain/auth-service";
import { hasPermission } from "@/lib/domain/permission-service";
import {
  getMenuCatalog,
  getOrders,
  injectCanonicalOrder,
  transitionCanonicalOrder,
} from "@/lib/store";

export async function GET(request: NextRequest) {
  try {
    const employee =
      await getAuthenticatedEmployee(request);

    if (!employee) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = request.nextUrl;
    const statusFilter =
      searchParams.get("status") || "";
    const brandFilter =
      searchParams.get("brandId") || "";
    const kitchenFilter =
      searchParams.get("kitchenId") || "";
    const channelFilter =
      searchParams.get("channel") || "";
    const search = (
      searchParams.get("search") || ""
    )
      .trim()
      .toLowerCase();

    let orders = getOrders();

    if (
      statusFilter &&
      statusFilter !== "ALL"
    ) {
      orders = orders.filter(
        (o) => o.status === statusFilter,
      );
    }
    if (
      brandFilter &&
      brandFilter !== "ALL"
    ) {
      orders = orders.filter(
        (o) => o.brandId === brandFilter,
      );
    }
    if (
      kitchenFilter &&
      kitchenFilter !== "ALL"
    ) {
      orders = orders.filter(
        (o) => o.kitchenId === kitchenFilter,
      );
    }
    if (
      channelFilter &&
      channelFilter !== "ALL"
    ) {
      orders = orders.filter(
        (o) => o.channel === channelFilter,
      );
    }
    if (search) {
      orders = orders.filter(
        (o) =>
          o.id.toLowerCase().includes(search) ||
          (o.customerName || "")
            .toLowerCase()
            .includes(search) ||
          (o.externalOrderId || "")
            .toLowerCase()
            .includes(search) ||
          o.brandId
            .toLowerCase()
            .includes(search) ||
          o.items.some((item) =>
            item.name
              .toLowerCase()
              .includes(search),
          ),
      );
    }

    return NextResponse.json({
      orders,
      total: orders.length,
    });
  } catch (error) {
    console.error(
      "GET /api/orders failed:",
      error,
    );
    return NextResponse.json(
      { error: "Unable to load orders" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const employee =
      await getAuthenticatedEmployee(request);

    if (!employee) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (
      !hasPermission(employee, "ORDER_INJECT") &&
      !hasPermission(employee, "OWNER_VIEW") &&
      !hasPermission(
        employee,
        "KITCHEN_OPERATE",
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Insufficient permissions to inject orders",
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid order payload" },
        { status: 400 },
      );
    }

    const brandId = body.brandId as DbaBrand;
    const kitchenId = String(
      body.kitchenId || "",
    ).trim();
    const channel = (body.channel ||
      "Direct Web") as OrderChannel;

    if (!brandId || !kitchenId) {
      return NextResponse.json(
        {
          error:
            "Missing required brandId or kitchenId",
        },
        { status: 400 },
      );
    }

    const catalog =
      getMenuCatalog() ?? MENU_CATALOG;

    // Support both explicit items[] array and synthetic single-item fallback
    let items = Array.isArray(body.items)
      ? body.items
      : [];

    if (items.length === 0) {
      const defaultMenuItem = catalog.find(
        (m) => m.brandId === brandId,
      );
      if (defaultMenuItem) {
        items = [
          {
            menuItemId: defaultMenuItem.id,
            name: defaultMenuItem.name,
            quantity: Math.max(
              1,
              Number(body.itemCount) || 1,
            ),
            notes: body.notes,
          },
        ];
      }
    }

    const actorLabel = `${employee.employeeCode} (${employee.name})`;

    const result = injectCanonicalOrder({
      id:
        typeof body.id === "string"
          ? body.id
          : undefined,
      externalOrderId:
        typeof body.externalOrderId === "string"
          ? body.externalOrderId
          : undefined,
      idempotencyKey:
        typeof body.idempotencyKey === "string"
          ? body.idempotencyKey
          : undefined,
      brandId,
      kitchenId,
      channel,
      source: body.source as
        | OrderSource
        | undefined,
      priority: body.priority,
      customerName: body.customerName,
      notes: body.notes,
      items,
      actor: actorLabel,
    });

    return NextResponse.json(
      {
        success: true,
        order: result.order,
        idempotentReplay:
          result.idempotentReplay,
        inventoryDecision:
          result.inventoryDecision,
        inventoryWarnings:
          result.inventoryWarnings,
        inventoryUnavailable:
          result.inventoryUnavailable,
      },
      {
        status: result.idempotentReplay
          ? 200
          : 201,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create order";
    const isConflict =
      message.includes(
        "BrandKitchen violation",
      ) ||
      message.includes("Invalid or inactive");

    return NextResponse.json(
      { error: message },
      { status: isConflict ? 409 : 400 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
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
    const orderId = String(
      body?.orderId || body?.id || "",
    ).trim();
    const nextStatus = String(
      body?.action || body?.status || "",
    ).trim() as OrderStatus;

    if (!orderId || !nextStatus) {
      return NextResponse.json(
        {
          error:
            "Both orderId and action/status are required",
        },
        { status: 400 },
      );
    }

    // Enforce RBAC permissions per transition type
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
      orderId,
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
        : "Unable to update order";
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
