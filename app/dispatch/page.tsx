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
  driverName?: string;
  courierEtaMins?: number;
  createdAt: string;
  updatedAt: string;
  readyAt?: string;
  driverAssignedAt?: string;
  pickedUpAt?: string;
  dispatchedAt?: string;
  events: OrderEvent[];
};

type OrdersResponse = {
  orders?: Order[];
  error?: string;
};

const DISPATCH_STATUSES: OrderStatus[] = [
  "READY_FOR_PICKUP",
  "DRIVER_ASSIGNED",
  "PICKED_UP",
];

function formatTime(value?: string): string {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "READY_FOR_PICKUP":
      return "READY";
    case "DRIVER_ASSIGNED":
      return "DRIVER ASSIGNED";
    case "PICKED_UP":
      return "PICKED UP";
    case "DISPATCHED":
      return "DISPATCHED";
    default:
      return status;
  }
}

function getNextAction(
  status: OrderStatus
): {
  action: OrderStatus;
  label: string;
} | null {
  if (status === "READY_FOR_PICKUP") {
    return {
      action: "DRIVER_ASSIGNED",
      label: "ASSIGN DRIVER",
    };
  }

  if (status === "DRIVER_ASSIGNED") {
    return {
      action: "PICKED_UP",
      label: "MARK PICKED UP",
    };
  }

  if (status === "PICKED_UP") {
    return {
      action: "DISPATCHED",
      label: "MARK DISPATCHED",
    };
  }

  return null;
}

export default function DispatchPage() {
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
        (await response.json()) as OrdersResponse;

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to load dispatch orders"
        );
      }

      setOrders(data.orders ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load dispatch orders"
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

  const dispatchOrders = useMemo(
    () =>
      orders
        .filter((order) =>
          DISPATCH_STATUSES.includes(order.status)
        )
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
        ),
    [orders]
  );

  const dispatchedOrders = useMemo(
    () =>
      orders
        .filter(
          (order) => order.status === "DISPATCHED"
        )
        .sort(
          (a, b) =>
            new Date(b.dispatchedAt ?? b.updatedAt).getTime() -
            new Date(a.dispatchedAt ?? a.updatedAt).getTime()
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

      const body: {
        orderId: string;
        action: OrderStatus;
        driverName?: string;
        courierEtaMins?: number;
      } = {
        orderId,
        action,
      };

      if (action === "DRIVER_ASSIGNED") {
        const driverName = window.prompt(
          "Enter driver name"
        );

        if (driverName === null) {
          return;
        }

        const trimmedDriverName =
          driverName.trim();

        if (!trimmedDriverName) {
          setError(
            "Driver name is required before assigning the order."
          );
          return;
        }

        body.driverName =
          trimmedDriverName;

        const etaInput = window.prompt(
          "Enter courier ETA in minutes"
        );

        if (etaInput !== null && etaInput.trim()) {
          const eta = Number(etaInput);

          if (
            !Number.isFinite(eta) ||
            eta < 0
          ) {
            setError(
              "Courier ETA must be a non-negative number."
            );
            return;
          }

          body.courierEtaMins = eta;
        }
      }

      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data =
        (await response.json()) as {
          order?: Order;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to update dispatch order"
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
          : "Unable to update dispatch order"
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
            <div className="text-lg font-bold text-slate-950">
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

        <div className="mt-4 grid grid-cols-2 gap-3">
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
              Kitchen
            </div>
            <div className="font-semibold text-slate-900">
              {order.kitchenId}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">
              Ready
            </div>
            <div className="font-semibold text-slate-900">
              {formatTime(order.readyAt)}
            </div>
          </div>
        </div>

        {order.customerName && (
          <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-500">
              Customer
            </div>
            <div className="font-semibold text-slate-900">
              {order.customerName}
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Order
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

        {order.driverName && (
          <div className="mt-4 rounded-xl border border-slate-200 p-3">
            <div className="text-xs text-slate-500">
              Driver
            </div>

            <div className="font-semibold text-slate-900">
              {order.driverName}
            </div>

            {typeof order.courierEtaMins ===
              "number" && (
              <div className="mt-1 text-xs text-slate-500">
                ETA: {order.courierEtaMins} min
              </div>
            )}
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
              Dispatch
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Pickup and dispatch control
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
            Loading dispatch orders...
          </div>
        ) : (
          <>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  Dispatch Queue
                </h2>

                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                  {dispatchOrders.length}
                </span>
              </div>

              {dispatchOrders.length === 0 ? (
                <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                  No orders currently waiting for dispatch.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {dispatchOrders.map(
                    renderOrderCard
                  )}
                </div>
              )}
            </section>

            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  Recently Dispatched
                </h2>

                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                  {dispatchedOrders.length}
                </span>
              </div>

              {dispatchedOrders.length === 0 ? (
                <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                  No dispatched orders yet.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {dispatchedOrders.map(
                    renderOrderCard
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
