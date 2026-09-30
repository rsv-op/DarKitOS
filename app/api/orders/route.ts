import { NextRequest, NextResponse } from "next/server";

import {
  EMPLOYEES_DB,
  PERMISSIONS_DB,
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
} from "@/lib/store";

import { getEmployeeFromCookie } from "@/lib/domain/auth-service";
import { hasPermission } from "@/lib/domain/permission-service";

export const dynamic = "force-dynamic";

function getEmployee(
  request: NextRequest
): Employee | null {
  return getEmployeeFromCookie(
    request.cookies.get("employee_code")?.value
  );
}

function canAccessOrder(
  employee: Employee,
  order: Order
): boolean {
  if (employee.role === "OWNER") {
    return true;
  }

  return (
    employee.kitchenId ===
    order.kitchenId
  );
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
    timestamp:
      new Date().toISOString(),
    actor,
    ...(details
      ? { details }
      : {}),
  };
}

function isValidOrderTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus
): boolean {
  if (
    currentStatus ===
    nextStatus
  ) {
    return false;
  }

  const transitions: Record<
    OrderStatus,
    OrderStatus[]
  > = {
    PENDING: [
      "PREPARING",
      "CANCELLED",
    ],
    PREPARING: [
      "READY_FOR_PICKUP",
      "CANCELLED",
    ],
    READY_FOR_PICKUP: [
      "DRIVER_ASSIGNED",
      "CANCELLED",
    ],
    DRIVER_ASSIGNED: [
      "PICKED_UP",
      "CANCELLED",
    ],
    PICKED_UP: [
      "DISPATCHED",
    ],
    DISPATCHED: [],
    CANCELLED: [],
  };

  return transitions[
    currentStatus
  ].includes(nextStatus);
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
          error:
            "Unauthorized",
        },
        { status: 401 }
      );
    }

    const orders =
      getOrders();

    const visibleOrders =
      orders.filter(
        (order) =>
          canAccessOrder(
            employee,
            order
          )
      );

    return NextResponse.json({
      orders:
        visibleOrders,
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
        {
          error:
            "Unauthorized",
        },
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
        {
          error:
            "Forbidden",
        },
        { status: 403 }
      );
    }

    const body =
      await request.json();

    if (
      !body ||
      typeof body !==
        "object"
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

    const order =
      {
        ...body,
        status: "PENDING",
        createdAt:
          body.createdAt ??
          now,
        updatedAt: now,
        receivedAt:
          body.receivedAt ??
          now,
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

    if (
      !Array.isArray(
        order.items
      ) ||
      order.items.length ===
        0
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
      employee.role !==
        "OWNER" &&
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

    const inventory =
      getInventory();

    const evaluation =
      evaluateOrderInventory(
        order,
        inventory
      );

    const inventoryEvents = [
      createEvent(
        "INVENTORY_CHECKED",
        employee.employeeCode,
        `Inventory decision: ${evaluation.inventoryDecision}`
      ),
    ];

    if (
      evaluation.lowStockItems
        .length > 0
    ) {
      inventoryEvents.push(
        createEvent(
          "INVENTORY_WARNING",
          employee.employeeCode,
          `Low stock: ${evaluation.lowStockItems.join(", ")}`
        )
      );
    }

    if (
      evaluation
        .insufficientStockItems
        .length > 0
    ) {
      inventoryEvents.push(
        createEvent(
          "INVENTORY_UNAVAILABLE",
          employee.employeeCode,
          `Insufficient stock: ${evaluation.insufficientStockItems.join(", ")}`
        )
      );
    }

    const orderWithInventory =
      {
        ...order,
        inventoryDecision:
          evaluation.inventoryDecision,
        inventoryWarnings:
          evaluation.lowStockItems,
        inventoryUnavailable:
          evaluation.insufficientStockItems,
        events: [
          ...order.events,
          ...inventoryEvents,
        ],
      };

    addOrder(
      orderWithInventory
    );

    return NextResponse.json(
      {
        order:
          orderWithInventory,
        inventoryDecision:
          evaluation.inventoryDecision,
        inventoryWarnings:
          evaluation.lowStockItems,
        inventoryUnavailable:
          evaluation.insufficientStockItems,
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
        {
          error:
            "Unauthorized",
        },
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
          order.id ===
          orderId
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
        {
          error:
            "Forbidden",
        },
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
      !isValidOrderTransition(
        existingOrder.status,
        action
      )
    ) {
      return NextResponse.json(
        {
          error:
            `Invalid order transition: ${existingOrder.status} -> ${action}`,
        },
        { status: 409 }
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

    if (
      action ===
      "PREPARING"
    ) {
      const result =
        transaction(
          (state) => {
            const currentOrder =
              state.orders.find(
                (order) =>
                  order.id ===
                  orderId
              );

            if (
              !currentOrder
            ) {
              throw new Error(
                `Order not found: ${orderId}`
              );
            }

            const currentInventory =
              state.inventory;

            const evaluation =
              evaluateOrderInventory(
                currentOrder,
                currentInventory
              );

            if (
              evaluation.inventoryDecision ===
              "INSUFFICIENT_STOCK"
            ) {
              throw new Error(
                `INSUFFICIENT_STOCK:${evaluation.insufficientStockItems.join(", ")}`
              );
            }

            const depletion =
              processOrderDepletion(
                currentOrder,
                currentInventory
              );

            state.inventory =
              depletion.updatedInventory;

            const nextOrder =
              {
                ...currentOrder,
                status:
                  "PREPARING",
                updatedAt: now,
                acceptedAt:
                  currentOrder.acceptedAt ??
                  now,
                prepStartedAt:
                  currentOrder.prepStartedAt ??
                  now,
                inventoryDecision:
                  depletion.inventoryDecision,
                inventoryWarnings:
                  depletion.lowStockAlerts,
                inventoryUnavailable:
                  depletion.insufficientStockItems,
                events: [
                  ...currentOrder.events,

                  createEvent(
                    "INVENTORY_CHECKED",
                    employee.employeeCode,
                    `Inventory decision: ${depletion.inventoryDecision}`
                  ),

                  createEvent(
                    "ACCEPTED",
                    employee.employeeCode,
                    "Order accepted for preparation"
                  ),

                  ...(depletion.lowStockAlerts
                    .length > 0
                    ? [
                        createEvent(
                          "INVENTORY_WARNING",
                          employee.employeeCode,
                          `Low stock: ${depletion.lowStockAlerts.join(", ")}`
                        ),
                      ]
                    : []),

                  createEvent(
                    "PREPARING",
                    employee.employeeCode
                  ),
                ],
              } as Order;

            const orderIndex =
              state.orders.findIndex(
                (order) =>
                  order.id ===
                  orderId
              );

            state.orders[
              orderIndex
            ] = {
              ...nextOrder,
              items:
                nextOrder.items.map(
                  (item) => ({
                    ...item,
                  })
                ),
              events:
                nextOrder.events.map(
                  (event) => ({
                    ...event,
                  })
                ),
              inventoryWarnings:
                nextOrder.inventoryWarnings
                  ? [
                      ...nextOrder.inventoryWarnings,
                    ]
                  : undefined,
              inventoryUnavailable:
                nextOrder.inventoryUnavailable
                  ? [
                      ...nextOrder.inventoryUnavailable,
                    ]
                  : undefined,
            };

            return nextOrder;
          }
        );

      return NextResponse.json({
        order: result,
      });
    }

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
      order:
        updatedOrder,
    });
  } catch (error) {
    console.error(
      "PATCH /api/orders failed:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message.startsWith(
        "INSUFFICIENT_STOCK:"
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Order cannot enter preparation because required inventory is insufficient.",
          inventoryUnavailable:
            message
              .replace(
                "INSUFFICIENT_STOCK:",
                ""
              )
              .split(",")
              .filter(Boolean),
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Unable to update order",
      },
      { status: 500 }
    );
  }
}
