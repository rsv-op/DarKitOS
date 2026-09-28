"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

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

type Scope =
  | "ALL"
  | string;

function formatTime(
  value?: string
): string {
  if (!value) {
    return "--";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "--";
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatDuration(
  start?: string,
  end?: string
): string {
  if (!start || !end) {
    return "--";
  }

  const startTime =
    new Date(start).getTime();

  const endTime =
    new Date(end).getTime();

  if (
    Number.isNaN(startTime) ||
    Number.isNaN(endTime) ||
    endTime < startTime
  ) {
    return "--";
  }

  const minutes =
    (endTime - startTime) /
    60000;

  return `${minutes.toFixed(1)} min`;
}

function getStatusLabel(
  status: Order["status"]
): string {
  return status.replaceAll(
    "_",
    " "
  );
}

export default function OwnerPage() {
  const [orders, setOrders] =
    useState<Order[]>([]);

  const [inventory, setInventory] =
    useState<InventoryItem[]>([]);

  const [kitchenScope, setKitchenScope] =
    useState<Scope>("ALL");

  const [brandScope, setBrandScope] =
    useState<Scope>("ALL");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadData =
    useCallback(
      async () => {
        try {
          const [
            ordersResponse,
            inventoryResponse,
          ] = await Promise.all([
            fetch(
              "/api/orders",
              {
                cache: "no-store",
              }
            ),
            fetch(
              "/api/inventory",
              {
                cache: "no-store",
              }
            ),
          ]);

          const ordersData =
            (await ordersResponse.json()) as OrdersResponse;

          const inventoryData =
            (await inventoryResponse.json()) as InventoryResponse;

          if (
            !ordersResponse.ok
          ) {
            throw new Error(
              ordersData.error ??
                "Unable to load orders."
            );
          }

          if (
            !inventoryResponse.ok
          ) {
            throw new Error(
              inventoryData.error ??
                "Unable to load inventory."
            );
          }

          setOrders(
            Array.isArray(
              ordersData.orders
            )
              ? ordersData.orders
              : []
          );

          setInventory(
            Array.isArray(
              inventoryData.inventory
            )
              ? inventoryData.inventory
              : []
          );

          setError("");
        } catch (loadError) {
          console.error(
            "Owner command center load failed:",
            loadError
          );

          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load owner data."
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    void loadData();

    const interval =
      window.setInterval(
        () => {
          void loadData();
        },
        10000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [loadData]);

  const filteredOrders =
    useMemo(() => {
      return orders.filter(
        (order) => {
          const kitchenMatches =
            kitchenScope ===
              "ALL" ||
            order.kitchenId ===
              kitchenScope;

          const brandMatches =
            brandScope ===
              "ALL" ||
            order.brandId ===
              brandScope;

          return (
            kitchenMatches &&
            brandMatches
          );
        }
      );
    }, [
      orders,
      kitchenScope,
      brandScope,
    ]);

  const analytics =
    useMemo(() => {
      const activeOrders =
        filteredOrders.filter(
          (order) =>
            order.status ===
              "PENDING" ||
            order.status ===
              "PREPARING" ||
            order.status ===
              "READY_FOR_PICKUP" ||
            order.status ===
              "DRIVER_ASSIGNED" ||
            order.status ===
              "PICKED_UP"
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

      const preparingOrders =
        filteredOrders.filter(
          (order) =>
            order.status ===
            "PREPARING"
        );

      const readyOrders =
        filteredOrders.filter(
          (order) =>
            order.status ===
            "READY_FOR_PICKUP"
        );

      const prepDurations =
        filteredOrders
          .map((order) =>
            order.prepStartedAt &&
            order.prepCompletedAt
              ? (
                  new Date(
                    order.prepCompletedAt
                  ).getTime() -
                  new Date(
                    order.prepStartedAt
                  ).getTime()
                ) /
                60000
              : null
          )
          .filter(
            (
              value
            ): value is number =>
              value !== null &&
              Number.isFinite(value) &&
              value >= 0
          );

      const averagePrepMinutes =
        prepDurations.length > 0
          ? prepDurations.reduce(
              (
                total,
                value
              ) =>
                total + value,
              0
            ) /
            prepDurations.length
          : null;

      const brandCounts =
        filteredOrders.reduce(
          (
            result,
            order
          ) => {
            result[order.brandId] =
              (result[
                order.brandId
              ] ?? 0) + 1;

            return result;
          },
          {} as Record<
            string,
            number
          >
        );

      const kitchenCounts =
        filteredOrders.reduce(
          (
            result,
            order
          ) => {
            result[
              order.kitchenId
            ] =
              (result[
                order.kitchenId
              ] ?? 0) + 1;

            return result;
          },
          {} as Record<
            string,
            number
          >
        );

      const channelCounts =
        filteredOrders.reduce(
          (
            result,
            order
          ) => {
            const channel =
              order.channel;

            result[channel] =
              (result[channel] ??
                0) + 1;

            return result;
          },
          {} as Record<
            string,
            number
          >
        );

      return {
        totalOrders:
          filteredOrders.length,
        activeOrders:
          activeOrders.length,
        completedOrders:
          completedOrders.length,
        cancelledOrders:
          cancelledOrders.length,
        preparingOrders:
          preparingOrders.length,
        readyOrders:
          readyOrders.length,
        averagePrepMinutes,
        brandCounts,
        kitchenCounts,
        channelCounts,
      };
    }, [filteredOrders]);

  const lowStockItems =
    useMemo(
      () =>
        inventory.filter(
          (item) =>
            item.currentStock <=
            item.reorderThreshold
        ),
      [inventory]
    );

  const unavailableWarnings =
    useMemo(
      () =>
        filteredOrders.filter(
          (order) =>
            Boolean(
              order.inventoryUnavailable
                ?.length
            )
        ),
      [filteredOrders]
    );

  const stockWarnings =
    useMemo(
      () =>
        filteredOrders.filter(
          (order) =>
            Boolean(
              order.inventoryWarnings
                ?.length
            )
        ),
      [filteredOrders]
    );

  const recentOrders =
    useMemo(
      () =>
        [...filteredOrders]
          .sort(
            (a, b) => {
              const aTime =
                new Date(
                  a.updatedAt
                ).getTime();

              const bTime =
                new Date(
                  b.updatedAt
                ).getTime();

              return (
                bTime - aTime
              );
            }
          )
          .slice(0, 12),
      [filteredOrders]
    );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Dark Cloud Kitchen OS
              </p>

              <h1 className="text-3xl font-black text-slate-900">
                Owner Command Center
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Live operational visibility across kitchens, brands, orders and inventory.
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/cook"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Cook
              </Link>

              <Link
                href="/dispatch"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Dispatch
              </Link>

              <button
                type="button"
                onClick={() =>
                  void loadData()
                }
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
              >
                Refresh
              </button>
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Kitchen
            <select
              value={
                kitchenScope
              }
              onChange={(event) =>
                setKitchenScope(
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal"
            >
              <option value="ALL">
                All kitchens
              </option>

              {KITCHENS_DB.map(
                (kitchen) => (
                  <option
                    key={kitchen.id}
                    value={
                      kitchen.id
                    }
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
              value={
                brandScope
              }
              onChange={(event) =>
                setBrandScope(
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal"
            >
              <option value="ALL">
                All brands
              </option>

              {BRANDS_DB.map(
                (brand) => (
                  <option
                    key={brand.id}
                    value={
                      brand.id
                    }
                  >
                    {brand.name}
                  </option>
                )
              )}
            </select>
          </label>
        </section>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <MetricCard
            label="Total Orders"
            value={
              analytics.totalOrders
            }
          />

          <MetricCard
            label="Active"
            value={
              analytics.activeOrders
            }
          />

          <MetricCard
            label="Preparing"
            value={
              analytics.preparingOrders
            }
          />

          <MetricCard
            label="Ready"
            value={
              analytics.readyOrders
            }
          />

          <MetricCard
            label="Dispatched"
            value={
              analytics.completedOrders
            }
          />

          <MetricCard
            label="Cancelled"
            value={
              analytics.cancelledOrders
            }
          />
        </section>

        <section className="mb-6 grid gap-5 lg:grid-cols-3">
          <Panel title="Preparation Performance">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500">
                  Average prep time
                </p>

                <p className="mt-1 text-3xl font-black text-slate-900">
                  {analytics.averagePrepMinutes !==
                  null
                    ? `${analytics.averagePrepMinutes.toFixed(1)} min`
                    : "--"}
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Calculated
              </span>
            </div>
          </Panel>

          <Panel title="Inventory Watch">
            <p className="text-3xl font-black text-slate-900">
              {lowStockItems.length}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Inventory items at or below reorder threshold.
            </p>

            <p className="mt-3 text-xs font-semibold uppercase text-slate-400">
              Source: live inventory
            </p>
          </Panel>

          <Panel title="Order Risk">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs uppercase text-slate-500">
                  Low stock warnings
                </p>

                <p className="mt-1 text-2xl font-black text-amber-600">
                  {stockWarnings.length}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase text-slate-500">
                  Unavailable
                </p>

                <p className="mt-1 text-2xl font-black text-red-600">
                  {unavailableWarnings.length}
                </p>
              </div>
            </div>
          </Panel>
        </section>

        <section className="mb-6 grid gap-5 lg:grid-cols-3">
          <Panel title="Brand Performance">
            <div className="space-y-3">
              {Object.entries(
                analytics.brandCounts
              ).map(
                ([brand, count]) => (
                  <div
                    key={brand}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"
                  >
                    <span className="font-medium text-slate-700">
                      {brand}
                    </span>

                    <span className="font-black text-slate-900">
                      {count}
                    </span>
                  </div>
                )
              )}

              {Object.keys(
                analytics.brandCounts
              ).length === 0 && (
                <EmptyState />
              )}
            </div>
          </Panel>

          <Panel title="Kitchen Performance">
            <div className="space-y-3">
              {Object.entries(
                analytics.kitchenCounts
              ).map(
                ([kitchen, count]) => (
                  <div
                    key={kitchen}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"
                  >
                    <span className="font-medium text-slate-700">
                      {kitchen}
                    </span>

                    <span className="font-black text-slate-900">
                      {count}
                    </span>
                  </div>
                )
              )}

              {Object.keys(
                analytics.kitchenCounts
              ).length === 0 && (
                <EmptyState />
              )}
            </div>
          </Panel>

          <Panel title="Channel Performance">
            <div className="space-y-3">
              {Object.entries(
                analytics.channelCounts
              ).map(
                ([channel, count]) => (
                  <div
                    key={channel}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"
                  >
                    <span className="font-medium text-slate-700">
                      {channel}
                    </span>

                    <span className="font-black text-slate-900">
                      {count}
                    </span>
                  </div>
                )
              )}

              {Object.keys(
                analytics.channelCounts
              ).length === 0 && (
                <EmptyState />
              )}
            </div>
          </Panel>
        </section>

        <section className="mb-6 grid gap-5 lg:grid-cols-2">
          <Panel title="Inventory Alerts">
            {lowStockItems.length ===
              0 ? (
              <EmptyState text="No low-stock inventory items." />
            ) : (
              <div className="space-y-3">
                {lowStockItems.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-amber-200 bg-amber-50 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-slate-900">
                          {item.name}
                        </span>

                        <span className="text-sm font-bold text-amber-700">
                          {item.currentStock}{" "}
                          {item.unit}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        Reorder threshold:{" "}
                        {
                          item.reorderThreshold
                        }{" "}
                        {item.unit}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
          </Panel>

          <Panel title="Recent Operational Activity">
            {loading &&
            recentOrders.length ===
              0 ? (
              <p className="text-sm text-slate-500">
                Loading live activity...
              </p>
            ) : recentOrders.length ===
              0 ? (
              <EmptyState text="No operational activity available." />
            ) : (
              <div className="space-y-3">
                {recentOrders.map(
                  (order) => (
                    <div
                      key={order.id}
                      className="rounded-xl border border-slate-200 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">
                            {order.id}
                          </p>

                          <p className="text-xs text-slate-500">
                            {order.brandId} ·{" "}
                            {order.kitchenId}
                          </p>
                        </div>

                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          {getStatusLabel(
                            order.status
                          )}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <span>
                          Received:{" "}
                          {formatTime(
                            order.receivedAt
                          )}
                        </span>

                        <span>
                          Ready:{" "}
                          {formatTime(
                            order.readyAt
                          )}
                        </span>

                        <span>
                          Prep:{" "}
                          {formatDuration(
                            order.prepStartedAt,
                            order.prepCompletedAt
                          )}
                        </span>

                        <span>
                          Updated:{" "}
                          {formatTime(
                            order.updatedAt
                          )}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </Panel>
        </section>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-black text-slate-900">
        {title}
      </h2>

      {children}
    </section>
  );
}

function EmptyState({
  text = "No data available.",
}: {
  text?: string;
}) {
  return (
    <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
      {text}
    </p>
  );
}
