"use client";

import { useCallback, useEffect, useState } from "react";

import type { Order } from "@/lib/db";

type ApiResponse = {
  orders: Order[];
};

type ActionType =
  | "DRIVER_ASSIGNED"
  | "PICKED_UP";

export default function DispatchDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [driverNames, setDriverNames] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<
    string | null
  >(null);
  const [error, setError] = useState("");

  const loadOrders = useCallback(
    async (showLoading = false) => {
      try {
        if (showLoading) {
          setLoading(true);
        }

        const response = await fetch(
          "/api/orders",
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load orders.",
          );
        }

        const data =
          (await response.json()) as ApiResponse;

        setOrders(data.orders ?? []);
        setError("");
      } catch (err) {
        console.error(err);

        setError(
          "Unable to connect to the order system.",
        );
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadOrders(true);

    const interval = window.setInterval(
      () => {
        void loadOrders();
      },
      3000,
    );

    return () =>
      window.clearInterval(interval);
  }, [loadOrders]);

  const performAction = async (
    order: Order,
    action: ActionType,
  ) => {
    setError("");
    setBusyOrderId(order.id);

    try {
      const driverName =
        driverNames[order.id]?.trim();

      if (
        action ===
          "DRIVER_ASSIGNED" &&
        !driverName
      ) {
        setError(
          `Enter a driver name for ${order.id}.`,
        );
        return;
      }

      const response = await fetch(
        "/api/orders",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            orderId: order.id,
            action,
            actor: "DISPATCH",
            source: "MANUAL",
            ...(action ===
              "DRIVER_ASSIGNED"
              ? {
                  driverName,
                }
              : {}),
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update order.",
        );
      }

      setOrders(
        data.orders ?? [],
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update order.",
      );
    } finally {
      setBusyOrderId(null);
    }
  };

  const dispatchOrder = async (
    order: Order,
  ) => {
    setError("");
    setBusyOrderId(order.id);

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
            orderId: order.id,
            status: "DISPATCHED",
            actor: "DISPATCH",
            source: "MANUAL",
            driverName:
              order.driverName,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to dispatch order.",
        );
      }

      setOrders(
        data.orders ?? [],
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to dispatch order.",
      );
    } finally {
      setBusyOrderId(null);
    }
  };

  const readyOrders =
    orders.filter(
      (order) =>
        order.status ===
          "READY_FOR_PICKUP" ||
        order.status ===
          "DRIVER_ASSIGNED" ||
        order.status ===
          "PICKED_UP",
    );

  const preparingOrders =
    orders.filter(
      (order) =>
        order.status ===
        "PREPARING",
    );

  const dispatchedOrders =
    orders.filter(
      (order) =>
        order.status ===
        "DISPATCHED",
    );

  const cancelledOrders =
    orders.filter(
      (order) =>
        order.status ===
        "CANCELLED",
    );

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.25em] text-sky-400">
                K1 • Dispatch Station
              </p>

              <h1 className="text-2xl md:text-3xl font-bold mt-1">
                Dispatch Control
              </h1>

              <p className="text-sm text-gray-400 mt-1">
                READY → DRIVER ASSIGNED → PICKED UP → DISPATCHED
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              LIVE • 3s refresh
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center text-gray-400">
            Loading dispatch queue...
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <MetricCard
                label="Preparing"
                value={preparingOrders.length}
              />

              <MetricCard
                label="Ready"
                value={
                  orders.filter(
                    (order) =>
                      order.status ===
                      "READY_FOR_PICKUP",
                  ).length
                }
              />

              <MetricCard
                label="Assigned"
                value={
                  orders.filter(
                    (order) =>
                      order.status ===
                      "DRIVER_ASSIGNED",
                  ).length
                }
              />

              <MetricCard
                label="Picked Up"
                value={
                  orders.filter(
                    (order) =>
                      order.status ===
                      "PICKED_UP",
                  ).length
                }
              />

              <MetricCard
                label="Dispatched"
                value={
                  dispatchedOrders.length
                }
              />
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="space-y-6">
                <section className="rounded-2xl border border-gray-800 bg-gray-900/70 overflow-hidden">
                  <SectionHeader
                    title="PREPARING"
                    count={
                      preparingOrders.length
                    }
                    tone="amber"
                  />

                  <div className="p-4 space-y-3">
                    {preparingOrders.length ===
                    0 ? (
                      <EmptyState text="No orders currently preparing." />
                    ) : (
                      preparingOrders.map(
                        (order) => (
                          <PreparingCard
                            key={order.id}
                            order={order}
                          />
                        ),
                      )
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-gray-800 bg-gray-900/70 overflow-hidden">
                  <SectionHeader
                    title="READY / HANDOFF"
                    count={
                      readyOrders.length
                    }
                    tone="green"
                  />

                  <div className="p-4 space-y-4">
                    {readyOrders.length ===
                    0 ? (
                      <EmptyState text="No orders waiting for dispatch." />
                    ) : (
                      readyOrders.map(
                        (order) => (
                          <DispatchOrderCard
                            key={order.id}
                            order={order}
                            driverName={
                              driverNames[
                                order.id
                              ] ??
                              order.driverName ??
                              ""
                            }
                            onDriverNameChange={(
                              value,
                            ) =>
                              setDriverNames(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  [order.id]:
                                    value,
                                }),
                              )
                            }
                            onAction={
                              performAction
                            }
                            onDispatch={
                              dispatchOrder
                            }
                            busy={
                              busyOrderId ===
                              order.id
                            }
                          />
                        ),
                      )
                    )}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="rounded-2xl border border-gray-800 bg-gray-900/70 overflow-hidden">
                  <SectionHeader
                    title="DISPATCHED"
                    count={
                      dispatchedOrders.length
                    }
                    tone="sky"
                  />

                  <div className="p-4">
                    {dispatchedOrders.length ===
                    0 ? (
                      <EmptyState text="No dispatched orders yet." />
                    ) : (
                      <div className="space-y-3">
                        {dispatchedOrders
                          .slice(0, 20)
                          .map(
                            (order) => (
                              <DispatchedCard
                                key={
                                  order.id
                                }
                                order={
                                  order
                                }
                              />
                            ),
                          )}
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-gray-800 bg-gray-900/70 overflow-hidden">
                  <SectionHeader
                    title="CANCELLED"
                    count={
                      cancelledOrders.length
                    }
                    tone="red"
                  />

                  <div className="p-4">
                    {cancelledOrders.length ===
                    0 ? (
                      <EmptyState text="No cancelled orders." />
                    ) : (
                      <div className="space-y-3">
                        {cancelledOrders
                          .slice(0, 10)
                          .map(
                            (order) => (
                              <CancelledCard
                                key={
                                  order.id
                                }
                                order={
                                  order
                                }
                              />
                            ),
                          )}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs font-mono uppercase text-gray-500">
        {label}
      </p>

      <p className="text-2xl font-bold mt-1">
        {value}
      </p>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  tone,
}: {
  title: string;
  count: number;
  tone:
    | "amber"
    | "green"
    | "sky"
    | "red";
}) {
  const toneClass = {
    amber: "text-amber-400",
    green: "text-green-400",
    sky: "text-sky-400",
    red: "text-red-400",
  }[tone];

  return (
    <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
      <h2
        className={`font-mono text-sm font-bold ${toneClass}`}
      >
        {title}
      </h2>

      <span className="text-xs font-mono text-gray-500">
        {count}
      </span>
    </div>
  );
}

function PreparingCard({
  order,
}: {
  order: Order;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">
            {order.id}
          </p>

          <p className="text-xs text-gray-500 mt-1">
            {order.brandId} •{" "}
            {order.channel}
          </p>
        </div>

        <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-mono text-amber-400">
          PREPARING
        </span>
      </div>

      <div className="mt-3 space-y-1">
        {order.items.map(
          (item) => (
            <p
              key={item.id}
              className="text-sm text-gray-300"
            >
              {item.quantity} ×{" "}
              {item.name}
            </p>
          ),
        )}
      </div>
    </div>
  );
}

function DispatchOrderCard({
  order,
  driverName,
  onDriverNameChange,
  onAction,
  onDispatch,
  busy,
}: {
  order: Order;
  driverName: string;
  onDriverNameChange: (
    value: string,
  ) => void;
  onAction: (
    order: Order,
    action: ActionType,
  ) => void;
  onDispatch: (
    order: Order,
  ) => void;
  busy: boolean;
}) {
  const isReady =
    order.status ===
    "READY_FOR_PICKUP";

  const isAssigned =
    order.status ===
    "DRIVER_ASSIGNED";

  const isPickedUp =
    order.status ===
    "PICKED_UP";

  return (
    <div className="rounded-2xl border border-green-500/20 bg-gray-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">
            {order.id}
          </p>

          <p className="text-xs text-gray-500 mt-1">
            {order.brandId} •{" "}
            {order.channel}
          </p>
        </div>

        <StatusBadge
          status={order.status}
        />
      </div>

      <div className="mt-4 space-y-2">
        {order.items.map(
          (item) => (
            <div
              key={item.id}
              className="flex justify-between gap-3 text-sm"
            >
              <span className="text-gray-300">
                {item.quantity} ×{" "}
                {item.name}
              </span>

              <span className="text-gray-600 font-mono text-xs">
                {item.station}
              </span>
            </div>
          ),
        )}
      </div>

      <div className="mt-4 rounded-xl bg-gray-900 border border-gray-800 p-3">
        {isReady && (
          <>
            <label className="block text-xs font-mono uppercase text-gray-500 mb-2">
              Driver
            </label>

            <input
              value={driverName}
              onChange={(event) =>
                onDriverNameChange(
                  event.target.value,
                )
              }
              placeholder="Enter driver name"
              disabled={busy}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-3 text-sm text-white outline-none focus:border-green-400"
            />

            <button
              type="button"
              disabled={
                busy ||
                !driverName.trim()
              }
              onClick={() =>
                onAction(
                  order,
                  "DRIVER_ASSIGNED",
                )
              }
              className="mt-3 w-full rounded-xl bg-green-500 px-4 py-4 font-bold text-gray-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy
                ? "UPDATING..."
                : "ASSIGN DRIVER"}
            </button>
          </>
        )}

        {isAssigned && (
          <>
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-gray-500">
                Driver
              </span>

              <span className="font-semibold text-white">
                {order.driverName ||
                  "Unknown"}
              </span>
            </div>

            {order.driverAssignedAt && (
              <div className="flex justify-between gap-3 text-xs mt-2">
                <span className="text-gray-500">
                  Assigned
                </span>

                <span className="font-mono text-gray-400">
                  {formatTime(
                    order.driverAssignedAt,
                  )}
                </span>
              </div>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onAction(
                  order,
                  "PICKED_UP",
                )
              }
              className="mt-4 w-full rounded-xl bg-sky-500 px-4 py-4 font-bold text-gray-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy
                ? "UPDATING..."
                : "MARK PICKED UP"}
            </button>
          </>
        )}

        {isPickedUp && (
          <>
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-gray-500">
                Driver
              </span>

              <span className="font-semibold text-white">
                {order.driverName ||
                  "Unknown"}
              </span>
            </div>

            {order.pickedUpAt && (
              <div className="flex justify-between gap-3 text-xs mt-2">
                <span className="text-gray-500">
                  Picked up
                </span>

                <span className="font-mono text-gray-400">
                  {formatTime(
                    order.pickedUpAt,
                  )}
                </span>
              </div>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onDispatch(order)
              }
              className="mt-4 w-full rounded-xl bg-green-500 px-4 py-4 font-bold text-gray-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy
                ? "DISPATCHING..."
                : "DISPATCH ORDER"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function DispatchedCard({
  order,
}: {
  order: Order;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">
            {order.id}
          </p>

          <p className="text-xs text-gray-500 mt-1">
            {order.brandId} •{" "}
            {order.channel}
          </p>
        </div>

        <span className="rounded-full bg-green-500/10 px-2 py-1 text-[10px] font-mono text-green-400">
          DISPATCHED
        </span>
      </div>

      <div className="mt-3 flex justify-between text-sm">
        <span className="text-gray-500">
          Driver
        </span>

        <span className="text-gray-200">
          {order.driverName ||
            "Not recorded"}
        </span>
      </div>

      {order.dispatchedAt && (
        <div className="mt-2 flex justify-between text-xs">
          <span className="text-gray-500">
            Dispatched
          </span>

          <span className="font-mono text-gray-400">
            {formatTime(
              order.dispatchedAt,
            )}
          </span>
        </div>
      )}
    </div>
  );
}

function CancelledCard({
  order,
}: {
  order: Order;
}) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">
            {order.id}
          </p>

          <p className="text-xs text-gray-500 mt-1">
            {order.brandId} •{" "}
            {order.channel}
          </p>
        </div>

        <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] font-mono text-red-400">
          CANCELLED
        </span>
      </div>

      <p className="text-sm text-gray-300 mt-3">
        {order.cancellationReason ||
          "No reason recorded"}
      </p>

      {order.cancelledBy && (
        <p className="text-xs text-gray-500 mt-1">
          By {order.cancelledBy}
        </p>
      )}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: Order["status"];
}) {
  const classes: Record<
    Order["status"],
    string
  > = {
    PENDING:
      "bg-gray-500/10 text-gray-400",
    PREPARING:
      "bg-amber-500/10 text-amber-400",
    READY_FOR_PICKUP:
      "bg-green-500/10 text-green-400",
    DRIVER_ASSIGNED:
      "bg-sky-500/10 text-sky-400",
    PICKED_UP:
      "bg-purple-500/10 text-purple-400",
    DISPATCHED:
      "bg-green-500/10 text-green-400",
    CANCELLED:
      "bg-red-500/10 text-red-400",
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-mono ${classes[status]}`}
    >
      {status}
    </span>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-800 px-4 py-8 text-center text-sm text-gray-600">
      {text}
    </div>
  );
}

function formatTime(
  timestamp: string,
) {
  return new Date(
    timestamp,
  ).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
