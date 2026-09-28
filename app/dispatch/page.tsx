"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  Order,
} from "@/lib/db";

type OrdersResponse = {
  success: boolean;
  orders?: Order[];
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

function getStatusLabel(
  status: Order["status"]
): string {
  switch (status) {
    case "READY_FOR_PICKUP":
      return "Ready for pickup";

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

export default function DispatchPage() {
  const [
    orders,
    setOrders,
  ] = useState<Order[]>([]);

  const [
    employeeCode,
    setEmployeeCode,
  ] = useState("");

  const [
    driverNames,
    setDriverNames,
  ] = useState<
    Record<string, string>
  >({});

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

  const dispatchOrders =
    useMemo(
      () =>
        orders.filter(
          (order) =>
            order.status ===
              "READY_FOR_PICKUP" ||
            order.status ===
              "DRIVER_ASSIGNED" ||
            order.status ===
              "PICKED_UP"
        ),
      [orders]
    );

  const readyCount =
    dispatchOrders.filter(
      (order) =>
        order.status ===
        "READY_FOR_PICKUP"
    ).length;

  const assignedCount =
    dispatchOrders.filter(
      (order) =>
        order.status ===
        "DRIVER_ASSIGNED"
    ).length;

  async function assignDriver(
    orderId: string
  ) {
    const driverName =
      driverNames[orderId]?.trim();

    if (!driverName) {
      setError(
        "Enter a driver name before assigning the order."
      );
      return;
    }

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
              action:
                "DRIVER_ASSIGNED",
              driverName,
            }),
          }
        );

      const data =
        (await response.json()) as ActionResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to assign driver"
        );
      }

      await loadOrders();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to assign driver"
      );
    } finally {
      setActionOrderId("");
    }
  }

  async function markPickedUp(
    orderId: string
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
              action: "PICKED_UP",
            }),
          }
        );

      const data =
        (await response.json()) as ActionResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to mark order as picked up"
        );
      }

      await loadOrders();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to mark order as picked up"
      );
    } finally {
      setActionOrderId("");
    }
  }

  async function markDispatched(
    orderId: string
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
              status:
                "DISPATCHED",
            }),
          }
        );

      const data =
        (await response.json()) as ActionResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to dispatch order"
        );
      }

      await loadOrders();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to dispatch order"
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
              Dispatch
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Employee:{" "}
              {employeeCode ||
                "Authenticated"}
            </p>
          </div>

          <div className="flex gap-5 text-right">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Ready
              </p>

              <p className="text-2xl font-bold">
                {readyCount}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Assigned
              </p>

              <p className="text-2xl font-bold">
                {assignedCount}
              </p>
            </div>
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
            Loading dispatch queue...
          </div>
        ) : dispatchOrders.length ===
          0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <p className="text-xl font-semibold">
              Dispatch queue clear
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Orders marked ready by
              the kitchen will appear
              here automatically.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dispatchOrders.map(
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

                    <div className="mt-4 rounded-xl bg-slate-950 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">
                          Kitchen
                        </span>

                        <span className="font-medium">
                          {
                            order.kitchenId
                          }
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-slate-500">
                          Ready
                        </span>

                        <span className="font-medium">
                          {formatTime(
                            order.readyAt
                          )}
                        </span>
                      </div>

                      {order.externalOrderId && (
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-slate-500">
                            External ID
                          </span>

                          <span className="max-w-[180px] truncate font-medium">
                            {
                              order.externalOrderId
                            }
                          </span>
                        </div>
                      )}

                      {order.driverName && (
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-slate-500">
                            Driver
                          </span>

                          <span className="font-medium">
                            {
                              order.driverName
                            }
                          </span>
                        </div>
                      )}

                      {order.courierEtaMins !==
                        undefined && (
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-slate-500">
                            Courier ETA
                          </span>

                          <span className="font-medium">
                            {
                              order.courierEtaMins
                            }{" "}
                            min
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      {order.items.map(
                        (item) => (
                          <div
                            key={
                              item.id
                            }
                            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3"
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

                            {item.notes && (
                              <p className="mt-2 text-xs text-slate-400">
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

                    <div className="mt-5">
                      {order.status ===
                        "READY_FOR_PICKUP" && (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={
                              driverNames[
                                order.id
                              ] ??
                              ""
                            }
                            onChange={(
                              event
                            ) =>
                              setDriverNames(
                                (
                                  current
                                ) => ({
                                  ...current,
                                  [order.id]:
                                    event
                                      .target
                                      .value,
                                })
                              )
                            }
                            placeholder="Driver name"
                            className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-base text-white outline-none placeholder:text-slate-600 focus:border-slate-400"
                          />

                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              void assignDriver(
                                order.id
                              )
                            }
                            className="min-h-14 w-full rounded-xl bg-white px-4 py-3 text-base font-bold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busy
                              ? "Assigning..."
                              : "Assign Driver"}
                          </button>
                        </div>
                      )}

                      {order.status ===
                        "DRIVER_ASSIGNED" && (
                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            void markPickedUp(
                              order.id
                            )
                          }
                          className="min-h-14 w-full rounded-xl bg-amber-400 px-4 py-3 text-base font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy
                            ? "Updating..."
                            : "Mark Picked Up"}
                        </button>
                      )}

                      {order.status ===
                        "PICKED_UP" && (
                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            void markDispatched(
                              order.id
                            )
                          }
                          className="min-h-14 w-full rounded-xl bg-emerald-500 px-4 py-3 text-base font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy
                            ? "Dispatching..."
                            : "Dispatch Order"}
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
