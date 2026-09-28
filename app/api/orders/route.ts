import { NextRequest, NextResponse } from "next/server";

import {
  EMPLOYEES_DB,
  ROLE_PERMISSIONS_DB,
  evaluateOrderInventory,
  processOrderDepletion,
  type Employee,
  type Order,
  type OrderEventType,
  type OrderStatus,
  type PermissionCode,
} from "@/lib/db";

import {
  addOrder,
  getInventory,
  getOrders,
  transaction,
  updateOrder,
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
  return ROLE_PERMISSIONS_DB.some(
    (permission) =>
      permission.role === employee.role &&
      permission.permissionCode === permissionCode
  );
}

function canAccessOrder(
  employee: Employee,
  order: Order
): boolean {
  if (employee.role === "OWNER") {
    return true;
  }

  return employee.kitchenId === order.kitchenId;
}

function canUseOrderAction(
  employee: Employee,
  action: OrderStatus
): boolean {
  if (
    action === "PREPARING" ||
    action === "READY_FOR_PICKUP"
  ) {
    return hasPermission(
      employee,
      "COOK_ORDERS"
    );
  }

  if (
    action === "DRIVER_ASSIGNED" ||
    action === "PICKED_UP" ||
    action === "DISPATCHED"
  ) {
    return hasPermission(
      employee,
      "DISPATCH_ORDERS"
    );
  }

  if (action === "CANCELLED") {
    return hasPermission(
      employee,
      "ORDER_CANCEL"
    );
  }

  return false;
}

function createEvent(
  type: OrderEventType,
  actor: string,
  details?: string
) {
  return {
    id: `EVT-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    type,
    timestamp: new Date().toISOString(),
    actor,
    ...(details ? { details } : {}),
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const employee =
      getEmployee(request);

    if (!employee) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const orders = getOrders();

    const visibleOrders =
      orders.filter((order) =>
        canAccessOrder(
          employee,
          order
        )
      );

    return NextResponse.json({
      orders: visibleOrders,
    });
  } catch (error) {
    console.error(
      "GET /api/orders failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load orders",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const employee =
      getEmployee(request);

    if (!employee) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (
      !hasPermission(
        employee,
        "KITCHEN_OPERATE"
      ) &&
      !hasPermission(
        employee,
        "OWNER_VIEW"
      )
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
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
            "Invalid order payload",
        },
        { status: 400 }
      );
    }

    const now =
      new Date().toISOString();

    const order = {
      ...body,
      status: "PENDING",
      createdAt:
        body.createdAt ?? now,
      updatedAt: now,
      receivedAt:
        body.receivedAt ?? now,
      events: [
        ...(Array.isArray(
          body.events
        )
          ? body.events
          : []),
        createEvent(
          "RECEIVED",
          employee.employeeCode,
          "Order received by the OS"
        ),
      ],
    } as Order;

    if (!order.id) {
      return NextResponse.json(
        {
          error:
            "Order id is required",
        },
        { status: 400 }
      );
    }

    if (!order.brandId) {
      return NextResponse.json(
        {
          error:
            "brandId is required",
        },
        { status: 400 }
      );
    }

    if (!order.kitchenId) {
      return NextResponse.json(
        {
          error:
            "kitchenId is required",
        },
        { status: 400 }
      );
    }

    if (!order.source) {
      return NextResponse.json(
        {
          error:
            "source is required",
        },
        { status: 400 }
      );
    }

    if (!order.channel) {
      return NextResponse.json(
        {
          error:
            "channel is required",
        },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(order.items) ||
      order.items.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "At least one order item is required",
        },
        { status: 400 }
      );
    }

    if (
      employee.role !== "OWNER" &&
      employee.kitchenId !==
        order.kitchenId
    ) {
      return NextResponse.json(
        {
          error:
            "Order belongs to another kitchen",
        },
        { status: 403 }
      );
    }

    const result =
      transaction(() => {
        const inventory =
          getInventory();

        const evaluation =
          evaluateOrderInventory(
            order,
            inventory
          );

        const inventoryWarnings =
          evaluation.lowStockItems;

        const inventoryUnavailable =
          evaluation.insufficientStockItems;

        if (
          evaluation.inventoryDecision ===
          "INSUFFICIENT_STOCK"
        ) {
          const blockedOrder: Order = {
            ...order,
            inventoryDecision:
              evaluation.inventoryDecision,
            inventoryWarnings:
              inventoryWarnings.length > 0
                ? inventoryWarnings
                : undefined,
            inventoryUnavailable:
              inventoryUnavailable.length > 0
                ? inventoryUnavailable
                : undefined,
            events: [
              ...order.events,
              createEvent(
                "INVENTORY_CHECKED",
                employee.employeeCode,
                "Inventory checked before order acceptance"
              ),
              createEvent(
                "INVENTORY_UNAVAILABLE",
                employee.employeeCode,
                inventoryUnavailable.join(
                  ", "
                )
              ),
            ],
          };

          return {
            accepted: false,
            order: blockedOrder,
            depletedItems: [],
            lowStockAlerts:
              inventoryWarnings,
            currentInventory:
              inventory,
          };
        }

        const depletion =
          processOrderDepletion(
            order,
            inventory
          );

        const acceptedOrder: Order = {
          ...order,
          inventoryDecision:
            depletion.inventoryDecision,
          inventoryWarnings:
            depletion.lowStockAlerts.length >
            0
              ? depletion.lowStockAlerts
              : undefined,
          inventoryUnavailable:
            depletion.insufficientStockItems
                .length > 0
              ? depletion.insufficientStockItems
              : undefined,
          events: [
            ...order.events,
            create
