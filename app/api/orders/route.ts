import { NextRequest, NextResponse } from "next/server";

import {
  EMPLOYEES_DB,
  ROLE_PERMISSIONS_DB,
  evaluateOrderInventory,
  processOrderDepletion,
  type Employee,
  type Order,
  type OrderEventType,
  type PermissionCode,
} from "@/lib/db";

import {
  addOrder,
  findOrder,
  getInventory,
  getOrders,
  updateOrder,
} from "@/lib/store";

type OrderAction =
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "DRIVER_ASSIGNED"
  | "PICKED_UP"
  | "DISPATCHED"
  | "CANCELLED";

type OrderRequest = {
  order?: Order;
  orderId?: string;
  action?: OrderAction;
  status?: Order["status"];
  driverName?: string;
  cancellationReason?: string;
  cancellationSource?: Order["cancellationSource"];
};

type AuthResult =
  | {
      employee: Employee;
      error?: never;
    }
  | {
      employee?: never;
      error: NextResponse;
    };

function getEmployeeFromRequest(
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

function requireEmployee(
  request: NextRequest,
  permission: PermissionCode
): AuthResult {
  const employee =
    getEmployeeFromRequest(request);

  if (!employee) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "Authentication required",
        },
        { status: 401 }
      ),
    };
  }

  const allowed =
    ROLE_PERMISSIONS_DB.some(
      (rolePermission) =>
        rolePermission.role === employee.role &&
        rolePermission.permissionCode ===
          permission
    );

  if (!allowed) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "Permission denied",
        },
        { status: 403 }
      ),
    };
  }

  return { employee };
}

function canAccessKitchen(
  employee: Employee,
  kitchenId: string
): boolean {
  if (employee.role === "OWNER") {
    return true;
  }

  return employee.kitchenId === kitchenId;
}

function canAccessOrder(
  employee: Employee,
  order: Order
): boolean {
  return canAccessKitchen(
    employee,
    order.kitchenId
  );
}

function now(): string {
  return new Date().toISOString();
}

function appendEvent(
  order: Order,
  type: OrderEventType,
  actor: Employee,
  details?: string
): Order {
  return {
    ...order,
    events: [
      ...(order.events ?? []),
      {
        id: `EVT-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        type,
        timestamp: now(),
        actor: actor.employeeCode,
        details,
      },
    ],
  };
}

function updateOrderLifecycle(
  order: Order,
  action: OrderAction,
  employee: Employee,
  driverName?: string,
  cancellationReason?: string,
  cancellationSource?: Order["cancellationSource"]
): Order {
  const timestamp = now();

  switch (action) {
    case "PREPARING":
      return appendEvent(
        {
          ...order,
          status: "PREPARING",
          prepStartedAt:
            order.prepStartedAt ??
            timestamp,
          updatedAt: timestamp,
        },
        "PREPARING",
        employee
      );

    case "READY_FOR_PICKUP":
      return appendEvent(
        {
          ...order,
          status: "READY_FOR_PICKUP",
          prepCompletedAt:
            order.prepCompletedAt ??
            timestamp,
          readyAt:
            order.readyAt ??
            timestamp,
          updatedAt: timestamp,
        },
        "READY_FOR_PICKUP",
        employee
      );

    case "DRIVER_ASSIGNED":
      return appendEvent(
        {
          ...order,
          status: "DRIVER_ASSIGNED",
          driverName:
            driverName?.trim() ||
            order.driverName,
          driverAssignedAt:
            order.driverAssignedAt ??
            timestamp,
          updatedAt: timestamp,
        },
        "DRIVER_ASSIGNED",
        employee
      );

    case "PICKED_UP":
      return appendEvent(
        {
          ...order,
          status: "PICKED_UP",
          pickedUpAt:
            order.pickedUpAt ??
            timestamp,
          updatedAt: timestamp,
        },
        "PICKED_UP",
        employee
      );

    case "DISPATCHED":
      return appendEvent(
        {
          ...order,
          status: "DISPATCHED",
          dispatchedAt:
            order.dispatchedAt ??
            timestamp,
          updatedAt: timestamp,
        },
        "DISPATCHED",
        employee
      );

    case "CANCELLED":
      return appendEvent(
        {
          ...order,
          status: "CANCELLED",
          cancellationSource:
            cancellationSource ??
            "MANUAL",
          cancellationReason:
            cancellationReason?.trim() ||
            "Order cancelled",
          cancelledBy:
            employee.employeeCode,
          updatedAt: timestamp,
        },
        "CANCELLED",
        employee,
        cancellationReason?.trim() ||
          "Order cancelled"
      );

    default:
      return order;
  }
}

function restoreOrderInventory(
  order: Order
): {
  restored: boolean;
  lossRecorded: boolean;
} {
  const inventory =
    getInventory();

  const inventoryMap =
    new Map(
      inventory.map((item) => [
        item.id,
        item,
      ])
    );

  let canRestore = true;

  for (const orderItem of order.items) {
    for (const ingredient of orderItem.ingredients ??
      []) {
      const inventoryItem =
        inventoryMap.get(
          ingredient.inventoryItemId
        );

      if (!inventoryItem) {
        canRestore = false;
        break;
      }
    }

    if (!canRestore) {
      break;
    }
  }

  if (!canRestore) {
    return {
      restored: false,
      lossRecorded: true,
    };
  }

  for (const orderItem of order.items) {
    for (const ingredient of orderItem.ingredients ??
      []) {
      const inventoryItem =
        inventoryMap.get(
          ingredient.inventoryItemId
        );

      if (!inventoryItem) {
        continue;
      }

      inventoryItem.currentStock +=
        ingredient.quantity *
        orderItem.quantity;
    }
  }

  return {
    restored: true,
    lossRecorded: false,
  };
}

function buildOrderFromRequest(
  requestOrder: Order,
  employee: Employee
): Order {
  const timestamp = now();

  return {
    ...requestOrder,
    kitchenId:
      requestOrder.kitchenId ||
      employee.kitchenId ||
      "K1",
    status:
      requestOrder.status ??
      "PENDING",
    source:
      requestOrder.source ??
      "MANUAL",
    createdAt:
      requestOrder.createdAt ??
      timestamp,
    updatedAt: timestamp,
    receivedAt:
      requestOrder.receivedAt ??
      timestamp,
    events: [
      ...(requestOrder.events ?? []),
      {
        id: `EVT-${Date.now()}-RECEIVED`,
        type: "RECEIVED",
        timestamp,
        actor:
          employee.employeeCode,
        details:
          "Order received by Dark Cloud Kitchen OS",
      },
    ],
  };
}

export async function GET(
  request: NextRequest
) {
  const auth = requireEmployee(
    request,
    "KITCHEN_OPERATE"
  );

  if (auth.error) {
    return auth.error;
  }

  const employee = auth.employee;

  const orders = getOrders();

  const visibleOrders =
    employee.role === "OWNER"
      ? orders
      : orders.filter(
          (order) =>
            order.kitchenId ===
            employee.kitchenId
        );

  return NextResponse.json({
    success: true,
    orders: visibleOrders,
  });
}

export async function POST(
  request: NextRequest
) {
  const auth = requireEmployee(
    request,
    "KITCHEN_OPERATE"
  );

  if (auth.error) {
    return auth.error;
  }

  const employee = auth.employee;

  let body: OrderRequest;

  try {
    body =
      (await request.json()) as OrderRequest;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request body",
      },
      { status: 400 }
    );
  }

  if (!body.order) {
    return NextResponse.json(
      {
        success: false,
        error: "Order is required",
      },
      { status: 400 }
    );
  }

  const order =
    buildOrderFromRequest(
      body.order,
      employee
    );

  if (
    !canAccessKitchen(
      employee,
      order.kitchenId
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Employee cannot operate this kitchen",
      },
      { status: 403 }
    );
  }

  const inventory =
    getInventory();

  const evaluation =
    evaluateOrderInventory(
      order,
      inventory
    );

  if (
    evaluation.decision ===
    "INSUFFICIENT_STOCK"
  ) {
    const unavailableOrder = {
      ...order,
      inventoryDecision:
        evaluation.decision,
      inventoryWarnings:
        evaluation.warnings,
      inventoryUnavailable:
        evaluation.unavailable,
      events: [
        ...(order.events ?? []),
        {
          id: `EVT-${Date.now()}-INVENTORY`,
          type:
            "INVENTORY_UNAVAILABLE" as const,
          timestamp: now(),
          actor:
            employee.employeeCode,
          details:
            evaluation.unavailable.join(
              "; "
            ),
        },
      ],
    };

    addOrder(unavailableOrder);

    return NextResponse.json(
      {
        success: true,
        order: unavailableOrder,
        inventoryDecision:
          evaluation.decision,
      },
      { status: 201 }
    );
  }

  const depletion =
    processOrderDepletion(
      order,
      inventory
    );

  const persistedOrder = {
    ...order,
    inventoryDecision:
      evaluation.decision,
    inventoryWarnings:
      evaluation.warnings,
    inventoryUnavailable:
      evaluation.unavailable,
    events: [
      ...(order.events ?? []),
      ...(evaluation.warnings.length
        ? [
            {
              id: `EVT-${Date.now()}-WARNING`,
              type:
                "INVENTORY_WARNING" as const,
              timestamp: now(),
              actor:
                employee.employeeCode,
              details:
                evaluation.warnings.join(
                  "; "
                ),
            },
          ]
        : []),
      {
        id: `EVT-${Date.now()}-ACCEPTED`,
        type: "ACCEPTED" as const,
        timestamp: now(),
        actor:
          employee.employeeCode,
        details:
          "Order accepted after inventory evaluation",
      },
    ],
    updatedAt: now(),
  };

  if (!depletion.success) {
    return NextResponse.json(
      {
        success: false,
        error:
          depletion.error ??
          "Unable to deplete inventory",
      },
      { status: 409 }
    );
  }

  addOrder(persistedOrder);

  return NextResponse.json(
    {
      success: true,
      order: persistedOrder,
      inventoryDecision:
        evaluation.decision,
    },
    { status: 201 }
  );
}

export async function PATCH(
  request: NextRequest
) {
  const auth = requireEmployee(
    request,
    "KITCHEN_OPERATE"
  );

  if (auth.error) {
    return auth.error;
  }

  const employee = auth.employee;

  let body: OrderRequest;

  try {
    body =
      (await request.json()) as OrderRequest;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request body",
      },
      { status: 400 }
    );
  }

  if (!body.orderId) {
    return NextResponse.json(
      {
        success: false,
        error: "orderId is required",
      },
      { status: 400 }
    );
  }

  const existingOrder =
    findOrder(body.orderId);

  if (!existingOrder) {
    return NextResponse.json(
      {
        success: false,
        error: "Order not found",
      },
      { status: 404 }
    );
  }

  if (
    !canAccessOrder(
      employee,
      existingOrder
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Employee cannot operate this order",
      },
      { status: 403 }
    );
  }

  const action =
    body.action ??
    body.status;

  if (!action) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Order action is required",
      },
      { status: 400 }
    );
  }

  if (
    action === "PREPARING" ||
    action === "READY_FOR_PICKUP"
  ) {
    if (
      !ROLE_PERMISSIONS_DB.some(
        (permission) =>
          permission.role ===
            employee.role &&
          permission.permissionCode ===
            "COOK_ORDERS"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cook permission required",
        },
        { status: 403 }
      );
    }
  }

  if (
    action === "DRIVER_ASSIGNED" ||
    action === "PICKED_UP" ||
    action === "DISPATCHED"
  ) {
    if (
      !ROLE_PERMISSIONS_DB.some(
        (permission) =>
          permission.role ===
            employee.role &&
          permission.permissionCode ===
            "DISPATCH_ORDERS"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Dispatch permission required",
        },
        { status: 403 }
      );
    }
  }

  if (action === "CANCELLED") {
    if (
      !ROLE_PERMISSIONS_DB.some(
        (permission) =>
          permission.role ===
            employee.role &&
          permission.permissionCode ===
            "ORDER_CANCEL"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cancellation permission required",
        },
        { status: 403 }
      );
    }

    if (
      existingOrder.status ===
        "PICKED_UP" ||
      existingOrder.status ===
        "DISPATCHED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This order requires post-pickup aggregator/accounting handling",
        },
        { status: 409 }
      );
    }
  }

  const updatedOrder =
    updateOrder(
      existingOrder.id,
      (currentOrder) => {
        const nextOrder =
          updateOrderLifecycle(
            currentOrder,
            action,
            employee,
            body.driverName,
            body.cancellationReason,
            body.cancellationSource
          );

        if (
          action === "CANCELLED"
        ) {
          const restoration =
            restoreOrderInventory(
              currentOrder
            );

          return {
            ...nextOrder,
            inventoryWarnings: [
              ...(nextOrder.inventoryWarnings ??
                []),
              restoration.restored
                ? "Inventory restored after cancellation"
                : "Consumed ingredients recorded as operational loss",
            ],
          };
        }

        return nextOrder;
      }
    );

  if (!updatedOrder) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to update order",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    order: updatedOrder,
  });
}
