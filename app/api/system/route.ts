import { NextRequest, NextResponse } from "next/server";
import {
  isDemoSandboxEnabled,
  sanitizeEmployee,
} from "@/lib/auth";
import {
  PERMISSIONS_DB,
  ROLE_PERMISSIONS_DB,
  type DbaBrand,
} from "@/lib/db";
import { getAuthenticatedEmployee } from "@/lib/domain/auth-service";
import {
  canAccessKitchen,
  getRolePermissions,
  hasGlobalScope,
  hasPermission,
} from "@/lib/domain/permission-service";
import {
  clearOrdersStore,
  deleteVirtualFile,
  getStoreSnapshot,
  resetStore,
  toggleBrandKitchenMapping,
  toggleKitchenActive,
  updateLeakageVectorStatus,
  updateMenuCatalogItem,
  updateSystemSettings,
  upsertCanonicalEmployee,
  upsertVirtualFile,
} from "@/lib/store";

export async function GET(request: NextRequest) {
  try {
    const employee = await getAuthenticatedEmployee(request);

    if (!employee) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const snapshot = getStoreSnapshot();
    const isGlobal = hasGlobalScope(employee);
    const isOwnerView = hasPermission(employee, "OWNER_VIEW");
    const safeSelf = sanitizeEmployee(employee);

    const scopedOrders = isGlobal
      ? snapshot.orders
      : snapshot.orders.filter(
          (o) => o.kitchenId === employee.kitchenId,
        );

    const scopedCancellations = isGlobal
      ? snapshot.cancellations
      : snapshot.cancellations.filter(
          (c) => c.kitchenId === employee.kitchenId,
        );

    const scopedMovements = isGlobal
      ? snapshot.inventoryMovements
      : snapshot.inventoryMovements.filter(
          (m) => m.kitchenId === employee.kitchenId,
        );

    const scopedActivities = isGlobal
      ? snapshot.activities
      : snapshot.activities.filter(
          (a) => !a.kitchenId || a.kitchenId === employee.kitchenId,
        );

    const scopedFiles = isGlobal
      ? snapshot.files
      : snapshot.files.filter(
          (f) =>
            !f.kitchenId ||
            f.kitchenId === "GLOBAL" ||
            f.kitchenId === employee.kitchenId,
        );

    const scopedEmployees = !isOwnerView
      ? [safeSelf]
      : isGlobal
        ? snapshot.employees.map(sanitizeEmployee)
        : snapshot.employees
            .filter((e) => e.kitchenId === employee.kitchenId)
            .map(sanitizeEmployee);

    const scopedWebhooks = !isOwnerView
      ? []
      : isGlobal
        ? snapshot.webhookEvents
        : snapshot.webhookEvents.filter(
            (w) => w.kitchenId === employee.kitchenId,
          );

    return NextResponse.json({
      ...snapshot,
      orders: scopedOrders,
      cancellations: scopedCancellations,
      inventoryMovements: scopedMovements,
      activities: scopedActivities,
      files: scopedFiles,
      employees: scopedEmployees,
      webhookEvents: scopedWebhooks,
      outboxEvents: isOwnerView ? snapshot.outboxEvents : [],
      leakageVectors: isOwnerView ? snapshot.leakageVectors : [],
      currentEmployee: safeSelf,
      currentPermissions: getRolePermissions(employee.role),
      permissionsCatalog: PERMISSIONS_DB,
      rolePermissionsCatalog: ROLE_PERMISSIONS_DB,
      demoSandboxEnabled: isDemoSandboxEnabled(),
    });
  } catch (error) {
    console.error("GET /api/system failed:", error);
    return NextResponse.json(
      { error: "Unable to load system state" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const employee = await getAuthenticatedEmployee(request);

    if (!employee) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 },
      );
    }

    const action = String(body?.action || "").trim();
    const actor = `${employee.employeeCode} (${employee.name})`;

    switch (action) {
      case "TOGGLE_BRAND_KITCHEN": {
        if (!hasPermission(employee, "OWNER_VIEW")) {
          return NextResponse.json(
            { error: "Forbidden: Requires OWNER_VIEW" },
            { status: 403 },
          );
        }
        const kitchenId = String(body.kitchenId || "").trim();
        if (!kitchenId || !body.brandId) {
          return NextResponse.json(
            { error: "brandId and kitchenId are required" },
            { status: 400 },
          );
        }
        if (!canAccessKitchen(employee, kitchenId)) {
          return NextResponse.json(
            {
              error: `Forbidden: Cannot alter BrandKitchen matrix for kitchen ${kitchenId}`,
            },
            { status: 403 },
          );
        }
        const brandKitchens = toggleBrandKitchenMapping(
          body.brandId as DbaBrand,
          kitchenId,
          actor,
        );
        return NextResponse.json({
          success: true,
          brandKitchens,
        });
      }

      case "UPSERT_MENU_ITEM": {
        if (!hasPermission(employee, "OWNER_VIEW")) {
          return NextResponse.json(
            { error: "Forbidden: Requires OWNER_VIEW" },
            { status: 403 },
          );
        }
        if (!body.item || typeof body.item !== "object") {
          return NextResponse.json(
            { error: "Valid menu item payload is required" },
            { status: 400 },
          );
        }
        const menuCatalog = updateMenuCatalogItem(body.item, actor);
        return NextResponse.json({
          success: true,
          menuCatalog,
        });
      }

      case "TOGGLE_KITCHEN_ACTIVE": {
        if (!hasPermission(employee, "OWNER_VIEW")) {
          return NextResponse.json(
            { error: "Forbidden: Requires OWNER_VIEW" },
            { status: 403 },
          );
        }
        const kitchenId = String(body.kitchenId || "").trim();
        if (!kitchenId) {
          return NextResponse.json(
            { error: "kitchenId is required" },
            { status: 400 },
          );
        }
        if (!canAccessKitchen(employee, kitchenId)) {
          return NextResponse.json(
            {
              error: `Forbidden: Cannot toggle kitchen ${kitchenId}`,
            },
            { status: 403 },
          );
        }
        const kitchens = toggleKitchenActive(kitchenId, actor);
        return NextResponse.json({
          success: true,
          kitchens,
        });
      }

      case "UPSERT_EMPLOYEE": {
        if (!hasPermission(employee, "STAFF_MANAGE")) {
          return NextResponse.json(
            { error: "Forbidden: Requires STAFF_MANAGE" },
            { status: 403 },
          );
        }
        if (!body.employee || typeof body.employee !== "object") {
          return NextResponse.json(
            { error: "Valid employee payload is required" },
            { status: 400 },
          );
        }
        if (!hasGlobalScope(employee)) {
          if (body.employee.role === "OWNER") {
            return NextResponse.json(
              {
                error:
                  "Forbidden: Kitchen managers cannot assign the OWNER role",
              },
              { status: 403 },
            );
          }
          const targetKitchen = body.employee.kitchenId || employee.kitchenId;
          if (!canAccessKitchen(employee, targetKitchen)) {
            return NextResponse.json(
              {
                error: `Forbidden: Cannot manage staff outside kitchen ${employee.kitchenId}`,
              },
              { status: 403 },
            );
          }
        }
        const employees = upsertCanonicalEmployee(body.employee, actor).map(
          sanitizeEmployee,
        );
        return NextResponse.json({
          success: true,
          employees,
        });
      }

      case "UPSERT_FILE": {
        if (!hasPermission(employee, "OWNER_VIEW")) {
          return NextResponse.json(
            { error: "Forbidden: Requires OWNER_VIEW" },
            { status: 403 },
          );
        }
        if (!body.file || typeof body.file !== "object") {
          return NextResponse.json(
            { error: "Valid file payload with name is required" },
            { status: 400 },
          );
        }
        const files = upsertVirtualFile(body.file, actor);
        return NextResponse.json({
          success: true,
          files,
        });
      }

      case "DELETE_FILE": {
        if (!hasPermission(employee, "OWNER_VIEW")) {
          return NextResponse.json(
            { error: "Forbidden: Requires OWNER_VIEW" },
            { status: 403 },
          );
        }
        const fileId = String(body.fileId || "").trim();
        if (!fileId) {
          return NextResponse.json(
            { error: "fileId is required" },
            { status: 400 },
          );
        }
        const files = deleteVirtualFile(fileId, actor);
        return NextResponse.json({
          success: true,
          files,
        });
      }

      case "UPDATE_SETTINGS": {
        if (!hasPermission(employee, "OWNER_VIEW")) {
          return NextResponse.json(
            { error: "Forbidden: Requires OWNER_VIEW" },
            { status: 403 },
          );
        }
        const settings = updateSystemSettings(body.settings || {}, actor);
        return NextResponse.json({
          success: true,
          settings,
        });
      }

      case "UPDATE_LEAKAGE_VECTOR": {
        if (!hasPermission(employee, "OWNER_VIEW")) {
          return NextResponse.json(
            { error: "Forbidden: Requires OWNER_VIEW" },
            { status: 403 },
          );
        }
        const vectorId = String(body.id || "").trim();
        if (!vectorId) {
          return NextResponse.json(
            { error: "Leakage vector id is required" },
            { status: 400 },
          );
        }
        const leakageVectors = updateLeakageVectorStatus(
          vectorId,
          body.status,
          actor,
        );
        return NextResponse.json({
          success: true,
          leakageVectors,
        });
      }

      case "RESET_STORE": {
        if (
          !isDemoSandboxEnabled() ||
          !hasPermission(employee, "OWNER_VIEW") ||
          !hasGlobalScope(employee)
        ) {
          return NextResponse.json(
            {
              error:
                "Forbidden: RESET_STORE is restricted to global Owners in Demo Sandbox Mode",
            },
            { status: 403 },
          );
        }
        resetStore();
        const fresh = getStoreSnapshot();
        return NextResponse.json({
          success: true,
          snapshot: {
            ...fresh,
            employees: fresh.employees.map(sanitizeEmployee),
          },
        });
      }

      case "CLEAR_ORDERS": {
        if (
          !isDemoSandboxEnabled() ||
          !hasPermission(employee, "OWNER_VIEW") ||
          !hasGlobalScope(employee)
        ) {
          return NextResponse.json(
            {
              error:
                "Forbidden: CLEAR_ORDERS is restricted to global Owners in Demo Sandbox Mode",
            },
            { status: 403 },
          );
        }
        clearOrdersStore();
        const fresh = getStoreSnapshot();
        return NextResponse.json({
          success: true,
          snapshot: {
            ...fresh,
            employees: fresh.employees.map(sanitizeEmployee),
          },
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown system action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "System mutation failed";
    return NextResponse.json(
      { error: message },
      { status: 400 },
    );
  }
}
