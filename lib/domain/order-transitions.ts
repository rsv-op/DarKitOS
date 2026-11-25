import type {
  CancellationSource,
  Employee,
  OrderStatus,
} from "@/lib/db";
import {
  canAccessKitchen,
  hasPermission,
} from "@/lib/domain/permission-service";
import {
  findOrder,
  transitionCanonicalOrder,
  type TransitionOrderResult,
} from "@/lib/store";

const ALLOWED_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "PENDING",
  "PREPARING",
  "READY_FOR_PICKUP",
  "DRIVER_ASSIGNED",
  "PICKED_UP",
  "DISPATCHED",
  "CANCELLED",
]);

export interface ExecuteOrderTransitionParams {
  employee: Employee;
  orderId: string;
  nextStatusRaw: string;
  driverName?: string;
  courierEtaMins?: number;
  cancellationSource?: CancellationSource;
  cancellationReason?: string;
  restoreInventoryOnPrePrepCancel?: boolean;
}

export type OrderTransitionOutcome =
  | {
      ok: true;
      status: 200;
      result: TransitionOrderResult;
    }
  | {
      ok: false;
      status: 400 | 403 | 404 | 409;
      error: string;
    };

export function executeAuthorizedOrderTransition(
  params: ExecuteOrderTransitionParams,
): OrderTransitionOutcome {
  const { employee, orderId, nextStatusRaw } = params;
  const cleanOrderId = orderId.trim();
  const nextStatus = nextStatusRaw.trim() as OrderStatus;

  if (!cleanOrderId || !nextStatus) {
    return {
      ok: false,
      status: 400,
      error: "Both orderId and status/action are required",
    };
  }

  if (!ALLOWED_ORDER_STATUSES.has(nextStatus)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid order status: ${nextStatusRaw}`,
    };
  }

  // 1. Role-based permission checks per target status
  if (
    nextStatus === "PREPARING" ||
    nextStatus === "READY_FOR_PICKUP"
  ) {
    if (
      !hasPermission(employee, "COOK_ORDERS") &&
      !hasPermission(employee, "OWNER_VIEW")
    ) {
      return {
        ok: false,
        status: 403,
        error: "Forbidden: Requires COOK_ORDERS permission",
      };
    }
  } else if (
    nextStatus === "DRIVER_ASSIGNED" ||
    nextStatus === "PICKED_UP" ||
    nextStatus === "DISPATCHED"
  ) {
    if (
      !hasPermission(employee, "DISPATCH_ORDERS") &&
      !hasPermission(employee, "OWNER_VIEW")
    ) {
      return {
        ok: false,
        status: 403,
        error: "Forbidden: Requires DISPATCH_ORDERS permission",
      };
    }
  } else if (nextStatus === "CANCELLED") {
    if (
      !hasPermission(employee, "ORDER_CANCEL") &&
      !hasPermission(employee, "OWNER_VIEW")
    ) {
      return {
        ok: false,
        status: 403,
        error: "Forbidden: Requires ORDER_CANCEL permission",
      };
    }
  }

  // 2. Existence & kitchen-scope check before mutating canonical state
  const existingOrder = findOrder(cleanOrderId);
  if (!existingOrder) {
    return {
      ok: false,
      status: 404,
      error: `Order not found: ${cleanOrderId}`,
    };
  }

  if (!canAccessKitchen(employee, existingOrder.kitchenId)) {
    return {
      ok: false,
      status: 403,
      error: `Forbidden: Employee ${employee.employeeCode} (${employee.kitchenId}) cannot modify orders belonging to kitchen ${existingOrder.kitchenId}.`,
    };
  }

  // 3. Execute atomic canonical state transition
  try {
    const actorLabel = `${employee.employeeCode} (${employee.name})`;
    const result = transitionCanonicalOrder({
      orderId: cleanOrderId,
      nextStatus,
      actor: actorLabel,
      driverName: params.driverName,
      courierEtaMins: params.courierEtaMins,
      cancellationSource: params.cancellationSource,
      cancellationReason: params.cancellationReason,
      restoreInventoryOnPrePrepCancel:
        params.restoreInventoryOnPrePrepCancel,
    });
    return {
      ok: true,
      status: 200,
      result,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update order status";
    const status = message.includes("Order not found")
      ? 404
      : message.includes("Invalid status transition") ||
          message.includes("Insufficient inventory")
        ? 409
        : 400;
    return {
      ok: false,
      status,
      error: message,
    };
  }
}
