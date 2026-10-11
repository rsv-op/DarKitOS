import { NextRequest, NextResponse } from "next/server";
import {
  PERMISSIONS_DB,
  ROLE_PERMISSIONS_DB,
  type DbaBrand,
} from "@/lib/db";
import { getAuthenticatedEmployee } from "@/lib/domain/auth-service";
import {
  getRolePermissions,
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
    const employee =
      await getAuthenticatedEmployee(request);

    if (!employee) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const snapshot = getStoreSnapshot();

    return NextResponse.json({
      ...snapshot,
      currentEmployee: employee,
      currentPermissions: getRolePermissions(
        employee.role,
      ),
      permissionsCatalog: PERMISSIONS_DB,
      rolePermissionsCatalog:
        ROLE_PERMISSIONS_DB,
    });
  } catch (error) {
    console.error(
      "GET /api/system failed:",
      error,
    );
    return NextResponse.json(
      { error: "Unable to load system state" },
      { status: 500 },
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
    const action = String(
      body?.action || "",
    ).trim();
    const actor = `${employee.employeeCode} (${employee.name})`;

    switch (action) {
      case "TOGGLE_BRAND_KITCHEN": {
        if (
          !hasPermission(
            employee,
            "OWNER_VIEW",
          )
        ) {
          return NextResponse.json(
            {
              error:
                "Forbidden: Requires OWNER_VIEW",
            },
            { status: 403 },
          );
        }
        const brandKitchens =
          toggleBrandKitchenMapping(
            body.brandId as DbaBrand,
            String(body.kitchenId),
            actor,
          );
        return NextResponse.json({
          success: true,
          brandKitchens,
        });
      }

      case "UPSERT_MENU_ITEM": {
        if (
          !hasPermission(
            employee,
            "OWNER_VIEW",
          )
        ) {
          return NextResponse.json(
            {
              error:
                "Forbidden: Requires OWNER_VIEW",
            },
            { status: 403 },
          );
        }
        const menuCatalog =
          updateMenuCatalogItem(
            body.item,
            actor,
          );
        return NextResponse.json({
          success: true,
          menuCatalog,
        });
      }

      case "TOGGLE_KITCHEN_ACTIVE": {
        if (
          !hasPermission(
            employee,
            "OWNER_VIEW",
          )
        ) {
          return NextResponse.json(
            {
              error:
                "Forbidden: Requires OWNER_VIEW",
            },
            { status: 403 },
          );
        }
        const kitchens = toggleKitchenActive(
          String(body.kitchenId),
          actor,
        );
        return NextResponse.json({
          success: true,
          kitchens,
        });
      }

      case "UPSERT_EMPLOYEE": {
        if (
          !hasPermission(
            employee,
            "STAFF_MANAGE",
          )
        ) {
          return NextResponse.json(
            {
              error:
                "Forbidden: Requires STAFF_MANAGE",
            },
            { status: 403 },
          );
        }
        const employees =
          upsertCanonicalEmployee(
            body.employee,
            actor,
          );
        return NextResponse.json({
          success: true,
          employees,
        });
      }

      case "UPSERT_FILE": {
        const files = upsertVirtualFile(
          body.file,
          actor,
        );
        return NextResponse.json({
          success: true,
          files,
        });
      }

      case "DELETE_FILE": {
        const files = deleteVirtualFile(
          String(body.fileId),
          actor,
        );
        return NextResponse.json({
          success: true,
          files,
        });
      }

      case "UPDATE_SETTINGS": {
        const settings = updateSystemSettings(
          body.settings || {},
          actor,
        );
        return NextResponse.json({
          success: true,
          settings,
        });
      }

      case "UPDATE_LEAKAGE_VECTOR": {
        if (
          !hasPermission(
            employee,
            "OWNER_VIEW",
          )
        ) {
          return NextResponse.json(
            {
              error:
                "Forbidden: Requires OWNER_VIEW",
            },
            { status: 403 },
          );
        }
        const leakageVectors =
          updateLeakageVectorStatus(
            String(body.id),
            body.status,
            actor,
          );
        return NextResponse.json({
          success: true,
          leakageVectors,
        });
      }

      case "RESET_STORE": {
        resetStore();
        return NextResponse.json({
          success: true,
          snapshot: getStoreSnapshot(),
        });
      }

      case "CLEAR_ORDERS": {
        clearOrdersStore();
        return NextResponse.json({
          success: true,
          snapshot: getStoreSnapshot(),
        });
      }

      default:
        return NextResponse.json(
          {
            error: `Unknown system action: ${action}`,
          },
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
