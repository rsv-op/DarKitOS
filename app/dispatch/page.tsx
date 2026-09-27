"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Order } from "@/lib/db";

type OrdersResponse = {
  success: boolean;
  orders: Order[];
  error?: string;
};

type CancellationSource =
  | "CUSTOMER"
  | "KITCHEN"
  | "AGGREGATOR"
  | "SYSTEM"
  | "MANUAL";

const CANCELLATION_SOURCES: CancellationSource[] = [
  "CUSTOMER",
  "KITCHEN",
  "AGGREGATOR",
  "SYSTEM",
  "MANUAL",
];

const ACTIVE_STATUSES: Order["status"][] = [
  "PREPARING",
  "READY_FOR_PICKUP",
  "DRIVER_ASSIGNED",
  "PICKED_UP",
];

function formatTime(value?: string) {
  if (!value) return "—";

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start?: string, end?: string) {
  if (!start || !end) return "—";

  const milliseconds =
    new Date(end).getTime() - new Date(start).getTime();

  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    return "—";
  }

  const totalMinutes = Math.floor(milliseconds / 60000);

  if (totalMinutes < 1) {
    return "<1 min";
  }

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function statusLabel(status: Order["status"]) {
  switch (status) {
    case "PREPARING":
      return "Preparing";
    case "READY_FOR_PICKUP":
      return "Ready for Pickup";
    case "DRIVER_ASSIGNED":
      return "Driver Assigned";
    case "PICKED_UP":
      return "Picked Up";
    case "DISPATCHED":
      return "Dispatched";
    case "CANCELLED":
      return "Cancelled";
    case "PENDING":
      return "Pending";
    default:
      return status;
  }
}

function statusClass(status: Order["status"]) {
  switch (status) {
    case "PREPARING":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    case "READY_FOR_PICKUP":
      return "border-purple-500/30 bg-purple-500/10 text-purple-300";
    case "DRIVER_ASSIGNED":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
    case "PICKED_UP":
      return "border-indigo-500/30 bg-indigo-500/10 text-indigo-300";
    case "DISPATCHED":
      return "border-green-500/30 bg-green-500/10 text-green-300";
    case "CANCELLED":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    default:
      return "border-slate-700 bg-slate-800 text-slate-300";
  }
}

export default function DispatchPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [driverNames, setDriverNames] = useState<
    Record<string, string>
  >({});

  const [processingOrderId, setProcessingOrderId] = useState<
    string | null
  >(null);

  const [cancellingOrderId, setCancellingOrderId] = useState<
    string | null
  >(null);

  const [cancellationSource, setCancellationSource] =
    useState<CancellationSource>("MANUAL");

  const [cancellationReason, setCancellationReason] =
    useState("");

  const [actionMessage, setActionMessage] = useState("");

  const fetchOrders = useCallback(async () => {
    try {
      setRefreshing(true);

      const response = await fetch("/api/orders", {
        cache: "no-store",
      });

      const data = (await response.json()) as OrdersResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to load dispatch orders"
        );
      }

      setOrders(data.orders || []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dispatch orders"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();

    const interval = window.setInterval(() => {
      void fetchOrders();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [fetchOrders]);

  const preparingOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "PREPARING"
      ),
    [orders]
  );

  const readyOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "READY_FOR_PICKUP"
      ),
    [orders]
  );

  const assignedOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "DRIVER_ASSIGNED"
      ),
    [orders]
  );

  const pickedUpOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "PICKED_UP"
      ),
    [orders]
  );

  const dispatchedOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "DISPATCHED"
      ),
    [orders]
  );

  const cancelledOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "CANCELLED"
      ),
    [orders]
  );

  const activeOrders = useMemo(
    () =>
      orders.filter((order) =>
        ACTIVE_STATUSES.includes(order.status)
      ),
    [orders]
  );

  async function updateOrder(
    orderId: string,
    body: Record<string, unknown>
  ) {
    try {
      setProcessingOrderId(orderId);
      setActionMessage("");

      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...body,
          orderId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to update order"
        );
      }

      setOrders(data.orders || []);
      setActionMessage(`Order ${orderId} updated successfully.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update order"
      );
    } finally {
      setProcessingOrderId(null);
    }
  }

  async function assignDriver(order: Order) {
    const driverName =
      driverNames[order.id]?.trim() || "";

    if (!driverName) {
      setError(
        `Enter a driver name before assigning ${order.id}.`
      );
      return;
    }

    await updateOrder(order.id, {
      action: "DRIVER_ASSIGNED",
      driverName,
    });
  }

  async function markPickedUp(order: Order) {
    await updateOrder(order.id, {
      action: "PICKED_UP",
    });
  }

  async function dispatchOrder(order: Order) {
    await updateOrder(order.id, {
      status: "DISPATCHED",
    });
  }

  async function cancelOrder(order: Order) {
    if (!cancellationReason.trim()) {
      setError(
        "Cancellation reason is required."
      );
      return;
    }

    try {
      setProcessingOrderId(order.id);

      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
          status: "CANCELLED",
          cancellationSource,
          cancellationReason:
            cancellationReason.trim(),
          cancelledBy: "DISPATCH_STATION",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to cancel order"
        );
      }

      setOrders(data.orders || []);
      setActionMessage(
        `Order ${order.id} cancelled and recorded in the order timeline.`
      );

      setCancellingOrderId(null);
      setCancellationReason("");
      setCancellationSource("MANUAL");
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to cancel order"
      );
    } finally {
      setProcessingOrderId(null);
    }
  }

  function openCancellation(orderId: string) {
    setCancellingOrderId(orderId);
    setCancellationReason("");
    setCancellationSource("MANUAL");
    setError("");
  }

  function closeCancellation() {
    setCancellingOrderId(null);
    setCancellationReason("");
    setCancellationSource("MANUAL");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-5 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-purple-400 shadow-[0_0_12px_rgba(192,132,252,0.8)]" />

                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-300">
                  Dispatch Station
                </span>
              </div>

              <h1 className="text-2xl font-bold">
                K1 Dispatch & Handoff
              </h1>

              <p className="mt-1 text-sm text-slate-400">
                Driver assignment, pickup confirmation,
                dispatch and cancellation control.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-600">
                  Active
                </p>
                <p className="mt-1 text-lg font-bold">
                  {activeOrders.length}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-600">
                  Ready
                </p>
                <p className="mt-1 text-lg font-bold text-purple-300">
                  {readyOrders.length}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-600">
                  Picked Up
                </p>
                <p className="mt-1 text-lg font-bold text-indigo-300">
                  {pickedUpOrders.length}
                </p>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            <strong>Error:</strong> {error}
          </div>
        )}

        {actionMessage && !error && (
          <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
            {actionMessage}
          </div>
        )}

        {/* Preparing */}
        <section className="mb-5">
          <SectionHeader
            title="Preparing"
            count={preparingOrders.length}
            description="Orders still being prepared by the kitchen."
          />

          {preparingOrders.length === 0 ? (
            <EmptyState text="No orders currently preparing." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {preparingOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  processing={processingOrderId === order.id}
                  onCancel={() => openCancellation(order.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Ready */}
        <section className="mb-5">
          <SectionHeader
            title="Ready for Pickup"
            count={readyOrders.length}
            description="Assign a driver before the order leaves the kitchen."
          />

          {readyOrders.length === 0 ? (
            <EmptyState text="No orders waiting for driver assignment." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {readyOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  processing={processingOrderId === order.id}
                  onCancel={() => openCancellation(order.id)}
                >
                  <div className="mt-4 border-t border-slate-800 pt-4">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Driver
                    </label>

                    <input
                      value={driverNames[order.id] || ""}
                      onChange={(event) =>
                        setDriverNames((current) => ({
                          ...current,
                          [order.id]: event.target.value,
                        }))
                      }
                      placeholder="Enter driver name"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-purple-400"
                    />

                    <button
                      type="button"
                      disabled={
                        processingOrderId === order.id
                      }
                      onClick={() => void assignDriver(order)}
                      className="mt-3 min-h-12 w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {processingOrderId === order.id
                        ? "Assigning..."
                        : "ASSIGN DRIVER"}
                    </button>
                  </div>
                </OrderCard>
              ))}
            </div>
          )}
        </section>

        {/* Driver assigned */}
        <section className="mb-5">
          <SectionHeader
            title="Driver Assigned"
            count={assignedOrders.length}
            description="Confirm physical pickup when the driver collects the order."
          />

          {assignedOrders.length === 0 ? (
            <EmptyState text="No drivers currently waiting for pickup." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assignedOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  processing={processingOrderId === order.id}
                  onCancel={() => openCancellation(order.id)}
                >
                  <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <p className="text-xs uppercase tracking-wider text-cyan-400">
                      Assigned Driver
                    </p>

                    <p className="mt-1 text-lg font-bold">
                      {order.driverName || "Unknown"}
                    </p>

                    {order.driverAssignedAt && (
                      <p className="mt-1 text-xs text-slate-500">
                        Assigned at{" "}
                        {formatTime(order.driverAssignedAt)}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={
                      processingOrderId === order.id
                    }
                    onClick={() => void markPickedUp(order)}
                    className="mt-3 min-h-14 w-full rounded-xl bg-indigo-600 px-4 py-3 text-base font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {processingOrderId === order.id
                      ? "Updating..."
                      : "MARK PICKED UP"}
                  </button>
                </OrderCard>
              ))}
            </div>
          )}
        </section>

        {/* Picked up */}
        <section className="mb-5">
          <SectionHeader
            title="Picked Up"
            count={pickedUpOrders.length}
            description="Orders physically collected and ready for final dispatch."
          />

          {pickedUpOrders.length === 0 ? (
            <EmptyState text="No picked-up orders waiting for dispatch." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pickedUpOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  processing={processingOrderId === order.id}
                  onCancel={() => openCancellation(order.id)}
                >
                  <div className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <p className="text-xs uppercase tracking-wider text-indigo-400">
                      Driver
                    </p>

                    <p className="mt-1 font-semibold">
                      {order.driverName || "Unknown"}
                    </p>

                    <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-slate-600">
                          Assigned
                        </p>
                        <p className="mt-1 text-slate-300">
                          {formatTime(
                            order.driverAssignedAt
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-600">
                          Picked Up
                        </p>
                        <p className="mt-1 text-slate-300">
                          {formatTime(order.pickedUpAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={
                      processingOrderId === order.id
                    }
                    onClick={() => void dispatchOrder(order)}
                    className="mt-3 min-h-14 w-full rounded-xl bg-green-600 px-4 py-3 text-base font-bold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {processingOrderId === order.id
                      ? "Dispatching..."
                      : "DISPATCH ORDER"}
                  </button>
                </OrderCard>
              ))}
            </div>
          )}
        </section>

        {/* Dispatched */}
        <section className="mb-5">
          <SectionHeader
            title="Dispatched"
            count={dispatchedOrders.length}
            description="Completed dispatch records."
          />

          {dispatchedOrders.length === 0 ? (
            <EmptyState text="No dispatched orders yet." />
          ) : (
            <div className="space-y-3">
              {dispatchedOrders.slice(0, 10).map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold">
                          {order.id}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClass(
                            order.status
                          )}`}
                        >
                          {statusLabel(order.status)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {order.brandId} · {order.channel} ·{" "}
                        {order.driverName || "No driver"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-right text-xs">
                      <div>
                        <p className="text-slate-600">
                          Received
                        </p>
                        <p className="mt-1 text-slate-300">
                          {formatTime(
                            order.receivedAt ||
                              order.createdAt
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-600">
                          Dispatch
                        </p>
                        <p className="mt-1 text-green-300">
                          {formatTime(order.dispatchedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Cancelled */}
        <section className="mb-6">
          <SectionHeader
            title="Cancelled"
            count={cancelledOrders.length}
            description="Cancelled orders and their recorded reasons."
          />

          {cancelledOrders.length === 0 ? (
            <EmptyState text="No cancelled orders." />
          ) : (
            <div className="space-y-3">
              {cancelledOrders.slice(0, 10).map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-red-500/20 bg-red-500/5 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold">
                          {order.id}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClass(
                            order.status
                          )}`}
                        >
                          CANCELLED
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-red-200">
                        {order.cancellationReason ||
                          "No reason recorded"}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>
                          Source:{" "}
                          {order.cancellationSource ||
                            "Unknown"}
                        </span>

                        <span>
                          By:{" "}
                          {order.cancelledBy ||
                            "Unknown"}
                        </span>
                      </div>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-xs text-slate-600">
                        Cancelled
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {formatTime(
                          order.updatedAt
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="border-t border-slate-900 pt-4 text-center text-xs text-slate-600">
          K1 Dispatch Station · Auto-refresh every 3 seconds
        </footer>
      </div>

      {/* Cancellation modal */}
      {cancellingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
                Cancel Order
              </p>

              <h2 className="mt-1 text-xl font-bold">
                {cancellingOrderId}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Cancellation becomes part of the permanent order
                event history for operational analysis.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Cancellation Source
                </label>

                <select
                  value={cancellationSource}
                  onChange={(event) =>
                    setCancellationSource(
                      event.target
                        .value as CancellationSource
                    )
                  }
                  className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-sm text-white outline-none focus:border-red-400"
                >
                  {CANCELLATION_SOURCES.map(
                    (source) => (
                      <option
                        key={source}
                        value={source}
                      >
                        {source}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Cancellation Reason
                </label>

                <textarea
                  value={cancellationReason}
                  onChange={(event) =>
                    setCancellationReason(
                      event.target.value
                    )
                  }
                  placeholder="Enter the specific cancellation reason"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-red-400"
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closeCancellation}
                className="min-h-12 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                KEEP ORDER
              </button>

              <button
                type="button"
                disabled={
                  processingOrderId ===
                  cancellingOrderId
                }
                onClick={() => {
                  const order = orders.find(
                    (item) =>
                      item.id ===
                      cancellingOrderId
                  );

                  if (order) {
                    void cancelOrder(order);
                  }
                }}
                className="min-h-12 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processingOrderId ===
                cancellingOrderId
                  ? "CANCELLING..."
                  : "CONFIRM CANCELLATION"}
              </button>
            </div>
          </div>
        </div>
      )}

      {refreshing && (
        <div className="pointer-events-none fixed bottom-4 right-4 rounded-full border border-slate-700 bg-slate-900/95 px-3 py-2 text-[10px] text-slate-500 shadow-xl">
          Syncing...
        </div>
      )}
    </main>
  );
}

function SectionHeader({
  title,
  count,
  description,
}: {
  title: string;
  count: number;
  description: string;
}) {
  return (
    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-xs text-slate-500">
          {description}
        </p>
      </div>

      <span className="w-fit rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-400">
        {count}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-600">
      {text}
    </div>
  );
}

function OrderCard({
  order,
  processing,
  onCancel,
  children,
}: {
  order: Order;
  processing: boolean;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold">
              {order.id}
            </span>

            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClass(
                order.status
              )}`}
            >
              {statusLabel(order.status)}
            </span>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            {order.brandId} · {order.channel}
          </p>
        </div>

        <div className="text-right text-xs">
          <p className="text-slate-600">Received</p>
          <p className="mt-1 text-slate-300">
            {formatTime(
              order.receivedAt || order.createdAt
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {order.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {item.name}
              </p>
              <p className="text-[11px] text-slate-600">
                {item.station}
              </p>
            </div>

            <span className="ml-3 text-sm font-bold text-slate-300">
              ×{item.quantity}
            </span>
          </div>
        ))}
      </div>

      {order.inventoryWarnings &&
        order.inventoryWarnings.length > 0 && (
          <div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-300">
            Stock warning:{" "}
            {order.inventoryWarnings.join(", ")}
          </div>
        )}

      {order.prepStartedAt && order.readyAt && (
        <div className="mt-3 text-xs text-slate-500">
          Prep time:{" "}
          <span className="text-slate-300">
            {formatDuration(
              order.prepStartedAt,
              order.readyAt
            )}
          </span>
        </div>
      )}

      {children}

      {order.status !== "DISPATCHED" &&
        order.status !== "CANCELLED" && (
          <button
            type="button"
            disabled={processing}
            onClick={onCancel}
            className="mt-3 min-h-11 w-full rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            CANCEL ORDER
          </button>
        )}
    </article>
  );
}
