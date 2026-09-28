"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  InventoryDecision,
  Order,
} from "@/lib/db";

type OrdersResponse = {
  success: boolean;
  orders?: Order[];
  inventory?: unknown[];
  error?: string;
};

type ActionResponse = {
  success: boolean;
  order?: Order;
  error?: string;
};

function getEmployeeCode(): string {
  if (
    typeof document === "undefined"
  ) {
    return "";
  }

  const cookie =
    document.cookie
      .split("; ")
      .find((item) =>
        item.startsWith(
          "employee_code="
        )
      );

  return cookie
    ? decodeURIComponent(
        cookie.split("=")[1]
      )
    : "";
}

function formatTime(
  timestamp?: string
): string {
  if (!timestamp) {
    return "Not recorded";
  }

  return new Date(
    timestamp
  ).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInventoryLabel(
  decision?: InventoryDecision
): string {
  switch (decision) {
    case "LOW_STOCK":
      return "Stock low";

    case "INSUFFICIENT_STOCK":
      return "Insufficient stock";

    case "AVAILABLE":
      return "Stock available";

    default:
      return "Inventory unchecked";
  }
}

function getInventoryClass(
  decision?: InventoryDecision
): string {
  switch (decision) {
    case "LOW_STOCK":
      return "border-amber-700 bg-amber-950/40 text-amber-300";

    case "INSUFFICIENT_STOCK":
      return "border-red-700 bg-red-950/40 text-red-300";

    case "AVAILABLE":
      return "border-emerald-700 bg-emerald-950/40 text-emerald-300";

    default:
      return "border-slate-700 bg-slate-900 text-slate-400";
  }
}

function getStatusLabel(
  status: Order["status"]
): string {
  switch (status) {
    case "PENDING":
      return "Queued";

    case "PREPARING":
      return "Cooking";

    case "READY_FOR_PICKUP":
      return "Ready";

    case "DRIVER_ASSIGNED":
      return "Driver assigned";

    case "PICKED_UP":
      return "Picked up";

    case "DISPATCHED":
      return "Dispatched";

    case "CANCELLED":
      return "Cancelled";

    default:
      return status;
  }
}

export default function CookPage() {
  const [
    orders,
    setOrders,
  ] = useState<Order[]>([]);

  const [
    employeeCode,
    setEmployeeCode,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    actionOrderId,
    setActionOrderId,
  ] = useState("");

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
            (await response.json()) as OrdersResponse;

          if (!response.ok) {
            throw new Error(
              data.error ||
                "Unable to load orders"
            );
          }

          setOrders(
            data.orders ?? []
          );

          setError("");
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load orders"
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    setEmployeeCode(
      getEmployeeCode()
    );

    void loadOrders();

    const interval =
      window.setInterval(
        () => {
          void loadOrders();
        },
        3000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [loadOrders]);

  const activeOrders =
    useMemo(
      () =>
        orders.filter(
          (order) =>
            order.status ===
              "PENDING" ||
            order.status ===
              "PREPARING"
        ),
      [orders]
    );

  const readyCount =
    useMemo(
      () =>
        orders.filter(
          (order) =>
            order.status ===
            "READY_FOR_PICKUP"
        ).length,
      [orders]
    );

  async function updateOrder(
    orderId: string,
    status: Order["status"]
  ) {
    setActionOrderId(
      orderId
    );
    setError("");

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
              status,
            }),
          }
        );

      const data =
        (await response.json()) as ActionResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update order"
        );
      }

      await loadOrders();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to update order"
      );
    } finally {
      setActionOrderId("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              Dark Cloud Kitchen OS
            </p>

            <h1 className="mt-1 text-2xl font-bold">
              Cook KDS
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Employee:{" "}
              {employeeCode ||
                "Authenticated"}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Ready
            </p>

            <p className="text-2xl font-bold">
              {readyCount}
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-5">
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300"
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
            <p className="text-xl font-semibold">
              Kitchen queue clear
            </p>

            <p className="mt-2 text-sm text-slate-500">
              New accepted orders will
              appear automatically.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeOrders.map(
              (order) => {
                const busy =
                  actionOrderId ===
                  order.id;

                return (
                  <article
                    key={order.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                          {order.id}
                        </p>

                        <h2 className="mt-1 text-lg font-bold">
                          {order.brandId}
                        </h2>

                        <p className="text-sm text-slate-400">
                          {order.channel}
                        </p>
                      </div>

                      <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-medium text-slate-300">
                        {getStatusLabel(
                          order.status
                        )}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      {order.items.map(
                        (item) => (
                          <div
                            key={
                              item.id
                            }
                            className="rounded-xl bg-slate-950 px-3 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium">
                                {item.name}
                              </span>

                              <span className="rounded-md bg-slate-800 px-2 py-1 text-sm font-bold">
                                ×
                                {
                                  item.quantity
                                }
                              </span>
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              Station:{" "}
                              {
                                item.station
                              }
                            </p>

                            {item.notes && (
                              <p className="mt-2 text-sm text-slate-300">
                                Note:{" "}
                                {
                                  item.notes
                                }
                              </p>
                            )}
                          </div>
                        )
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span>
                        Received{" "}
                        {formatTime(
                          order.receivedAt
                        )}
                      </span>

                      <span>
                        Kitchen{" "}
                        {
                          order.kitchenId
                        }
                      </span>
                    </div>

                    <div
                      className={`mt-4 rounded-xl border px-3 py-2 text-sm ${getInventoryClass(
                        order.inventoryDecision
                      )}`}
                    >
                      <div className="font-medium">
                        {getInventoryLabel(
                          order.inventoryDecision
                        )}
                      </div>

                      {order.inventoryWarnings &&
                        order
                          .inventoryWarnings
                          .length >
                          0 && (
                          <p className="mt-1 text-xs">
                            Low:{" "}
                            {order.inventoryWarnings.join(
                              ", "
                            )}
                          </p>
                        )}

                      {order.inventoryUnavailable &&
                        order
                          .inventoryUnavailable
                          .length >
                          0 && (
                          <p className="mt-1 text-xs">
                            Unavailable:{" "}
                            {order.inventoryUnavailable.join(
                              ", "
                            )}
                          </p>
                        )}
                    </div>

                    <div className="mt-5">
                      {order.status ===
                        "PENDING" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void updateOrder(
                              order.id,
                              "PREPARING"
                            )
                          }
                          className="min-h-14 w-full rounded-xl bg-white px-4 py-3 text-base font-bold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy
                            ? "Starting..."
                            : "Start Cooking"}
                        </button>
                      )}

                      {order.status ===
                        "PREPARING" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void updateOrder(
                              order.id,
                              "READY_FOR_PICKUP"
                            )
                          }
                          className="min-h-14 w-full rounded-xl bg-emerald-500 px-4 py-3 text-base font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy
                            ? "Updating..."
                            : "Mark Ready"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>
    </main>
  );
}
