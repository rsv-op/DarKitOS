import { NextRequest, NextResponse } from "next/server";

import {
  EMPLOYEES_DB,
  PERMISSIONS_DB,
  ROLE_PERMISSIONS_DB,
  type Employee,
  type PermissionCode,
} from "@/lib/db";

import {
  getInventory,
  replaceInventory,
} from "@/lib/store";

export const dynamic = "force-dynamic";

function getEmployee(
  request: NextRequest
): Employee | null {
  const employeeCode =
    request.cookies.get("employee_code")?.value;

  if (!employeeCode) {
    return null;
  }

  return (
    EMPLOYEES_DB.find(
      (employee) =>
        employee.active &&
        employee.employeeCode === employeeCode
    ) ?? null
  );
}

function hasPermission(
  employee: Employee,
  permissionCode: PermissionCode
): boolean {
  const permission = PERMISSIONS_DB.find(
    (item) => item.code === permissionCode
  );

  if (!permission) {
    return false;
  }

  return ROLE_PERMISSIONS_DB.some(
    (rolePermission) =>
      rolePermission.role === employee.role &&
      rolePermission.permissionId === permission.id
  );
}

export async function GET(
  request: NextRequest
) {
  try {
    const employee =
      getEmployee(request);

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    if (
      !hasPermission(
        employee,
        "INVENTORY_VIEW"
      ) &&
      !hasPermission(
        employee,
        "OWNER_VIEW"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
        },
        { status: 403 }
      );
    }

    const inventory =
      getInventory();

    return NextResponse.json({
      success: true,
      inventory,
      lowStock: inventory.filter(
        (item) =>
          item.currentStock <=
          item.reorderThreshold
      ),
    });
  } catch (error) {
    console.error(
      "GET /api/inventory failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to load inventory",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest
) {
  try {
    const employee =
      getEmployee(request);

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    if (
      !hasPermission(
        employee,
        "INVENTORY_MANAGE"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
        },
        { status: 403 }
      );
    }

    const body =
      await request.json();

    const itemId =
      typeof body?.itemId === "string"
        ? body.itemId
        : "";

    const restockAmount =
      Number(body?.restockAmount);

    if (!itemId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "itemId is required",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(
        restockAmount
      ) ||
      restockAmount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "restockAmount must be a positive number",
        },
        { status: 400 }
      );
    }

    const inventory =
      getInventory();

    const itemIndex =
      inventory.findIndex(
        (item) =>
          item.id === itemId
      );

    if (itemIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Item not found",
        },
        { status: 404 }
      );
    }

    const updatedInventory =
      inventory.map(
        (item, index) => {
          if (
            index !== itemIndex
          ) {
            return item;
          }

          return {
            ...item,
            currentStock:
              item.currentStock +
              restockAmount,
            lastRestocked:
              new Date().toISOString(),
          };
        }
      );

    replaceInventory(
      updatedInventory
    );

    const updatedItem =
      updatedInventory[
        itemIndex
      ];

    return NextResponse.json({
      success: true,
      updatedItem,
      inventory:
        updatedInventory,
      lowStock:
        updatedInventory.filter(
          (item) =>
            item.currentStock <=
            item.reorderThreshold
        ),
    });
  } catch (error) {
    console.error(
      "PATCH /api/inventory failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to update inventory",
      },
      { status: 500 }
    );
  }
}
