"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Order, OrderStatus } from "@/lib/db";

const POLL_INTERVAL_MS = 3000;

function statusLabel(status: OrderStatus): string {
  switch (status) {
    case "PENDING":
      return "NEW";
    case "PREPARING":
      return "PREPARING";
    case "READY_FOR_PICKUP":
      return "READY";
    case "DISPATCHED":
      return "DISPATCHED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return status;
  }
}

function statusClass(status: OrderStatus): string {
  switch (status) {
    case "PENDING":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    case "PREPARING":
      return "border-sky-500/40 bg-sky-500/10 text-sky-300";
    case "READY_FOR_PICKUP":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "CANCELLED":
      return "border-red-500/40 bg-red-500/10 text-red-300";
    default:
      return "border-neutral-700 bg-neutral-900 text-neutral-400";
  }
}

export default function CookDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/orders", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load orders");
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.orders)) {
        throw new Error("Invalid Orders API response");
      }

      setOrders(data.orders);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load kitchen orders",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();

    const interval = window.setInterval(() => {
      void loadOrders();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadOrders]);

  const kitchenOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status === "PENDING" ||
          order.status === "PREPARING",
      ),
    [orders],
  );

  const readyCount = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "READY_FOR_PICKUP",
      ).length,
    [orders],
  );

  const updateOrder = async (
    order: Order,
    status: "PREPARING" | "READY_FOR_PICKUP",
  ) => {
    if (busyOrderId) {
      return;
    }

    setBusyOrderId(order.id);
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
          status,
          actor: "COOK",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to update order",
        );
      }

      if (Array.isArray(data.orders)) {
        setOrders(data.orders);
      } else {
        await loadOrders();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update order",
      );
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/95 px-4 py-4 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <h1 className="text-lg font-bold tracking-tight md:text-xl">
                Cook KDS
              </h1>
            </div>

            <p className="mt-1 text-xs text-neutral-500">
              Kitchen K1 · Live order preparation
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                Cooking
              </div>
              <div className="text-lg font-bold text-sky-300">
                {
                  orders.filter(
                    (order) =>
                      order.status === "PREPARING",
                  ).length
                }
              </div>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                Ready
              </div>
              <div className="text-lg font-bold text-emerald-300">
                {readyCount}
              </div>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto max-w-7xl px-4 pt-4 md:px-6">
          <div className="rounded-lg border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        </div>
      )}

      <section className="mx-auto max-w-7xl px-4 py-5 md:px-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">
              Active Kitchen Queue
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              {loading
                ? "Loading orders..."
                : `${kitchenOrders.length} active order${
                    kitchenOrders.length === 1
                      ? ""
                      : "s"
                  }`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadOrders()}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-sm text-neutral-500">
            Loading kitchen queue...
          </div>
        )}

        {!loading && kitchenOrders.length === 0 && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-10 text-center">
            <div className="text-lg font-semibold text-neutral-300">
              Kitchen queue clear
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              New orders will appear automatically.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kitchenOrders.map((order) => {
            const isBusy = busyOrderId === order.id;
            const isPending = order.status === "PENDING";

            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900"
              >
                <div className="border-b border-neutral-800 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-bold">
                        {order.id}
                      </div>

                      <div className="mt-1 text-xs text-neutral-500">
                        {order.channel} · {order.brandId}
                      </div>
                    </div>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${statusClass(
                        order.status,
                      )}`}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <div className="space-y-3">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-neutral-800 bg-neutral-950 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-semibold text-white">
                            {item.quantity} × {item.name}
                          </div>

                          <span className="text-[10px] uppercase text-neutral-600">
                            {item.station}
                          </span>
                        </div>

                        {item.notes && (
                          <div className="mt-2 rounded-md border border-amber-800/50 bg-amber-950/20 px-2 py-2 text-xs text-amber-300">
                            Note: {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {order.inventoryWarnings &&
                    order.inventoryWarnings.length > 0 && (
                      <div className="rounded-lg border border-amber-800 bg-amber-950/20 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          Inventory Warning
                        </div>

                        <div className="mt-1 text-xs text-amber-200">
                          Stock is sufficient for this order,
                          but one or more ingredients are at or
                          below the reorder threshold.
                        </div>
                      </div>
                    )}

                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-600">
                    <span>
                      {order.source}
                    </span>

                    <span>
                      {order.kitchenId}
                    </span>
                  </div>

                  {isPending ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void updateOrder(
                          order,
                          "PREPARING",
                        )
                      }
                      className="w-full rounded-lg bg-amber-400 px-4 py-3 text-sm font-bold uppercase tracking-wide text-neutral-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isBusy
                        ? "Starting..."
                        : "Start Cooking"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void updateOrder(
                          order,
                          "READY_FOR_PICKUP",
                        )
                      }
                      className="w-full rounded-lg bg-emerald-400 px-4 py-3 text-sm font-bold uppercase tracking-wide text-neutral-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isBusy
                        ? "Updating..."
                        : "Mark Ready for Pickup"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
