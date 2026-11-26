import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedEmployee } from "@/lib/domain/auth-service";
import {
  canAccessKitchen,
  hasGlobalScope,
  hasPermission,
} from "@/lib/domain/permission-service";
import {
  getInventory,
  getInventoryMovements,
  mutateCanonicalInventory,
  transferKitchenInventory,
} from "@/lib/store";

export async function GET(request: NextRequest) {
  try {
    const employee = await getAuthenticatedEmployee(request);

    if (!employee) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !hasPermission(employee, "INVENTORY_VIEW") &&
      !hasPermission(employee, "OWNER_VIEW")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requestedKitchenId = (
      request.nextUrl.searchParams.get("kitchenId") || ""
    ).trim();

    let effectiveKitchenFilter: string | undefined;

    if (!hasGlobalScope(employee)) {
      if (
        requestedKitchenId &&
        requestedKitchenId !== "ALL" &&
        !canAccessKitchen(employee, requestedKitchenId)
      ) {
        return NextResponse.json(
          {
            error: `Forbidden: Employee ${employee.employeeCode} cannot view inventory for kitchen ${requestedKitchenId}`,
          },
          { status: 403 },
        );
      }
      effectiveKitchenFilter = employee.kitchenId || "K1";
    } else if (requestedKitchenId && requestedKitchenId !== "ALL") {
      effectiveKitchenFilter = requestedKitchenId;
    }

    const [inventory, movements] = await Promise.all([
      getInventory(effectiveKitchenFilter),
      getInventoryMovements(effectiveKitchenFilter),
    ]);

    return NextResponse.json({
      inventory,
      movements,
      kitchenId: effectiveKitchenFilter ?? "ALL",
    });
  } catch (error) {
    console.error("GET /api/inventory failed:", error);

    return NextResponse.json(
      { error: "Unable to load inventory" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const employee = await getAuthenticatedEmployee(request);

    if (!employee) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !hasPermission(employee, "INVENTORY_MANAGE") &&
      !hasPermission(employee, "OWNER_VIEW")
    ) {
      return NextResponse.json(
        {
          error: "Forbidden: Requires INVENTORY_MANAGE permission",
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
        { error: "Inventory item id is required" },
        { status: 400 },
      );
    }

    const actorLabel = `${employee.employeeCode} (${employee.name})`;
    const scopedFilter = hasGlobalScope(employee)
      ? undefined
      : employee.kitchenId || "K1";

    // Atomic Inter-Kitchen Stock Transfer
    if (body.action === "TRANSFER") {
      const fromKitchenId = String(body.fromKitchenId || "").trim();
      const toKitchenId = String(body.toKitchenId || "").trim();
      const quantity = Number(body.quantity);

      if (!fromKitchenId || !toKitchenId) {
        return NextResponse.json(
          { error: "fromKitchenId and toKitchenId are required for TRANSFER" },
          { status: 400 },
        );
      }

      if (
        !canAccessKitchen(employee, fromKitchenId) ||
        !canAccessKitchen(employee, toKitchenId)
      ) {
        return NextResponse.json(
          {
            error: `Forbidden: Employee ${employee.employeeCode} requires access to both ${fromKitchenId} and ${toKitchenId} to transfer stock`,
          },
          { status: 403 },
        );
      }

      const transferResult = await transferKitchenInventory({
        itemId,
        fromKitchenId,
        toKitchenId,
        quantity,
        reason: typeof body.reason === "string" ? body.reason : undefined,
        actor: actorLabel,
      });

      const movements = await getInventoryMovements(scopedFilter);
      const visibleInventory = scopedFilter
        ? transferResult.inventory.filter((i) => i.kitchenId === scopedFilter)
        : transferResult.inventory;

      return NextResponse.json({
        success: true,
        transferGroupId: transferResult.transferGroupId,
        fromItem: transferResult.fromItem,
        toItem: transferResult.toItem,
        outMovement: transferResult.outMovement,
        inMovement: transferResult.inMovement,
        inventory: visibleInventory,
        movements,
      });
    }

    const targetKitchenId =
      typeof body.kitchenId === "string" && body.kitchenId.trim()
        ? body.kitchenId.trim()
        : employee.kitchenId || "K1";

    if (!canAccessKitchen(employee, targetKitchenId)) {
      return NextResponse.json(
        {
          error: `Forbidden: Employee ${employee.employeeCode} cannot adjust inventory for kitchen ${targetKitchenId}`,
        },
        { status: 403 },
      );
    }

    const result = await mutateCanonicalInventory({
      itemId,
      action:
        body.action ||
        (typeof body.currentStock === "number" ? "SET_STOCK" : "RESTOCK"),
      quantity: typeof body.quantity === "number" ? body.quantity : undefined,
      currentStock:
        typeof body.currentStock === "number" ? body.currentStock : undefined,
      reason: body.reason,
      kitchenId: targetKitchenId,
      actor: actorLabel,
    });

    const movements = await getInventoryMovements(scopedFilter);
    const visibleInventory = scopedFilter
      ? result.inventory.filter((i) => i.kitchenId === scopedFilter)
      : result.inventory;

    return NextResponse.json({
      inventory: visibleInventory,
      item: result.item,
      movement: result.movement,
      movements,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update inventory";
    const status = message.includes("not found")
      ? 404
      : message.includes("Insufficient stock")
        ? 409
        : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
