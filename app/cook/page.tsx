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

const ACTIVE_STATUSES: OrderStatus[] = [
  "PENDING",
  "PREPARING",
];

function formatTime(
  value?: string
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function getStatusLabel(
  status: OrderStatus
): string {
  switch (status) {
    case "PENDING":
      return "NEW";

    case "PREPARING":
      return "PREPARING";

    case "READY_FOR_PICKUP":
      return "READY";

    default:
      return status.replaceAll(
        "_",
        " "
      );
  }
}

export default function CookPage() {
  const [orders, setOrders] =
    useState<Order[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [updatingOrderId, setUpdatingOrderId] =
    useState<string | null>(null);

  const loadOrders =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
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

          setOrders(
            data.orders ?? []
          );

          setError("");
        } catch (err) {
          console.error(
            "Cook orders load failed:",
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
      window.clearInterval(
        interval
      );
  }, [loadOrders]);

  async function updateOrder(
    orderId: string,
    action: OrderStatus
  ) {
    if (updatingOrderId) {
      return;
    }

    setUpdatingOrderId(
      orderId
    );

    try {
      const response =
        await fetch(
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
            }),
          }
        );

      const data =
        (await response.json()) as {
          order?: Order;
          error?: string;
          inventoryUnavailable?: string[];
        };

      if (!response.ok) {
        const unavailable =
          data.inventoryUnavailable;

        if (
          unavailable &&
          unavailable.length > 0
        ) {
          throw new Error(
            `Insufficient stock: ${unavailable.join(", ")}`
          );
        }

        throw new Error(
          data.error ??
            "Unable to update order"
        );
      }

      if (data.order) {
        setOrders(
          (current) =>
            current.map(
              (order) =>
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
        "Cook order update failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update order"
      );
    } finally {
      setUpdatingOrderId(
        null
      );
    }
  }

  const activeOrders =
    orders
      .filter((order) =>
        ACTIVE_STATUSES.includes(
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
              Cook Station
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
            Loading kitchen orders...
          </div>
        ) : activeOrders.length ===
          0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <p className="text-lg font-semibold">
              No active orders
            </p>

            <p className="mt-2 text-sm text-slate-400">
              New orders will appear
              automatically.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {activeOrders.map(
              (order) => {
                const isUpdating =
                  updatingOrderId ===
                  order.id;

                const hasWarnings =
                  Boolean(
                    order.inventoryWarnings
                      ?.length
                  );

                const hasUnavailable =
                  Boolean(
                    order
                      .inventoryUnavailable
                      ?.length
                  );

                return (
                  <section
                    key={order.id}
                    className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-bold">
                            {order.id}
                          </h2>

                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold">
                            {getStatusLabel(
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

                      {order.customerName && (
                        <p className="text-sm text-slate-300">
                          Customer:{" "}
                          <span className="font-semibold">
                            {
                              order.customerName
                            }
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="space-y-4 p-4">
                      <div className="space-y-3">
                        {order.items.map(
                          (item, index) => (
                            <div
                              key={`${order.id}-${item.menuItemId}-${index}`}
                              className="rounded-xl bg-slate-950 p-4"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-semibold">
                                    {item.quantity} ×{" "}
                                    {
                                      item.menuItemId
                                    }
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>

                      {hasWarnings && (
                        <div className="rounded-xl border border-amber-800 bg-amber-950/40 p-4">
                          <p className="font-semibold text-amber-300">
                            Inventory warning
                          </p>

                          <p className="mt-1 text-sm text-amber-200">
                            Stock is sufficient
                            for this order,
                            but one or more
                            ingredients are at
                            or below the reorder
                            threshold.
                          </p>

                          <p className="mt-2 text-sm text-amber-300">
                            {order.inventoryWarnings!.join(
                              ", "
                            )}
                          </p>
                        </div>
                      )}

                      {hasUnavailable && (
                        <div className="rounded-xl border border-red-800 bg-red-950/50 p-4">
                          <p className="font-semibold text-red-300">
                            Inventory unavailable
                          </p>

                          <p className="mt-1 text-sm text-red-200">
                           
