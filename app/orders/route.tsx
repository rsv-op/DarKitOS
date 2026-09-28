"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BRANDS_DB,
  KITCHENS_DB,
  MENU_CATALOG,
  INVENTORY_DB,
  type Order,
} from "@/lib/db";

type OrdersResponse = {
  success: boolean;
  orders?: Order[];
  error?: string;
};

type FilterValue = "ALL" | string;

function formatCurrency(
  value: number
): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTime(
  value?: string
): string {
  if (!value) {
    return "Not recorded";
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOrderValue(
  order: Order
): number {
  return order.items.reduce(
    (total, item) =>
      total +
      item.quantity *
        (item.unitPrice ?? 0),
    0
  );
}

function getStatusLabel(
  status: Order["status"]
): string {
  switch (status) {
    case "READY_FOR_PICKUP":
      return "Ready";

    case "DRIVER_ASSIGNED":
      return "Driver Assigned";

    case "PICKED_UP":
      return "Picked Up";

    case "DISPATCHED":
      return "Dispatched";

    case "CANCELLED":
      return "Cancelled";

    case "PREPARING":
      return "Preparing";

    default:
      return "Pending";
  }
}

export default function OwnerPage() {
  const [orders, setOrders] =
    useState<Order[]>([]);

  const [kitchenFilter, setKitchenFilter] =
    useState<FilterValue>("ALL");

  const [brandFilter, setBrandFilter] =
    useState<FilterValue>("ALL");

  const [channelFilter, setChannelFilter] =
    useState<FilterValue>("ALL");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadOrders =
    useCallback(async () => {
      try {
        const response = await fetch(
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
              "Unable to load owner data"
          );
        }

        setOrders(data.orders ?? []);
        setError("");
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load owner data"
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadOrders();

    const interval =
      window.setInterval(() => {
        void loadOrders();
      }, 5000);

    return () =>
      window.clearInterval(interval);
  }, [loadOrders]);

  const filteredOrders =
    useMemo(() => {
      return orders.filter((order) => {
        const kitchenMatch =
          kitchenFilter === "ALL" ||
          order.kitchenId ===
            kitchenFilter;

        const brandMatch =
          brandFilter === "ALL" ||
          order.brandId === brandFilter;

        const channelMatch =
          channelFilter === "ALL" ||
          order.channel ===
            channelFilter;

        return (
          kitchenMatch &&
          brandMatch &&
          channelMatch
        );
      });
    }, [
      orders,
      kitchenFilter,
      brandFilter,
      channelFilter,
    ]);

  const metrics = useMemo(() => {
    const revenue = filteredOrders.reduce(
      (total, order) =>
        order.status === "CANCELLED"
          ? total
          : total + getOrderValue(order),
      0
    );

    const activeOrders =
      filteredOrders.filter(
        (order) =>
          order.status !== "DISPATCHED" &&
          order.status !== "CANCELLED"
      );

    const completedOrders =
      filteredOrders.filter(
        (order) =>
          order.status ===
          "DISPATCHED"
      );

    const cancelledOrders =
      filteredOrders.filter(
        (order) =>
          order.status ===
          "CANCELLED"
      );

    const averageOrderValue =
      completedOrders.length > 0
        ? completedOrders.reduce(
            (total, order) =>
              total +
              getOrderValue(order),
            0
          ) /
          completedOrders.length
        : 0;

    const prepTimes =
      filteredOrders
        .filter(
          (order) =>
            order.prepStartedAt &&
            order.prepCompletedAt
        )
        .map((order) => {
          const start = new Date(
            order.prepStartedAt!
          ).getTime();

          const end = new Date(
            order.prepCompletedAt!
          ).getTime();

          return Math.max(
            0,
            (end - start) / 60000
          );
        });

    const averagePrepTime =
      prepTimes.length > 0
        ? prepTimes.reduce(
            (sum, value) =>
              sum + value,
            0
          ) / prepTimes.length
        : 0;

    return {
      revenue,
      activeOrders:
        activeOrders.length,
      completedOrders:
        completedOrders.length,
      cancelledOrders:
        cancelledOrders.length,
      averageOrderValue,
      averagePrepTime,
    };
  }, [filteredOrders]);

  const statusBreakdown =
    useMemo(() => {
      const statuses: Order["status"][] =
        [
          "PENDING",
          "PREPARING",
          "READY_FOR_PICKUP",
          "DRIVER_ASSIGNED",
          "PICKED_UP",
          "DISPATCHED",
          "CANCELLED",
        ];

      return statuses.map(
        (status) => ({
          status,
          count:
            filteredOrders.filter(
              (order) =>
                order.status ===
                status
            ).length,
        })
      );
    }, [filteredOrders]);

  const kitchenPerformance =
    useMemo(() => {
      return KITCHENS_DB.map(
        (kitchen) => {
          const kitchenOrders =
            filteredOrders.filter(
              (order) =>
                order.kitchenId ===
                kitchen.id
            );

          const completed =
            kitchenOrders.filter(
              (order) =>
                order.status ===
                "DISPATCHED"
            );

          const cancelled =
            kitchenOrders.filter(
              (order) =>
                order.status ===
                "CANCELLED"
            );

          const revenue =
            completed.reduce(
              (total, order) =>
                total +
                getOrderValue(order),
              0
            );

          return {
            ...kitchen,
            orders:
              kitchenOrders.length,
            completed:
              completed.length,
            cancelled:
              cancelled.length,
            revenue,
          };
        }
      );
    }, [filteredOrders]);

  const brandPerformance =
    useMemo(() => {
      return BRANDS_DB.map(
        (brand) => {
          const brandOrders =
            filteredOrders.filter(
              (order) =>
                order.brandId ===
                brand.id
            );

          const completed =
            brandOrders.filter(
              (order) =>
                order.status ===
                "DISPATCHED"
            );

          const revenue =
            completed.reduce(
              (total, order) =>
                total +
                getOrderValue(order),
              0
            );

          return {
            id: brand.id,
            name:
              brand.name,
            orders:
              brandOrders.length,
            completed:
              completed.length,
            revenue,
          };
        }
      );
    }, [filteredOrders]);

  const channelPerformance =
    useMemo(() => {
      const channels =
        Array.from(
          new Set(
            filteredOrders.map(
              (order) =>
                order.channel
            )
          )
        );

      return channels.map(
        (channel) => {
          const channelOrders =
            filteredOrders.filter(
              (order) =>
                order.channel ===
                channel
            );

          const completed =
            channelOrders.filter(
              (order) =>
                order.status ===
                "DISPATCHED"
            );

          const revenue =
            completed.reduce(
              (total, order) =>
                total +
                getOrderValue(order),
              0
            );

          return {
            channel,
            orders:
              channelOrders.length,
            completed:
              completed.length,
            revenue,
          };
        }
      );
    }, [filteredOrders]);

  const inventoryAlerts =
    useMemo(() => {
      return INVENTORY_DB.filter(
        (item) =>
          item.currentStock <=
          item.reorderThreshold
      );
    }, []);

  const menuUsage =
    useMemo(() => {
      const counts =
        new Map<string, number>();

      filteredOrders.forEach(
        (order) => {
          if (
            order.status ===
            "CANCELLED"
          ) {
            return;
          }

          order.items.forEach(
            (item) => {
              counts.set(
                item.menuItemId,
                (counts.get(
                  item.menuItemId
                ) ?? 0) +
                  item.quantity
              );
            }
          );
        }
      );

      return MENU_CATALOG.map(
        (menuItem) => ({
          ...menuItem,
          quantity:
            counts.get(
              menuItem.id
            ) ?? 0,
        })
      )
        .sort(
          (a, b) =>
            b.quantity -
            a.quantity
        )
        .slice(0, 8);
    }, [filteredOrders]);

  const operationalAlerts =
    useMemo(() => {
      return filteredOrders.filter(
        (order) =>
          order.inventoryDecision ===
            "LOW_STOCK" ||
          order.inventoryDecision ===
            "INSUFFICIENT_STOCK" ||
          order.inventoryWarnings
            ?.length ||
          order.inventoryUnavailable
            ?.length
      );
    }, [filteredOrders]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                Dark Cloud Kitchen OS
              </p>

              <h1 className="mt-1 text-2xl font-bold">
                Owner Command Center
              </h1>

              <p className="mt-1 text-sm text-slate-400">
                Live operational view
                across brands, kitchens
                and channels.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={kitchenFilter}
                onChange={(event) =>
                  setKitchenFilter(
                    event.target.value
                  )
                }
                className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none"
              >
                <option value="ALL">
                  All kitchens
                </option>

                {KITCHENS_DB.map(
                  (kitchen) => (
                    <option
                      key={
                        kitchen.id
                      }
                      value={
                        kitchen.id
                      }
                    >
                      {kitchen.name}
                    </option>
                  )
                )}
              </select>

              <select
                value={brandFilter}
                onChange={(event) =>
                  setBrandFilter(
                    event.target.value
                  )
                }
                className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none"
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

              <select
                value={channelFilter}
                onChange={(event) =>
                  setChannelFilter(
                    event.target.value
                  )
                }
                className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none"
              >
                <option value="ALL">
                  All channels
                </option>

                {Array.from(
                  new Set(
                    orders.map(
                      (order) =>
                        order.channel
                    )
                  )
                ).map(
                  (channel) => (
                    <option
                      key={channel}
                      value={channel}
                    >
                      {channel}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6">
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
            Loading command center...
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <MetricCard
                label="Revenue"
                value={formatCurrency(
                  metrics.revenue
                )}
                detail="Calculated from completed orders"
              />

              <MetricCard
                label="Active orders"
                value={String(
                  metrics.activeOrders
                )}
                detail="Not dispatched or cancelled"
              />

              <MetricCard
                label="Completed"
                value={String(
                  metrics.completedOrders
                )}
                detail="Dispatched orders"
              />

              <MetricCard
                label="Cancelled"
                value={String(
                  metrics.cancelledOrders
                )}
                detail="Recorded cancellations"
              />

              <MetricCard
                label="AOV"
                value={formatCurrency(
                  metrics.averageOrderValue
                )}
                detail="Completed orders"
              />

              <MetricCard
                label="Avg prep"
                value={
                  metrics.averagePrepTime
                    ? `${metrics.averagePrepTime.toFixed(
                        1
                      )} min`
                    : "Unavailable"
                }
                detail="From recorded prep timestamps"
              />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <DashboardSection
                title="Order Status"
                subtitle="Current order lifecycle distribution"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {statusBreakdown.map(
                    (item) => (
                      <div
                        key={
                          item.status
                        }
                        className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3"
                      >
                        <span className="text-sm text-slate-400">
                          {getStatusLabel(
                            item.status
                          )}
                        </span>

                        <span className="text-lg font-bold">
                          {item.count}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </DashboardSection>

              <DashboardSection
                title="Operational Alerts"
                subtitle="Inventory and fulfillment conditions requiring attention"
              >
                <div className="space-y-3">
                  <AlertRow
                    label="Low-stock inventory items"
                    value={
                      inventoryAlerts.length
                    }
                  />

                  <AlertRow
                    label="Orders with inventory warnings"
                    value={
                      operationalAlerts.length
                    }
                  />

                  <AlertRow
                    label="Insufficient-stock orders"
                    value={
                      filteredOrders.filter(
                        (order) =>
                          order.inventoryDecision ===
                          "INSUFFICIENT_STOCK"
                      ).length
                    }
                  />
                </div>
              </DashboardSection>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <DashboardSection
                title="Kitchen Performance"
                subtitle="Operational volume by fulfillment kitchen"
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
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
                          Cancelled
                        </th>
                        <th className="px-3 py-3">
                          Revenue
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {kitchenPerformance.map(
                        (kitchen) => (
                          <tr
                            key={
                              kitchen.id
                            }
                            className="border-b border-slate-900"
                          >
                            <td className="px-3 py-3">
                              <div className="font-medium">
                                {
                                  kitchen.name
                                }
                              </div>

                              <div className="text-xs text-slate-500">
                                {
                                  kitchen.code
                                }
                              </div>
                            </td>

                            <td className="px-3 py-3">
                              {
                                kitchen.orders
                              }
                            </td>

                            <td className="px-3 py-3">
                              {
                                kitchen.completed
                              }
                            </td>

                            <td className="px-3 py-3">
                              {
                                kitchen.cancelled
                              }
                            </td>

                            <td className="px-3 py-3">
                              {formatCurrency(
                                kitchen.revenue
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </DashboardSection>

              <DashboardSection
                title="Brand Performance"
                subtitle="Order and revenue view by virtual brand"
              >
                <div className="space-y-3">
                  {brandPerformance.map(
                    (brand) => (
                      <div
                        key={brand.id}
                        className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold">
                              {brand.name}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {brand.orders}{" "}
                              orders ·{" "}
                              {
                                brand.completed
                              }{" "}
                              completed
                            </p>
                          </div>

                          <p className="font-bold">
                            {formatCurrency(
                              brand.revenue
                            )}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </DashboardSection>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <DashboardSection
                title="Channel Performance"
                subtitle="Recorded order volume and completed revenue"
              >
                {channelPerformance.length ===
                0 ? (
                  <EmptyState text="No channel data available for the selected filters." />
                ) : (
                  <div className="space-y-3">
                    {channelPerformance.map(
                      (channel) => (
                        <div
                          key={
                            channel.channel
                          }
                          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-4"
                        >
                          <div>
                            <p className="font-semibold">
                              {
                                channel.channel
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {
                                channel.orders
                              }{" "}
                              orders ·{" "}
                              {
                                channel.completed
                              }{" "}
                              completed
                            </p>
                          </div>

                          <p className="font-bold">
                            {formatCurrency(
                              channel.revenue
                            )}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                )}
              </DashboardSection>

              <DashboardSection
                title="Menu Usage"
                subtitle="Quantity recorded in the current order set"
              >
                {menuUsage.length ===
                0 ? (
                  <EmptyState text="No menu usage data available." />
                ) : (
                  <div className="space-y-3">
                    {menuUsage.map(
                      (item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-4"
                        >
                          <div>
                            <p className="font-semibold">
                              {item.name}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {
                                item.category
                              }
                            </p>
                          </div>

                          <span className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold">
                            {item.quantity}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                )}
              </DashboardSection>
            </div>

            <div className="mt-6">
              <DashboardSection
                title="Inventory Watch"
                subtitle="Current seed inventory below or at reorder threshold"
              >
                {inventoryAlerts.length ===
                0 ? (
                  <EmptyState text="No inventory items are currently at or below their reorder threshold." />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {inventoryAlerts.map(
                      (item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold">
                              {item.name}
                            </p>

                            <span className="rounded-full bg-amber-400/10 px-2 py-1 text-xs font-medium text-amber-300">
                              Low stock
                            </span>
                          </div>

                          <p className="mt-3 text-sm text-slate-400">
                            Current:{" "}
                            <span className="font-medium text-white">
                              {
                                item.currentStock
                              }{" "}
                              {
                                item.unit
                              }
                            </span>
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            Reorder threshold:{" "}
                            {
                              item.reorderThreshold
                            }{" "}
                            {
                              item.unit
                            }
                          </p>
                        </div>
                      )
                    )}
                  </div>
                )}
              </DashboardSection>
            </div>

            <div className="mt-6">
              <DashboardSection
                title="Recent Operational Activity"
                subtitle="Latest orders in the selected scope"
              >
                {filteredOrders.length ===
                0 ? (
                  <EmptyState text="No orders match the selected filters." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-3 py-3">
                            Order
                          </th>
                          <th className="px-3 py-3">
                            Brand
                          </th>
                          <th className="px-3 py-3">
                            Kitchen
                          </th>
                          <th className="px-3 py-3">
                            Channel
                          </th>
                          <th className="px-3 py-3">
                            Status
                          </th>
                          <th className="px-3 py-3">
                            Value
                          </th>
                          <th className="px-3 py-3">
                            Updated
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredOrders
                          .slice(-20)
                          .reverse()
                          .map(
                            (order) => (
                              <tr
                                key={
                                  order.id
                                }
                                className="border-b border-slate-900"
                              >
                                <td className="px-3 py-3 font-medium">
                                  {
                                    order.id
                                  }
                                </td>

                                <td className="px-3 py-3">
                                  {
                                    order.brandId
                                  }
                                </td>

                                <td className="px-3 py-3">
                                  {
                                    order.kitchenId
                                  }
                                </td>

                                <td className="px-3 py-3">
                                  {
                                    order.channel
                                  }
                                </td>

                                <td className="px-3 py-3">
                                  {getStatusLabel(
                                    order.status
                                  )}
                                </td>

                                <td className="px-3 py-3">
                                  {formatCurrency(
                                    getOrderValue(
                                      order
                                    )
                                  )}
                                </td>

                                <td className="px-3 py-3 text-slate-400">
                                  {formatTime(
                                    order.updatedAt
                                  )}
                                </td>
                              </tr>
                            )
                          )}
                      </tbody>
                    </table>
                  </div>
                )}
              </DashboardSection>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function DashboardSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-5">
        <h2 className="text-lg font-bold">
          {title}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {subtitle}
        </p>
      </div>

      {children}
    </section>
  );
}

function AlertRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
      <span className="text-sm text-slate-400">
        {label}
      </span>

      <span
        className={`text-lg font-bold ${
          value > 0
            ? "text-amber-300"
            : "text-emerald-300"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
