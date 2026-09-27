
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

type OrderChannel =
  | "Swiggy"
  | "Zomato"
  | "DoorDash"
  | "UberEats"
  | "GrubHub"
  | "Direct Web";

type OrderItem = {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  notes?: string;
  station: string;
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
  channel: OrderChannel;
  source: string;
  status: OrderStatus;
  items: OrderItem[];
  customerName?: string;
  driverName?: string;
  courierEtaMins?: number;
  createdAt: string;
  updatedAt: string;
  receivedAt?: string;
  acceptedAt?: string;
  prepStartedAt?: string;
  prepCompletedAt?: string;
  readyAt?: string;
  driverAssignedAt?: string;
  pickedUpAt?: string;
  dispatchedAt?: string;
  cancellationSource?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  inventoryDecision?: string;
  inventoryWarnings?: string[];
  inventoryUnavailable?: string[];
  events: OrderEvent[];
};

const KITCHEN_ID = "K1";

const DRIVER_NAMES = [
  "Aman",
  "Ravi",
  "Vikas",
  "Sandeep",
  "Mohit",
  "Rahul",
];

const ETA_OPTIONS = [10, 15, 20, 25, 30, 35, 40];

function formatTime(timestamp?: string): string {
  if (!timestamp) {
    return "--";
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: OrderStatus): string {
  switch (status) {
    case "READY_FOR_PICKUP":
      return "READY FOR PICKUP";
    case "DRIVER_ASSIGNED":
      return "DRIVER ASSIGNED";
    case "PICKED_UP":
      return "PICKED UP";
    case "DISPATCHED":
      return "ON THE WAY";
    default:
      return status.replaceAll("_", " ");
  }
}

function statusClasses(status: OrderStatus): string {
  switch (status) {
    case "READY_FOR_PICKUP":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    case "DRIVER_ASSIGNED":
      return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
    case "PICKED_UP":
      return "border-violet-500/40 bg-violet-500/10 text-violet-300";
    case "DISPATCHED":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "CANCELLED":
      return "border-rose-500/40 bg-rose-500/10 text-rose-300";
    default:
      return "border-neutral-700 bg-neutral-800 text-neutral-300";
  }
}

export default function DispatchPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<
    Record<string, string>
  >({});
  const [selectedEta, setSelectedEta] = useState<
    Record<string, number>
  >({});

  const fetchOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/orders", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load orders.");
      }

      const data = await response.json();

      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setError("");
    } catch (err) {
      console.error("Dispatch order sync failed:", err);
      setError("Unable to sync live orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    const interval = window.setInterval(fetchOrders, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchOrders]);

  const dispatchOrders = useMemo(() => {
    return orders
      .filter(
        (order) =>
          order.kitchenId === KITCHEN_ID &&
          (
            order.status === "READY_FOR_PICKUP" ||
            order.status === "DRIVER_ASSIGNED" ||
            order.status === "PICKED_UP" ||
            order.status === "DISPATCHED"
          )
      )
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() -
          new Date(b.createdAt).getTime()
      );
  }, [orders]);

  const readyCount = dispatchOrders.filter(
    (order) => order.status === "READY_FOR_PICKUP"
  ).length;

  const assignedCount = dispatchOrders.filter(
    (order) => order.status === "DRIVER_ASSIGNED"
  ).length;

  const pickedUpCount = dispatchOrders.filter(
    (order) => order.status === "PICKED_UP"
  ).length;

  const onWayCount = dispatchOrders.filter(
    (order) => order.status === "DISPATCHED"
  ).length;

  async function updateOrder(
    order: Order,
    action: "DRIVER_ASSIGNED" | "PICKED_UP" | "DISPATCHED"
  ) {
    setBusyOrderId(order.id);
    setError("");

    try {
      let body: Record<string, unknown>;

      if (action === "DRIVER_ASSIGNED") {
        const driver =
          selectedDriver[order.id] || DRIVER_NAMES[0];

        const eta =
          selectedEta[order.id] ??
          ETA_OPTIONS[2];

        body = {
          orderId: order.id,
          action: "DRIVER_ASSIGNED",
          driverName: driver,
          courierEtaMins: eta,
        };
      } else if (action === "PICKED_UP") {
        body = {
          orderId: order.id,
          action: "PICKED_UP",
        };
      } else {
        body = {
          orderId: order.id,
          action: "DISPATCHED",
        };
      }

      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to update order."
        );
      }

      await fetchOrders();
    } catch (err) {
      console.error("Dispatch update failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update order."
      );
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-neutral-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
              <h1 className="text-2xl font-bold tracking-tight">
                Dispatch Station
              </h1>
            </div>

            <p className="mt-1 text-xs text-neutral-400">
              Kitchen {KITCHEN_ID} · Delivery Handover & Dispatch
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-neutral-500">
              Live Orders
            </div>
            <div className="font-mono text-2xl font-bold">
              {dispatchOrders.length}
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500">
              Ready
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-amber-300">
              {readyCount}
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500">
              Driver Assigned
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-cyan-300">
              {assignedCount}
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500">
              Picked Up
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-violet-300">
              {pickedUpCount}
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-500">
              On The Way
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-emerald-300">
              {onWayCount}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-10 text-center text-sm text-neutral-400">
            Loading dispatch queue...
          </div>
        ) : dispatchOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30 p-12 text-center">
            <div className="text-lg font-semibold text-neutral-300">
              No dispatch orders
            </div>
            <p className="mt-2 text-sm text-neutral-500">
              Orders marked READY FOR PICKUP will appear here.
            </p>
          </div>
        ) : (
          <section className="space-y-4">
            {dispatchOrders.map((order) => {
              const isBusy = busyOrderId === order.id;

              return (
                <article
                  key={order.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4 shadow-xl shadow-black/10"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-lg font-bold text-white">
                          {order.id}
                        </span>

                        <span
                          className={`rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wider ${statusClasses(
                            order.status
                          )}`}
                        >
                          {statusLabel(order.status)}
                        </span>

                        <span className="rounded-full border border-neutral-700 bg-neutral-800 px-2 py-1 text-[10px] uppercase tracking-wider text-neutral-400">
                          {order.channel}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                            Aggregator Order ID
                          </div>
                          <div className="mt-1 font-mono text-sm text-cyan-300">
                            {order.externalOrderId || "Not supplied"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                            Brand
                          </div>
                          <div className="mt-1 text-sm text-neutral-200">
                            {order.brandId}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                            Customer
                          </div>
                          <div className="mt-1 text-sm text-neutral-200">
                            {order.customerName || "Customer"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                            Ready At
                          </div>
                          <div className="mt-1 font-mono text-sm text-neutral-300">
                            {formatTime(order.readyAt)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
                        <div className="mb-2 text-[10px] uppercase tracking-wider text-neutral-500">
                          Order
                        </div>

                        <div className="space-y-2">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start justify-between gap-4 text-sm"
                            >
                              <div className="text-neutral-200">
                                <span className="mr-2 font-mono text-neutral-500">
                                  {item.quantity}×
                                </span>
                                {item.name}
                                {item.notes && (
                                  <div className="mt-1 text-xs text-neutral-500">
                                    Note: {item.notes}
                                  </div>
                                )}
                              </div>

                              <span className="shrink-0 text-xs text-neutral-600">
                                {item.station}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="w-full lg:max-w-sm">
                      {order.status === "READY_FOR_PICKUP" && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                          <div className="mb-3">
                            <div className="text-sm font-semibold text-amber-200">
                              Assign Delivery Partner
                            </div>
                            <div className="mt-1 text-xs text-neutral-500">
                              Match the aggregator order with the driver.
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label
                                htmlFor={`driver-${order.id}`}
                                className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-500"
                              >
                                Delivery Partner
                              </label>

                              <select
                                id={`driver-${order.id}`}
                                value={
                                  selectedDriver[order.id] ||
                                  DRIVER_NAMES[0]
                                }
                                onChange={(event) =>
                                  setSelectedDriver((current) => ({
                                    ...current,
                                    [order.id]: event.target.value,
                                  }))
                                }
                                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-3 text-sm text-neutral-100 outline-none focus:border-cyan-500"
                              >
                                {DRIVER_NAMES.map((driver) => (
                                  <option
                                    key={driver}
                                    value={driver}
                                  >
                                    {driver}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label
                                htmlFor={`eta-${order.id}`}
                                className="mb-1 block text-[10px] uppercase tracking-wider text-neutral-500"
                              >
                                Customer ETA
                              </label>

                              <select
                                id={`eta-${order.id}`}
                                value={
                                  selectedEta[order.id] ??
                                  ETA_OPTIONS[2]
                                }
                                onChange={(event) =>
                                  setSelectedEta((current) => ({
                                    ...current,
                                    [order.id]: Number(
                                      event.target.value
                                    ),
                                  }))
                                }
                                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-3 text-sm text-neutral-100 outline-none focus:border-cyan-500"
                              >
                                {ETA_OPTIONS.map((minutes) => (
                                  <option
                                    key={minutes}
                                    value={minutes}
                                  >
                                    {minutes} minutes
                                  </option>
                                ))}
                              </select>
                            </div>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                updateOrder(
                                  order,
                                  "DRIVER_ASSIGNED"
                                )
                              }
                              className="w-full rounded-lg bg-cyan-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isBusy
                                ? "Assigning..."
                                : "ASSIGN DRIVER"}
                            </button>
                          </div>
                        </div>
                      )}

                      {order.status === "DRIVER_ASSIGNED" && (
                        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                          <div className="mb-3">
                            <div className="text-sm font-semibold text-cyan-200">
                              Driver Assigned
                            </div>
                            <div className="mt-1 text-xs text-neutral-500">
                              Confirm when the delivery partner physically
                              collects the order.
                            </div>
                          </div>

                          <div className="mb-4 grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
                              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                                Driver
                              </div>
                              <div className="mt-1 text-sm font-semibold text-neutral-200">
                                {order.driverName || "Assigned"}
                              </div>
                            </div>

                            <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
                              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                                Customer ETA
                              </div>
                              <div className="mt-1 font-mono text-sm font-semibold text-cyan-300">
                                {order.courierEtaMins
                                  ? `${order.courierEtaMins} min`
                                  : "--"}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              updateOrder(order, "PICKED_UP")
                            }
                            className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isBusy
                              ? "Updating..."
                              : "CONFIRM PICKED UP"}
                          </button>
                        </div>
                      )}

                      {order.status === "PICKED_UP" && (
                        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
                          <div className="mb-3">
                            <div className="text-sm font-semibold text-violet-200">
                              Order Picked Up
                            </div>
                            <div className="mt-1 text-xs text-neutral-500">
                              The delivery partner has collected the order.
                            </div>
                          </div>

                          <div className="mb-4 grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
                              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                                Driver
                              </div>
                              <div className="mt-1 text-sm font-semibold text-neutral-200">
                                {order.driverName || "Assigned"}
                              </div>
                            </div>

                            <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
                              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                                ETA
                              </div>
                              <div className="mt-1 font-mono text-sm font-semibold text-cyan-300">
                                {order.courierEtaMins
                                  ? `${order.courierEtaMins} min`
                                  : "--"}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              updateOrder(order, "DISPATCHED")
                            }
                            className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isBusy
                              ? "Updating..."
                              : "DISPATCH / ON THE WAY"}
                          </button>
                        </div>
                      )}

                      {order.status === "DISPATCHED" && (
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                          <div className="text-sm font-semibold text-emerald-200">
                            ON THE WAY
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                                Driver
                              </div>
                              <div className="mt-1 text-sm text-neutral-200">
                                {order.driverName || "--"}
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                                Customer ETA
                              </div>
                              <div className="mt-1 font-mono text-sm font-semibold text-emerald-300">
                                {order.courierEtaMins
                                  ? `${order.courierEtaMins} min`
                                  : "--"}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 border-t border-neutral-800 pt-3 text-xs text-neutral-500">
                            Dispatched at{" "}
                            {formatTime(order.dispatchedAt)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
