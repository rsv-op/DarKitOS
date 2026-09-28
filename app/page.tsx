"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  BRANDS_DB,
  KITCHENS_DB,
  type InventoryItem,
  type Order,
} from "@/lib/db";

type OrdersResponse = {
  orders?: Order[];
  error?: string;
};

type InventoryResponse = {
  inventory?: InventoryItem[];
  error?: string;
};

type Scope = "ALL" | string;

function formatMoney(value: number): string {
  return `₹${value.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function formatDuration(
  start?: string,
  end?: string
): string {
  if (!start || !end) {
    return "—";
  }

  const milliseconds =
    new Date(end).getTime() -
    new Date(start).getTime();

  if (milliseconds < 0) {
    return "—";
  }

  const minutes = Math.round(
    milliseconds / 60000
  );

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

function getOrderAmount(order: Order): number {
  const candidate = order as Order & {
    total?: number;
    totalAmount?: number;
    grandTotal?: number;
  };

  if (
    typeof candidate.total === "number" &&
    Number.isFinite(candidate.total)
  ) {
    return candidate.total;
  }

  if (
    typeof candidate.totalAmount === "number" &&
    Number.isFinite(candidate.totalAmount)
  ) {
    return candidate.totalAmount;
  }

  if (
    typeof candidate.grandTotal === "number" &&
    Number.isFinite(candidate.grandTotal)
  ) {
    return candidate.grandTotal;
  }

  return 0;
}

function statusLabel(status: Order["status"]): string {
  return status.replaceAll("_", " ");
}

export default function OwnerPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<
    InventoryItem[]
  >([]);
  const [kitchenScope, setKitchenScope] =
    useState<Scope>("ALL");
  const [brandScope, setBrandScope] =
    useState<Scope>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setError("");

      const [ordersResponse, inventoryResponse] =
        await Promise.all([
          fetch("/api/orders", {
            method: "GET",
            cache: "no-store",
          }),
          fetch("/api/inventory", {
            method: "GET",
            cache: "no-store",
          }),
        ]);

      const ordersData =
        (await ordersResponse.json()) as OrdersResponse;

      const inventoryData =
        (await inventoryResponse.json()) as InventoryResponse;

      if (!ordersResponse.ok) {
        throw new Error(
          ordersData.error ??
            "Unable to load orders"
        );
      }

      if (!inventoryResponse.ok) {
        throw new Error(
          inventoryData.error ??
            "Unable to load inventory"
        );
      }

      setOrders(ordersData.orders ?? []);
      setInventory(
        inventoryData.inventory ?? []
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load owner dashboard"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();

    const interval = window.setInterval(() => {
      void loadDashboard();
    }, 10000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadDashboard]);

  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      const kitchenMatches =
        kitchenScope === "ALL" ||
        order.kitchenId === kitchenScope;

      const brandMatches =
        brandScope === "ALL" ||
        order.brandId === brandScope;

      return kitchenMatches && brandMatches;
    });
  }, [
    orders,
    kitchenScope,
    brandScope,
  ]);

  const liveOrders = useMemo(
    () =>
      visibleOrders.filter(
        (order) =>
          order.status !== "DISPATCHED" &&
          order.status !== "CANCELLED"
      ),
    [visibleOrders]
  );

  const cancelledOrders = useMemo(
    () =>
      visibleOrders.filter(
        (order) => order.status === "CANCELLED"
      ),
    [visibleOrders]
  );

  const dispatchedOrders = useMemo(
    () =>
      visibleOrders.filter(
        (order) => order.status === "DISPATCHED"
      ),
    [visibleOrders]
  );

  const revenue = useMemo(
    () =>
      visibleOrders.reduce(
        (total, order) =>
          total + getOrderAmount(order),
        0
      ),
    [visibleOrders]
  );

  const paidOrderCount = useMemo(
    () =>
      visibleOrders.filter(
        (order) =>
          order.status !== "CANCELLED"
      ).length,
    [visibleOrders]
  );

  const averageOrderValue =
    paidOrderCount > 0
      ? revenue / paidOrderCount
      : 0;

  const lowStockItems = useMemo(
    () =>
      inventory.filter(
        (item) =>
          item.currentStock <=
          item.reorderThreshold
      ),
    [inventory]
  );

  const insufficientStockItems = useMemo(
    () =>
      inventory.filter(
        (item) => item.currentStock <= 0
      ),
    [inventory]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<
      string,
      number
    > = {};

    visibleOrders.forEach((order) => {
      counts[order.status] =
        (counts[order.status] ?? 0) + 1;
    });

    return counts;
  }, [visibleOrders]);

  const kitchenPerformance = useMemo(() => {
    return KITCHENS_DB.map((kitchen) => {
      const kitchenOrders =
        visibleOrders.filter(
          (order) =>
            order.kitchenId === kitchen.id
        );

      const completedOrders =
        kitchenOrders.filter(
          (order) =>
            order.status === "DISPATCHED"
        );

      const kitchenRevenue =
        kitchenOrders.reduce(
          (total, order) =>
            total + getOrderAmount(order),
          0
        );

      const prepTimes =
        completedOrders
          .filter(
            (order) =>
              order.prepStartedAt &&
              order.prepCompletedAt
          )
          .map(
            (order) =>
              new Date(
                order.prepCompletedAt!
              ).getTime() -
              new Date(
                order.prepStartedAt!
              ).getTime()
          );

      const averagePrepMinutes =
        prepTimes.length > 0
          ? Math.round(
              prepTimes.reduce(
                (sum, value) =>
                  sum + value,
                0
              ) /
                prepTimes.length /
                60000
            )
          : null;

      return {
        ...kitchen,
        orderCount: kitchenOrders.length,
        completedCount:
          completedOrders.length,
        revenue: kitchenRevenue,
        averagePrepMinutes,
      };
    });
  }, [visibleOrders]);

  const channelPerformance = useMemo(() => {
    const channels = new Map<
      string,
      {
        orders: number;
        revenue: number;
      }
    >();

    visibleOrders.forEach((order) => {
      const current =
        channels.get(order.channel) ?? {
          orders: 0,
          revenue: 0,
        };

      channels.set(order.channel, {
        orders: current.orders + 1,
        revenue:
          current.revenue +
          getOrderAmount(order),
      });
    });

    return Array.from(
      channels.entries()
    )
      .map(([channel, data]) => ({
        channel,
        ...data,
      }))
      .sort(
        (a, b) =>
          b.orders - a.orders
      );
  }, [visibleOrders]);

  const recentOrders = useMemo(
    () =>
      [...visibleOrders]
        .sort(
          (a, b) =>
            new Date(
              b.updatedAt
            ).getTime() -
            new Date(
              a.updatedAt
            ).getTime()
        )
        .slice(0, 10),
    [visibleOrders]
  );

  const inventoryState =
    inventory.length === 0
      ? "UNAVAILABLE"
      : "LIVE";

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-5">
        <header className="mb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Dark Cloud Kitchen OS
              </p>

              <h1 className="mt-1 text-3xl font-bold text-slate-950">
                Owner Command Center
              </h1>

              <p className="mt-1 text-sm text-slate-600">
                Cross-kitchen operational visibility
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadDashboard()
              }
              disabled={loading}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Kitchen
            <select
              value={kitchenScope}
              onChange={(event) =>
                setKitchenScope(
                  event.target.value
                )
              }
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900"
            >
              <option value="ALL">
                All kitchens
              </option>

              {KITCHENS_DB.map(
                (kitchen) => (
                  <option
                    key={kitchen.id}
                    value={kitchen.id}
                  >
                    {kitchen.name}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Brand
            <select
              value={brandScope}
              onChange={(event) =>
                setBrandScope(
                  event.target.value
                )
              }
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900"
            >
              <option value="ALL">
                All brands
              </option>

              {BRANDS_DB.map(
                (brand) => (
                  <option
                    key={brand.id}
                    value={brand.id}
                  >
                    {brand.name}
                  </option>
                )
              )}
            </select>
          </label>
        </section>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm font-semibold text-slate-600 shadow-sm">
            Loading owner dashboard...
          </div>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Orders
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-950">
                  {visibleOrders.length}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Live dataset
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Revenue
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-950">
                  {formatMoney(revenue)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  From available order totals
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  AOV
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-950">
                  {formatMoney(
                    averageOrderValue
                  )}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Calculated
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Low Stock
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-950">
                  {lowStockItems.length}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Inventory: {inventoryState}
                </div>
              </div>
            </section>

            <section className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">
                  Order Status
                </h2>

                <div className="mt-3 space-y-2">
                  {[
                    "PENDING",
                    "PREPARING",
                    "READY_FOR_PICKUP",
                    "DRIVER_ASSIGNED",
                    "PICKED_UP",
                    "DISPATCHED",
                    "CANCELLED",
                  ].map((status) => (
                    <div
                      key={status}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                    >
                      <span className="text-sm font-medium text-slate-700">
                        {statusLabel(
                          status as Order["status"]
                        )}
                      </span>

                      <span className="font-bold text-slate-950">
                        {statusCounts[
                          status
                        ] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">
                  Operational Alerts
                </h2>

                <div className="mt-3 space-y-2">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs font-bold uppercase text-amber-700">
                      Low stock
                    </div>
                    <div className="mt-1 text-xl font-bold text-amber-900">
                      {lowStockItems.length}
                    </div>
                  </div>

                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <div className="text-xs font-bold uppercase text-red-700">
                      Zero stock
                    </div>
                    <div className="mt-1 text-xl font-bold text-red-900">
                      {
                        insufficientStockItems.length
                      }
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-bold uppercase text-slate-600">
                      Cancelled
                    </div>
                    <div className="mt-1 text-xl font-bold text-slate-950">
                      {cancelledOrders.length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">
                  Live Operations
                </h2>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3">
                    <span className="text-sm text-slate-600">
                      Active orders
                    </span>
                    <span className="font-bold text-slate-950">
                      {liveOrders.length}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3">
                    <span className="text-sm text-slate-600">
                      Ready / pickup
                    </span>
                    <span className="font-bold text-slate-950">
                      {
                        statusCounts[
                          "READY_FOR_PICKUP"
                        ] ?? 0
                      }
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3">
                    <span className="text-sm text-slate-600">
                      Dispatched
                    </span>
                    <span className="font-bold text-slate-950">
                      {dispatchedOrders.length}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Kitchen Performance
                  </h2>
                  <p className="text-xs text-slate-500">
                    Calculated from the current order dataset
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3">
                        Kitchen
                      </th>
                      <th className="px-3 py-3">
                        Orders
                      </th>
                      <th className="px-3 py-3">
                        Completed
                      </th>
                      <th className="px-3 py-3">
                        Revenue
                      </th>
                      <th className="px-3 py-3">
                        Avg Prep
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {kitchenPerformance.map(
                      (kitchen) => (
                        <tr
                          key={kitchen.id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-3 py-3">
                            <div className="font-semibold text-slate-900">
                              {kitchen.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {kitchen.code}
                            </div>
                          </td>

                          <td className="px-3 py-3 font-semibold">
                            {kitchen.orderCount}
                          </td>

                          <td className="px-3 py-3 font-semibold">
                            {kitchen.completedCount}
                          </td>

                          <td className="px-3 py-3 font-semibold">
                            {formatMoney(
                              kitchen.revenue
                            )}
                          </td>

                          <td className="px-3 py-3 font-semibold">
                            {kitchen.averagePrepMinutes !==
                            null
                              ? `${kitchen.averagePrepMinutes}m`
                              : "Unavailable"}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">
                  Channel Performance
                </h2>

                {channelPerformance.length ===
                0 ? (
                  <div className="mt-4 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
                    No channel data available.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {channelPerformance.map(
                      (channel) => (
                        <div
                          key={channel.channel}
                          className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">
                              {channel.channel}
                            </div>
                            <div className="text-xs text-slate-500">
                              {channel.orders} orders
                            </div>
                          </div>

                          <div className="font-bold text-slate-950">
                            {formatMoney(
                              channel.revenue
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">
                  Inventory Watch
                </h2>

                {lowStockItems.length ===
                0 ? (
                  <div className="mt-4 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
                    No low-stock items.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {lowStockItems.map(
                      (item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">
                              {item.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {item.sku}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-bold text-slate-950">
                              {
                                item.currentStock
                              }{" "}
                              {item.unit}
                            </div>
                            <div className="text-xs text-slate-500">
                              Reorder at{" "}
                              {
                                item.reorderThreshold
                              }
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Recent Activity
                  </h2>
                  <p className="text-xs text-slate-500">
                    Latest order state changes
                  </p>
                </div>
              </div>

              {recentOrders.length ===
              0 ? (
                <div className="mt-4 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
                  No order activity available.
                </div>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {recentOrders.map(
                    (order) => (
                      <div
                        key={order.id}
                        className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            {order.id}
                          </div>

                          <div className="text-xs text-slate-500">
                            {order.brandId} ·{" "}
                            {order.kitchenId} ·{" "}
                            {order.channel}
                          </div>
                        </div>

                        <div className="text-left sm:text-right">
                          <div className="text-sm font-bold text-slate-900">
                            {statusLabel(
                              order.status
                            )}
                          </div>

                          <div className="text-xs text-slate-500">
                            Updated{" "}
                            {new Date(
                              order.updatedAt
                            ).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
              Dashboard state: Orders and inventory are
              live from the current application runtime.
              Revenue is only calculated when order totals
              exist in the canonical order data. Missing
              historical or financial data is shown as
              unavailable rather than fabricated.
            </div>
          </>
        )}
      </div>
    </main>
  );
}
