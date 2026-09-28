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
            createEvent(
              "INVENTORY_CHECKED",
              employee.employeeCode,
              depletion.inventoryDecision
            ),
            ...(depletion.lowStockAlerts
              .length > 0
              ? [
                  createEvent(
                    "INVENTORY_WARNING",
                    employee.employeeCode,
                    depletion.lowStockAlerts.join(
                      ", "
                    )
                  ),
                ]
              : []),
            createEvent(
              "ACCEPTED",
              employee.employeeCode,
              "Order accepted and inventory allocated"
            ),
          ],
        };

        replaceInventory(
          depletion.updatedInventory
        );

        const storedOrder =
          addOrder(
            acceptedOrder
          );

        return {
          accepted: true,
          order: storedOrder,
          depletedItems:
            depletion.depletedItems,
          lowStockAlerts:
            depletion.lowStockAlerts,
          currentInventory:
            depletion.updatedInventory,
        };
      });

    if (!result.accepted) {
      return NextResponse.json(
        {
          error:
            "Order cannot be accepted because required inventory is insufficient.",
          order: result.order,
          inventoryUnavailable:
            result.order
              .inventoryUnavailable ??
            [],
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        order: result.order,
        depletedItems:
          result.depletedItems,
        lowStockAlerts:
          result.lowStockAlerts,
        currentInventory:
          result.currentInventory,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "POST /api/orders failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to create order",
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
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body =
      await request.json();

    const orderId =
      typeof body?.orderId ===
      "string"
        ? body.orderId
        : typeof body?.id ===
            "string"
          ? body.id
          : "";

    const action =
      typeof body?.action ===
      "string"
        ? (body.action as OrderStatus)
        : null;

    if (
      !orderId ||
      !action
    ) {
      return NextResponse.json(
        {
          error:
            "orderId and action are required",
        },
        { status: 400 }
      );
    }

    const allowedActions:
      OrderStatus[] = [
        "PREPARING",
        "READY_FOR_PICKUP",
        "DRIVER_ASSIGNED",
        "PICKED_UP",
        "DISPATCHED",
        "CANCELLED",
      ];

    if (
      !allowedActions.includes(
        action
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported order action",
        },
        { status: 400 }
      );
    }

    const existingOrders =
      getOrders();

    const existingOrder =
      existingOrders.find(
        (order) =>
          order.id === orderId
      );

    if (!existingOrder) {
      return NextResponse.json(
        {
          error:
            "Order not found",
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
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    if (
      !canUseOrderAction(
        employee,
        action
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Permission denied",
        },
        { status: 403 }
      );
    }

    if (
      action ===
        "CANCELLED" &&
      (
        existingOrder.status ===
          "PICKED_UP" ||
        existingOrder.status ===
          "DISPATCHED"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Post-pickup cancellation requires aggregator/accounting handling.",
        },
        { status: 409 }
      );
    }

    const now =
      new Date().toISOString();

    const updatedOrder =
      updateOrder(
        orderId,
        (currentOrder) => {
          const nextOrder =
            {
              ...currentOrder,
              status: action,
              updatedAt: now,
              events: [
                ...currentOrder.events,
                createEvent(
                  action as OrderEventType,
                  employee.employeeCode
                ),
              ],
            } as Order;

          if (
            action ===
            "PREPARING"
          ) {
            nextOrder.prepStartedAt =
              currentOrder.prepStartedAt ??
              now;
          }

          if (
            action ===
            "READY_FOR_PICKUP"
          ) {
            nextOrder.prepCompletedAt =
              currentOrder.prepCompletedAt ??
              now;

            nextOrder.readyAt =
              currentOrder.readyAt ??
              now;
          }

          if (
            action ===
            "DRIVER_ASSIGNED"
          ) {
            nextOrder.driverAssignedAt =
              currentOrder.driverAssignedAt ??
              now;

            if (
              typeof body.driverName ===
              "string"
            ) {
              nextOrder.driverName =
                body.driverName;
            }

            if (
              typeof body.courierEtaMins ===
              "number"
            ) {
              nextOrder.courierEtaMins =
                body.courierEtaMins;
            }
          }

          if (
            action ===
            "PICKED_UP"
          ) {
            nextOrder.pickedUpAt =
              currentOrder.pickedUpAt ??
              now;
          }

          if (
            action ===
            "DISPATCHED"
          ) {
            nextOrder.dispatchedAt =
              currentOrder.dispatchedAt ??
              now;
          }

          if (
            action ===
            "CANCELLED"
          ) {
            nextOrder.cancellationSource =
              body.cancellationSource ??
              "MANUAL";

            nextOrder.cancellationReason =
              typeof body.cancellationReason ===
              "string"
                ? body.cancellationReason
                : "Order cancelled";

            nextOrder.cancelledBy =
              employee.employeeCode;
          }

          return nextOrder;
        }
      );

    return NextResponse.json({
      order: updatedOrder,
    });
  } catch (error) {
    console.error(
      "PATCH /api/orders failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to update order",
      },
      { status: 500 }
    );
  }
}
