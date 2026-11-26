import { NextRequest, NextResponse } from "next/server";
import { isDemoSandboxEnabled, sanitizeEmployee } from "@/lib/auth";
import { PERMISSIONS_DB, ROLE_PERMISSIONS_DB, type DbaBrand } from "@/lib/db";
import { requireAuthenticatedEmployee } from "@/lib/domain/auth-service";
import {
  canAccessKitchen,
  canAccessOrganization,
  getAccessibleKitchenIds,
  getRolePermissions,
  hasGlobalScope,
  hasPermission,
} from "@/lib/domain/permission-service";
import {
  clearOrdersStore,
  deleteVirtualFile,
  getKitchens,
  getStorageMode,
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
    const auth = await requireAuthenticatedEmployee(request);
    if (!auth.ok) return auth.response;
    const employee = auth.employee;

    const snapshot = await getStoreSnapshot();
    const isGlobal = hasGlobalScope(employee);
    const isOwnerView = hasPermission(employee, "OWNER_VIEW");
    const safeSelf = sanitizeEmployee(employee, employee.authProvider);

    const accessibleKitchens = getAccessibleKitchenIds(
      employee,
      snapshot.kitchens,
    );

    const scopedOrganizations = snapshot.organizations.filter((o) =>
      canAccessOrganization(employee, o.id),
    );

    const scopedKitchens = snapshot.kitchens.filter((k) =>
      canAccessOrganization(employee, k.organizationId),
    );

    const scopedBrands = snapshot.brands.filter((b) =>
      canAccessOrganization(employee, b.organizationId),
    );

    const orgKitchenIds = new Set(scopedKitchens.map((k) => k.id));
    const scopedBrandKitchens = snapshot.brandKitchens.filter((bk) =>
      orgKitchenIds.has(bk.kitchenId),
    );

    const scopedOrders = snapshot.orders.filter(
      (o) =>
        canAccessOrganization(employee, o.organizationId) &&
        accessibleKitchens.has(o.kitchenId),
    );

    const scopedInventory = snapshot.inventory.filter(
      (i) => i.kitchenId && accessibleKitchens.has(i.kitchenId),
    );

    const scopedCancellations = snapshot.cancellations.filter((c) =>
      accessibleKitchens.has(c.kitchenId),
    );

    const scopedMovements = snapshot.inventoryMovements.filter((m) =>
      accessibleKitchens.has(m.kitchenId),
    );

    const scopedActivities = snapshot.activities.filter(
      (a) =>
        canAccessOrganization(employee, a.organizationId) &&
        (isGlobal || !a.kitchenId || accessibleKitchens.has(a.kitchenId)),
    );

    const scopedFiles = snapshot.files.filter(
      (f) =>
        isGlobal
          ? !f.kitchenId ||
            f.kitchenId === "GLOBAL" ||
            orgKitchenIds.has(f.kitchenId)
          : !f.kitchenId ||
            f.kitchenId === "GLOBAL" ||
            accessibleKitchens.has(f.kitchenId),
    );

    const scopedEmployees = !isOwnerView
      ? [safeSelf]
      : isGlobal
        ? snapshot.employees
            .filter((e) => canAccessOrganization(employee, e.organizationId))
            .map((e) => sanitizeEmployee(e))
        : snapshot.employees
            .filter(
              (e) =>
                canAccessOrganization(employee, e.organizationId) &&
                e.kitchenId === employee.kitchenId,
            )
            .map((e) => sanitizeEmployee(e));

    const scopedWebhooks = !isOwnerView
      ? []
      : snapshot.webhookEvents.filter((w) =>
          accessibleKitchens.has(w.kitchenId),
        );

    return NextResponse.json({
      ...snapshot,
      organizations: scopedOrganizations,
      kitchens: scopedKitchens,
      brands: scopedBrands,
      brandKitchens: scopedBrandKitchens,
      orders: scopedOrders,
      inventory: scopedInventory,
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
      storageMode: getStorageMode(),
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
    const auth = await requireAuthenticatedEmployee(request);
    if (!auth.ok) return auth.response;
    const employee = auth.employee;

    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 },
      );
    }

    const action = String(body?.action || "").trim();
    const actor = `${employee.employeeCode} (${employee.name})`;
    const allKitchens = await getKitchens();

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
        if (!canAccessKitchen(employee, kitchenId, allKitchens)) {
          return NextResponse.json(
            {
              error: `Forbidden: Cannot alter BrandKitchen matrix for kitchen ${kitchenId}`,
            },
            { status: 403 },
          );
        }
        const brandKitchens = await toggleBrandKitchenMapping(
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
        const menuCatalog = await updateMenuCatalogItem(body.item, actor);
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
        if (!canAccessKitchen(employee, kitchenId, allKitchens)) {
          return NextResponse.json(
            {
              error: `Forbidden: Cannot toggle kitchen ${kitchenId}`,
            },
            { status: 403 },
          );
        }
        const kitchens = (await toggleKitchenActive(kitchenId, actor)).filter(
          (k) => canAccessOrganization(employee, k.organizationId),
        );
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
        if (
          body.employee.organizationId &&
          !canAccessOrganization(employee, body.employee.organizationId)
        ) {
          return NextResponse.json(
            {
              error: `Forbidden: Cannot manage staff in organization ${body.employee.organizationId}`,
            },
            { status: 403 },
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
          if (!canAccessKitchen(employee, targetKitchen, allKitchens)) {
            return NextResponse.json(
              {
                error: `Forbidden: Cannot manage staff outside kitchen ${employee.kitchenId}`,
              },
              { status: 403 },
            );
          }
        } else if (
          body.employee.kitchenId &&
          body.employee.role !== "OWNER" &&
          !canAccessKitchen(employee, body.employee.kitchenId, allKitchens)
        ) {
          return NextResponse.json(
            {
              error: `Forbidden: Kitchen ${body.employee.kitchenId} is outside your organization`,
            },
            { status: 403 },
          );
        }
        const employees = (
          await upsertCanonicalEmployee(
            {
              ...body.employee,
              organizationId: employee.organizationId,
            },
            actor,
          )
        )
          .filter((e) => canAccessOrganization(employee, e.organizationId))
          .map((e) => sanitizeEmployee(e));
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
        const files = await upsertVirtualFile(body.file, actor);
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
        const files = await deleteVirtualFile(fileId, actor);
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
        const settings = await updateSystemSettings(body.settings || {}, actor);
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
        const leakageVectors = await updateLeakageVectorStatus(
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
        await resetStore();
        const fresh = await getStoreSnapshot();
        return NextResponse.json({
          success: true,
          snapshot: {
            ...fresh,
            employees: fresh.employees.map((e) => sanitizeEmployee(e)),
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
        await clearOrdersStore();
        const fresh = await getStoreSnapshot();
        return NextResponse.json({
          success: true,
          snapshot: {
            ...fresh,
            employees: fresh.employees.map((e) => sanitizeEmployee(e)),
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
      error instanceof Error ? error.message : "System mutation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
