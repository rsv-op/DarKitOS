"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type OrderStatus =
  | "PENDING"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "DRIVER_ASSIGNED"
  | "PICKED_UP"
  | "DISPATCHED"
  | "CANCELLED";

type OrderItem = {
  menuItemId: string;
  quantity: number;
  name?: string;
};

type OrderEvent = {
  id: string;
  type: string;
  timestamp: string;
  actor: string;
  details?: string;
};

type Order = {
  id: string;
  externalOrderId?: string;
  brandId: string;
  kitchenId: string;
  channel: string;
  status: OrderStatus;
  items: OrderItem[];
  customerName?: string;
  createdAt: string;
  updatedAt: string;
  receivedAt?: string;
  prepStartedAt?: string;
  readyAt?: string;
  inventoryDecision?: string;
  inventoryWarnings?: string[];
  inventoryUnavailable?: string[];
  events: OrderEvent[];
};

type ApiResponse = {
  orders?: Order[];
  error?: string;
};

const ACTIVE_STATUSES: OrderStatus[] = [
  "PENDING",
  "PREPARING",
];

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNextAction(
  status: OrderStatus
): {
  action: OrderStatus;
  label: string;
} | null {
  if (status === "PENDING") {
    return {
      action: "PREPARING",
      label: "START PREPARING",
    };
  }

  if (status === "PREPARING") {
    return {
      action: "READY_FOR_PICKUP",
      label: "MARK READY",
    };
  }

  return null;
}

function getStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "PENDING":
      return "NEW";
    case "PREPARING":
      return "PREPARING";
    case "READY_FOR_PICKUP":
      return "READY";
    case "DRIVER_ASSIGNED":
      return "DRIVER ASSIGNED";
    case "PICKED_UP":
      return "PICKED UP";
    case "DISPATCHED":
      return "DISPATCHED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return status;
  }
}

export default function CookPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingOrderId, setProcessingOrderId] =
    useState<string | null>(null);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      setError("");

      const response = await fetch("/api/orders", {
        method: "GET",
        cache: "no-store",
      });

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to load orders"
        );
      }

      setOrders(data.orders ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load orders"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();

    const interval = window.setInterval(() => {
      void loadOrders();
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadOrders]);

  const activeOrders = useMemo(
    () =>
      orders
        .filter((order) =>
          ACTIVE_STATUSES.includes(order.status)
        )
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
        ),
    [orders]
  );

  const readyOrders = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            order.status === "READY_FOR_PICKUP"
        )
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
        ),
    [orders]
  );

  async function updateOrder(
    orderId: string,
    action: OrderStatus
  ) {
    try {
      setProcessingOrderId(orderId);
      setError("");

      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          action,
        }),
      });

      const data =
        (await response.json()) as {
          order?: Order;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to update order"
        );
      }

      if (data.order) {
        setOrders((currentOrders) =>
          currentOrders.map((order) =>
            order.id === data.order!.id
              ? data.order!
              : order
          )
        );
      }
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update order"
      );
    } finally {
      setProcessingOrderId(null);
    }
  }

  function renderOrderCard(order: Order) {
    const nextAction = getNextAction(order.status);
    const isProcessing =
      processingOrderId === order.id;

    return (
      <article
        key={order.id}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-slate-900">
              {order.id}
            </div>

            {order.externalOrderId && (
              <div className="text-xs text-slate-500">
                {order.externalOrderId}
              </div>
            )}
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            {getStatusLabel(order.status)}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-xs text-slate-500">
              Brand
            </div>
            <div className="font-semibold text-slate-900">
              {order.brandId}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">
              Channel
            </div>
            <div className="font-semibold text-slate-900">
              {order.channel}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">
              Received
            </div>
            <div className="font-semibold text-slate-900">
              {formatTime(order.receivedAt ?? order.createdAt)}
            </div>
          </div>

          {order.customerName && (
            <div>
              <div className="text-xs text-slate-500">
                Customer
              </div>
              <div className="font-semibold text-slate-900">
                {order.customerName}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Items
          </div>

          <div className="space-y-2">
            {order.items.map((item, index) => (
              <div
                key={`${order.id}-${item.menuItemId}-${index}`}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <span className="font-medium text-slate-900">
                  {item.name ?? item.menuItemId}
                </span>

                <span className="rounded-md bg-white px-2 py-1 text-sm font-bold text-slate-900">
                  ×{item.quantity}
                </span>
              </div>
            ))}
          </div>
        </div>

        {order.inventoryWarnings &&
          order.inventoryWarnings.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-sm font-bold text-amber-800">
                Inventory warning
              </div>

              <div className="mt-1 space-y-1 text-xs text-amber-700">
                {order.inventoryWarnings.map(
                  (warning, index) => (
                    <div key={`${order.id}-warning-${index}`}>
                      {warning}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

        {order.inventoryUnavailable &&
          order.inventoryUnavailable.length > 0 && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="text-sm font-bold text-red-800">
                Inventory unavailable
              </div>

              <div className="mt-1 space-y-1 text-xs text-red-700">
                {order.inventoryUnavailable.map(
                  (item, index) => (
                    <div
                      key={`${order.id}-unavailable-${index}`}
                    >
                      {item}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

        {nextAction && (
          <button
            type="button"
            disabled={isProcessing}
            onClick={() =>
              void updateOrder(
                order.id,
                nextAction.action
              )
            }
            className="mt-4 min-h-14 w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProcessing
              ? "UPDATING..."
              : nextAction.label}
          </button>
        )}
      </article>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-5">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Dark Cloud Kitchen OS
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Cook KDS
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Active kitchen orders
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={loading}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 disabled:opacity-50"
          >
            Refresh
          </button>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-center text-sm font-semibold text-slate-600 shadow-sm">
            Loading kitchen orders...
          </div>
        ) : (
          <>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  Active
                </h2>

                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                  {activeOrders.length}
                </span>
              </div>

              {activeOrders.length === 0 ? (
                <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                  No active kitchen orders.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {activeOrders.map(renderOrderCard)}
                </div>
              )}
            </section>

            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  Ready for Pickup
                </h2>

                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                  {readyOrders.length}
                </span>
              </div>

              {readyOrders.length === 0 ? (
                <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                  No orders waiting for pickup.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {readyOrders.map(renderOrderCard)}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
