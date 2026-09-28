import { NextRequest, NextResponse } from "next/server";

import {
  EMPLOYEES_DB,
  ROLE_PERMISSIONS_DB,
  type Employee,
  type InventoryItem,
  type PermissionCode,
} from "@/lib/db";

import {
  getInventory,
  replaceInventory,
} from "@/lib/store";

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
  const permissionId =
    `PERM-${permissionCode
      .replaceAll("_", "-")
      .toUpperCase()}`;

  return ROLE_PERMISSIONS_DB.some(
    (permission) =>
      permission.role === employee.role &&
      permission.permissionId === permissionId
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
          error: "Forbidden",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      inventory: getInventory(),
    });
  } catch (error) {
    console.error(
      "GET /api/inventory failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load inventory",
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
          error: "Forbidden",
        },
        { status: 403 }
      );
    }

    const body =
      await request.json();

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid inventory payload",
        },
        { status: 400 }
      );
    }

    const itemId =
      typeof body.id === "string"
        ? body.id.trim()
        : "";

    if (!itemId) {
      return NextResponse.json(
        {
          error:
            "Inventory item id is required",
        },
        { status: 400 }
      );
    }

    const inventory =
      getInventory();

    const existingItem =
      inventory.find(
        (item) =>
          item.id === itemId
      );

    if (!existingItem) {
      return NextResponse.json(
        {
          error:
            "Inventory item not found",
        },
        { status: 404 }
      );
    }

    const nextStock =
      typeof body.currentStock ===
      "number"
        ? body.currentStock
        : existingItem.currentStock;

    if (
      !Number.isFinite(
        nextStock
      ) ||
      nextStock < 0
    ) {
      return NextResponse.json(
        {
          error:
            "currentStock must be a non-negative number",
        },
        { status: 400 }
      );
    }

    const updatedItem:
      InventoryItem = {
        ...existingItem,
        currentStock:
          nextStock,
        lastRestocked:
          nextStock >
          existingItem.currentStock
            ? new Date().toISOString()
            : existingItem.lastRestocked,
      };

    const updatedInventory =
      inventory.map(
        (item) =>
          item.id === itemId
            ? updatedItem
            : item
      );

    replaceInventory(
      updatedInventory
    );

    return NextResponse.json({
      inventory:
        updatedInventory,
      item: updatedItem,
    });
  } catch (error) {
    console.error(
      "PATCH /api/inventory failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to update inventory",
      },
      { status: 500 }
    );
  }
}
