import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedEmployee } from "@/lib/domain/auth-service";
import { hasPermission } from "@/lib/domain/permission-service";
import {
  getInventory,
  getInventoryMovements,
  mutateCanonicalInventory,
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

    if (
      !hasPermission(
        employee,
        "INVENTORY_VIEW",
      ) &&
      !hasPermission(employee, "OWNER_VIEW")
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      inventory: getInventory(),
      movements: getInventoryMovements(),
    });
  } catch (error) {
    console.error(
      "GET /api/inventory failed:",
      error,
    );

    return NextResponse.json(
      { error: "Unable to load inventory" },
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

    if (
      !hasPermission(
        employee,
        "INVENTORY_MANAGE",
      ) &&
      !hasPermission(employee, "OWNER_VIEW")
    ) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Requires INVENTORY_MANAGE permission",
        },
        { status: 403 },
      );
    }

    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid inventory payload" },
        { status: 400 },
      );
    }

    const itemId =
      typeof body.id === "string"
        ? body.id.trim()
        : typeof body.itemId === "string"
          ? body.itemId.trim()
          : "";

    if (!itemId) {
      return NextResponse.json(
        {
          error:
            "Inventory item id is required",
        },
        { status: 400 },
      );
    }

    const actorLabel = `${employee.employeeCode} (${employee.name})`;

    const result = mutateCanonicalInventory({
      itemId,
      action:
        body.action ||
        (typeof body.currentStock === "number"
          ? "SET_STOCK"
          : "RESTOCK"),
      quantity:
        typeof body.quantity === "number"
          ? body.quantity
          : undefined,
      currentStock:
        typeof body.currentStock === "number"
          ? body.currentStock
          : undefined,
      reason: body.reason,
      kitchenId:
        body.kitchenId || employee.kitchenId,
      actor: actorLabel,
    });

    return NextResponse.json({
      inventory: result.inventory,
      item: result.item,
      movement: result.movement,
      movements: getInventoryMovements(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update inventory";
    const status = message.includes(
      "not found",
    )
      ? 404
      : 400;

    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
