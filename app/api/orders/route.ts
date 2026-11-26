import { NextRequest, NextResponse } from "next/server";
import {
  MENU_CATALOG,
  type CancellationSource,
  type DbaBrand,
  type OrderChannel,
  type OrderSource,
} from "@/lib/db";
import { requireAuthenticatedEmployee } from "@/lib/domain/auth-service";
import { executeAuthorizedOrderTransition } from "@/lib/domain/order-transitions";
import {
  canAccessKitchen,
  canAccessOrganization,
  getAccessibleKitchenIds,
  hasGlobalScope,
  hasPermission,
} from "@/lib/domain/permission-service";
import {
  getKitchens,
  getMenuCatalog,
  getOrders,
  injectCanonicalOrder,
} from "@/lib/store";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedEmployee(request);
    if (!auth.ok) return auth.response;
    const employee = auth.employee;

    const { searchParams } = request.nextUrl;
    const statusFilter = searchParams.get("status") || "";
    const brandFilter = searchParams.get("brandId") || "";
    const requestedKitchenFilter = (
      searchParams.get("kitchenId") || ""
    ).trim();
    const channelFilter = searchParams.get("channel") || "";
    const search = (searchParams.get("search") || "").trim().toLowerCase();

    const [allOrders, kitchens] = await Promise.all([
      getOrders(),
      getKitchens(),
    ]);

    // Level 1 (Organization) cross-org explicit kitchen probe -> 403 Forbidden
    if (requestedKitchenFilter && requestedKitchenFilter !== "ALL") {
      const targetKitchen = kitchens.find(
        (k) => k.id === requestedKitchenFilter,
      );
      if (
        targetKitchen &&
        !canAccessOrganization(employee, targetKitchen.organizationId)
      ) {
        return NextResponse.json(
          {
            error: `Forbidden: Kitchen ${requestedKitchenFilter} belongs to another organization`,
          },
          { status: 403 },
        );
      }
    }

    const accessibleKitchens = getAccessibleKitchenIds(employee, kitchens);

    // Enforce two-level tenant + kitchen isolation on every read
    let orders = allOrders.filter(
      (o) =>
        canAccessOrganization(employee, o.organizationId) &&
        accessibleKitchens.has(o.kitchenId),
    );

    if (
      hasGlobalScope(employee) &&
      requestedKitchenFilter &&
      requestedKitchenFilter !== "ALL"
    ) {
      orders = orders.filter((o) => o.kitchenId === requestedKitchenFilter);
    }

    if (statusFilter && statusFilter !== "ALL") {
      orders = orders.filter((o) => o.status === statusFilter);
    }
    if (brandFilter && brandFilter !== "ALL") {
      orders = orders.filter((o) => o.brandId === brandFilter);
    }
    if (channelFilter && channelFilter !== "ALL") {
      orders = orders.filter((o) => o.channel === channelFilter);
    }
    if (search) {
      orders = orders.filter(
        (o) =>
          o.id.toLowerCase().includes(search) ||
          (o.customerName || "").toLowerCase().includes(search) ||
          (o.externalOrderId || "").toLowerCase().includes(search) ||
          o.brandId.toLowerCase().includes(search) ||
          o.items.some((item) => item.name.toLowerCase().includes(search)),
      );
    }

    return NextResponse.json({
      orders,
      total: orders.length,
    });
  } catch (error) {
    console.error("GET /api/orders failed:", error);
    return NextResponse.json(
      { error: "Unable to load orders" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedEmployee(request);
    if (!auth.ok) return auth.response;
    const employee = auth.employee;

    // Strict RBAC: Only ORDER_INJECT or OWNER_VIEW may inject orders (KITCHEN_OPERATE is NOT sufficient)
    if (
      !hasPermission(employee, "ORDER_INJECT") &&
      !hasPermission(employee, "OWNER_VIEW")
    ) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Requires ORDER_INJECT or OWNER_VIEW permission",
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
    const kitchenId = String(body.kitchenId || "").trim();
    const channel = (body.channel || "Direct Web") as OrderChannel;

    if (!brandId || !kitchenId) {
      return NextResponse.json(
        { error: "Missing required brandId or kitchenId" },
        { status: 400 },
      );
    }

    const kitchens = await getKitchens();
    if (!canAccessKitchen(employee, kitchenId, kitchens)) {
      return NextResponse.json(
        {
          error: `Forbidden: Employee ${employee.employeeCode} cannot inject orders into kitchen ${kitchenId}`,
        },
        { status: 403 },
      );
    }

    const catalog = (await getMenuCatalog()) ?? MENU_CATALOG;

    // Support both explicit items[] array and synthetic single-item fallback
    let items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      const defaultMenuItem = catalog.find((m) => m.brandId === brandId);
      if (defaultMenuItem) {
        items = [
          {
            menuItemId: defaultMenuItem.id,
            name: defaultMenuItem.name,
            quantity: Math.max(1, Number(body.itemCount) || 1),
            notes: body.notes,
          },
        ];
      }
    }

    const actorLabel = `${employee.employeeCode} (${employee.name})`;

    const result = await injectCanonicalOrder({
      id: typeof body.id === "string" ? body.id : undefined,
      organizationId: employee.organizationId,
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
      source: body.source as OrderSource | undefined,
      priority: body.priority,
      customerName: body.customerName,
      customerGstin:
        typeof body.customerGstin === "string" ? body.customerGstin : undefined,
      placeOfSupplyStateCode:
        typeof body.placeOfSupplyStateCode === "string"
          ? body.placeOfSupplyStateCode
          : undefined,
      packagingFee:
        typeof body.packagingFee === "number" ? body.packagingFee : undefined,
      notes: body.notes,
      items,
      actor: actorLabel,
    });

    return NextResponse.json(
      {
        success: true,
        order: result.order,
        invoice: result.invoice,
        idempotentReplay: result.idempotentReplay,
        inventoryDecision: result.inventoryDecision,
        inventoryWarnings: result.inventoryWarnings,
        inventoryUnavailable: result.inventoryUnavailable,
      },
      {
        status: result.idempotentReplay ? 200 : 201,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create order";
    const isConflict =
      message.includes("BrandKitchen violation") ||
      message.includes("Invalid or inactive") ||
      message.includes("already exists");

    return NextResponse.json(
      { error: message },
      { status: isConflict ? 409 : 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedEmployee(request);
    if (!auth.ok) return auth.response;
    const employee = auth.employee;

    const body = await request.json();
    const outcome = await executeAuthorizedOrderTransition({
      employee,
      orderId: String(body?.orderId || body?.id || ""),
      nextStatusRaw: String(body?.action || body?.status || ""),
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
    console.error("PATCH /api/orders failed:", error);
    return NextResponse.json(
      { error: "Unable to update order" },
      { status: 400 },
    );
  }
}
