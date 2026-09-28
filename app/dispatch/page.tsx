"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  Order,
  OrderStatus,
} from "@/lib/db";

type ApiResponse = {
  orders?: Order[];
  error?: string;
};

function formatTime(
  value?: string
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(
  status: OrderStatus
): string {
  return status.replaceAll("_", " ");
}

const DISPATCH_STATUSES: OrderStatus[] = [
  "READY_FOR_PICKUP",
  "DRIVER_ASSIGNED",
  "PICKED_UP",
];

export default function DispatchPage() {
  const [orders, setOrders] =
    useState<Order[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [updatingOrderId, setUpdatingOrderId] =
    useState<string | null>(null);

  const loadOrders = useCallback(
    async () => {
      try {
        const response = await fetch(
          "/api/orders",
          {
            cache: "no-store",
          }
        );

        const data =
          (await response.json()) as ApiResponse;

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Unable to load orders"
          );
        }

        setOrders(data.orders ?? []);
        setError("");
      } catch (err) {
        console.error(
          "Dispatch orders load failed:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load orders"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadOrders();

    const interval =
      window.setInterval(
        () => {
          void loadOrders();
        },
        5000
      );

    return () =>
      window.clearInterval(interval);
  }, [loadOrders]);

  async function updateOrder(
    orderId: string,
    action: OrderStatus,
    driverName?: string,
    courierEtaMins?: number
  ) {
    if (updatingOrderId) {
      return;
    }

    setUpdatingOrderId(orderId);

    try {
      const response = await fetch(
        "/api/orders",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            orderId,
            action,
            ...(driverName
              ? { driverName }
              : {}),
            ...(typeof courierEtaMins ===
            "number"
              ? { courierEtaMins }
              : {}),
          }),
        }
      );

      const data =
        (await response.json()) as {
          order?: Order;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to update order"
        );
      }

      if (data.order) {
        setOrders((current) =>
          current.map((order) =>
            order.id ===
            data.order!.id
              ? data.order!
              : order
          )
        );
      }

      setError("");
    } catch (err) {
      console.error(
        "Dispatch order update failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update order"
      );
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function assignDriver(
    order: Order
  ) {
    const driverName =
      window.prompt(
        "Driver name",
        order.driverName ?? ""
      );

    if (!driverName?.trim()) {
      return;
    }

    const etaInput =
      window.prompt(
        "Courier ETA in minutes",
        order.courierEtaMins
          ? String(
              order.courierEtaMins
            )
          : "15"
      );

    const courierEtaMins =
      Number(etaInput);

    if (
      !Number.isFinite(
        courierEtaMins
      ) ||
      courierEtaMins < 0
    ) {
      setError(
        "Courier ETA must be a valid non-negative number."
      );
      return;
    }

    await updateOrder(
      order.id,
      "DRIVER_ASSIGNED",
      driverName.trim(),
      courierEtaMins
    );
  }

  const dispatchOrders =
    orders
      .filter((order) =>
        DISPATCH_STATUSES.includes(
          order.status
        )
      )
      .sort(
        (a, b) =>
          new Date(
            a.createdAt
          ).getTime() -
          new Date(
            b.createdAt
          ).getTime()
      );

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-slate-400">
              Dark OS
            </p>

            <h1 className="text-2xl font-bold sm:text-3xl">
              Dispatch Station
            </h1>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadOrders()
            }
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 active:scale-[0.98]"
          >
            Refresh
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-800 bg-red-950/60 p-4 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
            Loading dispatch orders...
          </div>
        ) : dispatchOrders.length ===
          0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <p className="text-lg font-semibold">
              No dispatch orders
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Orders marked ready by
              the cook station will
              appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {dispatchOrders.map(
              (order) => {
                const isUpdating =
                  updatingOrderId ===
                  order.id;

                return (
                  <section
                    key={order.id}
                    className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
                  >
                    <div className="border-b border-slate-800 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-bold">
                              {order.id}
                            </h2>

                            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold">
                              {statusLabel(
                                order.status
                              )}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-400">
                            {order.brandId} ·{" "}
                            {order.kitchenId} ·{" "}
                            {formatTime(
                              order.createdAt
                            )}
                          </p>
                        </div>

                        <div className="text-right text-sm text-slate-300">
                          {order.driverName && (
                            <p>
                              Driver:{" "}
                              <span className="font-semibold">
                                {
                                  order.driverName
                                }
                              </span>
                            </p>
                          )}

                          {typeof order.courierEtaMins ===
                            "number" && (
                            <p className="mt-1 text-slate-400">
                              ETA:{" "}
                              {
                                order.courierEtaMins
                              }{" "}
                              min
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 p-4">
                      <div className="space-y-2">
                        {order.items.map(
                          (
                            item,
                            index
                          ) => (
                            <div
                              key={`${order.id}-${item.menuItemId}-${index}`}
                              className="rounded-xl bg-slate-950 px-4 py-3"
                            >
                              <p className="font-semibold">
                                {item.quantity} ×{" "}
                                {
                                  item.menuItemId
                                }
                              </p>
                            </div>
                          )
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {order.status ===
                          "READY_FOR_PICKUP" && (
                          <button
                            type="button"
                            disabled={
                              isUpdating
                            }
                            onClick={() =>
                              void assignDriver(
                                order
                              )
                            }
                            className="min-h-16 rounded-xl bg-amber-600 px-5 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]"
                          >
                            {isUpdating
                              ? "UPDATING..."
                              : "ASSIGN DRIVER"}
                          </button>
                        )}

                        {order.status ===
                          "DRIVER_ASSIGNED" && (
                          <button
                            type="button"
                            disabled={
                              isUpdating
                            }
                            onClick={() =>
                              void updateOrder(
                                order.id,
                                "PICKED_UP"
                              )
                            }
                            className="min-h-16 rounded-xl bg-blue-600 px-5 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]"
                          >
                            {isUpdating
                              ? "UPDATING..."
                              : "MARK PICKED UP"}
                          </button>
                        )}

                        {order.status ===
                          "PICKED_UP" && (
                          <button
                            type="button"
                            disabled={
                              isUpdating
                            }
                            onClick={() =>
                              void updateOrder(
                                order.id,
                                "DISPATCHED"
                              )
                            }
                            className="min-h-16 rounded-xl bg-emerald-600 px-5 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]"
                          >
                            {isUpdating
                              ? "UPDATING..."
                              : "DISPATCH ORDER"}
                          </button>
                        )}
                      </div>
                    </div>
                  </section>
                );
              }
            )}
          </div>
        )}
      </div>
    </main>
  );
}
