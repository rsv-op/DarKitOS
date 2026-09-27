"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";

import type {
  InventoryItem,
  Order,
} from "@/lib/db";

import {
  BRANDS_DB,
  MENU_CATALOG,
} from "@/lib/db";

type TimeRange =
  | "today"
  | "shift";

type AnalyticsOrder = Order & {
  elapsedMins?: number;
};

const REFRESH_INTERVAL_MS = 3000;

function formatCurrency(
  value: number
): string {
  return `$${value.toFixed(2)}`;
}

function getElapsedMinutes(
  order: Order
): number {
  const start =
    order.prepStartedAt ||
    order.createdAt;

  const end =
    order.dispatchedAt ||
    order.prepCompletedAt;

  const startMs =
    new Date(start).getTime();

  const endMs = end
    ? new Date(end).getTime()
    : Date.now();

  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs)
  ) {
    return 0;
  }

  return Math.max(
    0,
    (endMs - startMs) / 60000
  );
}

function getPreparationMinutes(
  order: Order
): number | null {
  if (
    !order.prepStartedAt ||
    !order.prepCompletedAt
  ) {
    return null;
  }

  const start =
    new Date(
      order.prepStartedAt
    ).getTime();

  const end =
    new Date(
      order.prepCompletedAt
    ).getTime();

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end)
  ) {
    return null;
  }

  return Math.max(
    0,
    (end - start) / 60000
  );
}

function getBrandConfig(
  brandId: string
) {
  return BRANDS_DB.find(
    (brand) => brand.id === brandId
  );
}

function getBrandColor(
  colorTheme?: string
): string {
  switch (colorTheme) {
    case "amber":
      return "#f59e0b";

    case "emerald":
      return "#10b981";

    case "red":
      return "#ef4444";

    case "cyan":
    default:
      return "#06b6d4";
  }
}

export default function OwnerAnalysisPage() {
  const [orders, setOrders] =
    useState<Order[]>([]);

  const [inventory, setInventory] =
    useState<InventoryItem[]>([]);

  const [timeRange, setTimeRange] =
    useState<TimeRange>("today");

  const [selectedBrand, setSelectedBrand] =
    useState<string>("ALL");

  const [loading, setLoading] =
    useState(true);

  const [lastSync, setLastSync] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const fetchOwnerData =
    useCallback(async () => {
      try {
        const [
          ordersResponse,
          inventoryResponse,
        ] = await Promise.all([
          fetch("/api/orders", {
            cache: "no-store",
          }),

          fetch("/api/inventory", {
            cache: "no-store",
          }),
        ]);

        if (!ordersResponse.ok) {
          throw new Error(
            "Unable to load order telemetry"
          );
        }

        if (!inventoryResponse.ok) {
          throw new Error(
            "Unable to load inventory telemetry"
          );
        }

        const ordersData =
          await ordersResponse.json();

        const inventoryData =
          await inventoryResponse.json();

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

        setLastSync(
          new Date().toISOString()
        );

        setError(null);
      } catch (err) {
        console.error(
          "Owner analytics sync failed:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to synchronize owner analytics"
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    fetchOwnerData();

    const interval =
      window.setInterval(
        fetchOwnerData,
        REFRESH_INTERVAL_MS
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [fetchOwnerData]);

  const visibleOrders =
    useMemo(() => {
      const now = new Date();

      return orders.filter(
        (order) => {
          if (
            selectedBrand !==
              "ALL" &&
            order.brandId !==
              selectedBrand
          ) {
            return false;
          }

          if (
            timeRange === "shift"
          ) {
            return true;
          }

          const createdAt =
            new Date(
              order.createdAt
            );

          if (
            Number.isNaN(
              createdAt.getTime()
            )
          ) {
            return false;
          }

          return (
            createdAt.toDateString() ===
            now.toDateString()
          );
        }
      );
    }, [
      orders,
      selectedBrand,
      timeRange,
    ]);

  const analytics =
    useMemo(() => {
      let grossRevenue = 0;
      let completedRevenue = 0;

      let preparationMinutes = 0;
      let preparationSamples = 0;

      const brandCounts: Record<
        string,
        number
      > = {};

      const brandRevenue: Record<
        string,
        number
      > = {};

      const channelCounts: Record<
        string,
        number
      > = {};

      const channelRevenue: Record<
        string,
        number
      > = {};

      const menuItemCounts: Record<
        string,
        number
      > = {};

      const menuItemRevenue: Record<
        string,
        number
      > = {};

      const stationCounts: Record<
        string,
        number
      > = {};

      const statusCounts: Record<
        string,
        number
      > = {
        PENDING: 0,
        PREPARING: 0,
        READY_FOR_PICKUP: 0,
        DRIVER_ASSIGNED: 0,
        PICKED_UP: 0,
        DISPATCHED: 0,
        CANCELLED: 0,
      };

      visibleOrders.forEach(
        (order) => {
          statusCounts[
            order.status
          ] =
            (statusCounts[
              order.status
            ] || 0) + 1;

          brandCounts[
            order.brandId
          ] =
            (brandCounts[
              order.brandId
            ] || 0) + 1;

          channelCounts[
            order.channel
          ] =
            (channelCounts[
              order.channel
            ] || 0) + 1;

          let orderRevenue = 0;

          order.items.forEach(
            (item) => {
              const menuItem =
                MENU_CATALOG.find(
                  (menu) =>
                    menu.id ===
                      item.menuItemId ||
                    menu.name ===
                      item.name
                );

              const unitPrice =
                menuItem?.price ||
                0;

              const quantity =
                item.quantity || 0;

              const itemRevenue =
                unitPrice *
                quantity;

              orderRevenue +=
                itemRevenue;

              menuItemCounts[
                item.name
              ] =
                (menuItemCounts[
                  item.name
                ] || 0) +
                quantity;

              menuItemRevenue[
                item.name
              ] =
                (menuItemRevenue[
                  item.name
                ] || 0) +
                itemRevenue;

              if (
                item.station
              ) {
                stationCounts[
                  item.station
                ] =
                  (stationCounts[
                    item.station
                  ] || 0) +
                  quantity;
              }
            }
          );

          grossRevenue +=
            orderRevenue;

          brandRevenue[
            order.brandId
          ] =
            (brandRevenue[
              order.brandId
            ] || 0) +
            orderRevenue;

          channelRevenue[
            order.channel
          ] =
            (channelRevenue[
              order.channel
            ] || 0) +
            orderRevenue;

          if (
            order.status ===
              "READY_FOR_PICKUP" ||
            order.status ===
              "DISPATCHED"
          ) {
            const prepMinutes =
              getPreparationMinutes(
                order
              );

            if (
              prepMinutes !==
              null
            ) {
              preparationMinutes +=
                prepMinutes;

              preparationSamples +=
                1;
            }

            completedRevenue +=
              orderRevenue;
          }
        }
      );

      const activeOrders =
        statusCounts.PENDING +
        statusCounts.PREPARING;

      const fulfilledOrders =
        statusCounts.READY_FOR_PICKUP +
        statusCounts.DRIVER_ASSIGNED +
        statusCounts.PICKED_UP +
        statusCounts.DISPATCHED;

      const averageOrderValue =
        visibleOrders.length >
        0
          ? grossRevenue /
            visibleOrders.length
          : 0;

      const averagePrepTime =
        preparationSamples > 0
          ? preparationMinutes /
            preparationSamples
          : 0;

      const lowStockItems =
        inventory.filter(
          (item) =>
            item.currentStock <=
            item.reorderThreshold
        );

      const criticalStockItems =
        inventory.filter(
          (item) =>
            item.currentStock <=
            item.reorderThreshold *
              0.5
        );

      const inventoryValue =
        inventory.reduce(
          (total, item) =>
            total +
            item.currentStock *
              item.costPerUnit,
          0
        );

      const topMenuItems =
        Object.entries(
          menuItemRevenue
        )
          .sort(
            (
              [, revenueA],
              [, revenueB]
            ) =>
              revenueB -
              revenueA
          )
          .slice(0, 5)
          .map(
            ([
              name,
              revenue,
            ]) => ({
              name,
              revenue,
              quantity:
                menuItemCounts[
                  name
                ] || 0,
            })
          );

      const topBrands =
        Object.entries(
          brandRevenue
        )
          .sort(
            (
              [, revenueA],
              [, revenueB]
            ) =>
              revenueB -
              revenueA
          )
          .map(
            ([
              brand,
              revenue,
            ]) => ({
              brand,
              revenue,
              orders:
                brandCounts[
                  brand
                ] || 0,
            })
          );

      const topChannels =
        Object.entries(
          channelRevenue
        )
          .sort(
            (
              [, revenueA],
              [, revenueB]
            ) =>
              revenueB -
              revenueA
          )
          .map(
            ([
              channel,
              revenue,
            ]) => ({
              channel,
              revenue,
              orders:
                channelCounts[
                  channel
                ] || 0,
            })
          );

      const topStations =
        Object.entries(
          stationCounts
        )
          .sort(
            (
              [, countA],
              [, countB]
            ) =>
              countB -
              countA
          )
          .map(
            ([
              station,
              count,
            ]) => ({
              station,
              count,
            })
          );

      return {
        grossRevenue,
        completedRevenue,
        totalOrders:
          visibleOrders.length,
        activeOrders,
        fulfilledOrders,
        cancelledOrders:
          statusCounts.CANCELLED,
        averageOrderValue,
        averagePrepTime,
        statusCounts,
        brandCounts,
        brandRevenue,
        channelCounts,
        channelRevenue,
        topMenuItems,
        topBrands,
        topChannels,
        topStations,
        lowStockItems,
        criticalStockItems,
        inventoryValue,
      };
    }, [
      visibleOrders,
      inventory,
    ]);

  const activeOrderRows =
    useMemo<AnalyticsOrder[]>(
      () => {
        return visibleOrders
          .filter(
            (order) =>
              order.status ===
                "PENDING" ||
              order.status ===
                "PREPARING" ||
              order.status ===
                "READY_FOR_PICKUP"
          )
          .map((order) => ({
            ...order,
            elapsedMins:
              getElapsedMinutes(
                order
              ),
          }))
          .sort(
            (a, b) =>
              (b.elapsedMins ||
                0) -
              (a.elapsedMins ||
                0)
          )
          .slice(0, 8);
      },
      [visibleOrders]
    );

  const brandEntries =
    Object.entries(
      analytics.brandCounts
    );

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-6 font-sans">
      <header className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b border-neutral-800 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />

            <h1 className="text-2xl font-bold tracking-tight">
              Owner Command Center
            </h1>
          </div>

          <p className="text-xs text-neutral-400 mt-1">
            Dark Cloud Kitchen OS · Live operational analysis
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-3 text-[10px] font-mono uppercase">
            <span className="px-2 py-1 rounded border border-emerald-900/60 bg-emerald-950/30 text-emerald-400">
              Live
            </span>

            <span className="px-2 py-1 rounded border border-neutral-800 bg-neutral-900 text-neutral-500">
              Calculated from current operational state
            </span>

            {lastSync && (
              <span className="text-neutral-600">
                Sync{" "}
                {new Date(
                  lastSync
                ).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={selectedBrand}
            onChange={(event) =>
              setSelectedBrand(
                event.target.value
              )
            }
            className="text-xs px-3 py-2 rounded border border-neutral-700 bg-neutral-900 text-neutral-200"
          >
            <option value="ALL">
              All Brands
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

          <button
            onClick={() =>
              setTimeRange(
                timeRange ===
                  "today"
                  ? "shift"
                  : "today"
              )
            }
            className="text-xs px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:border-neutral-500 transition font-mono uppercase"
          >
            View:{" "}
            {timeRange}
          </button>

          <Link
            href="/cook"
            className="text-xs px-3 py-2 rounded border border-neutral-700 hover:bg-neutral-800 transition"
          >
            Cook KDS
          </Link>

          <Link
            href="/dispatch"
            className="text-xs px-3 py-2 rounded border border-neutral-700 hover:bg-neutral-800 transition"
          >
            Dispatch
          </Link>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-300">
          <strong>
            Telemetry error:
          </strong>{" "}
          {error}
        </div>
      )}

      {loading && (
        <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-xs font-mono text-neutral-400">
          Synchronizing operational telemetry...
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-neutral-900/70 border border-neutral-800 p-4 sm:p-5 rounded-lg">
          <span className="text-[10px] sm:text-xs font-mono uppercase text-neutral-400 tracking-wider">
            Gross Sales
          </span>

          <div className="text-2xl sm:text-3xl font-extrabold mt-2 text-emerald-400 font-mono">
            {formatCurrency(
              analytics.grossRevenue
            )}
          </div>

          <p className="text-[10px] text-neutral-500 mt-1">
            Calculated from canonical menu prices
          </p>
        </div>

        <div className="bg-neutral-900/70 border border-neutral-800 p-4 sm:p-5 rounded-lg">
          <span className="text-[10px] sm:text-xs font-mono uppercase text-neutral-400 tracking-wider">
            Orders
          </span>

          <div className="text-2xl sm:text-3xl font-extrabold mt-2 text-white font-mono">
            {analytics.totalOrders}
          </div>

          <p className="text-[10px] text-neutral-500 mt-1">
            {analytics.activeOrders}{" "}
            active ·{" "}
            {analytics.fulfilledOrders}{" "}
            fulfilled
          </p>
        </div>

        <div className="bg-neutral-900/70 border border-neutral-800 p-4 sm:p-5 rounded-lg">
          <span className="text-[10px] sm:text-xs font-mono uppercase text-neutral-400 tracking-wider">
            Avg Order
          </span>

          <div className="text-2xl sm:text-3xl font-extrabold mt-2 text-cyan-400 font-mono">
            {formatCurrency(
              analytics.averageOrderValue
            )}
          </div>

          <p className="text-[10px] text-neutral-500 mt-1">
            Calculated AOV
          </p>
        </div>

        <div className="bg-neutral-900/70 border border-neutral-800 p-4 sm:p-5 rounded-lg">
          <span className="text-[10px] sm:text-xs font-mono uppercase text-neutral-400 tracking-wider">
            Low Stock
          </span>

          <div className="text-2xl sm:text-3xl font-extrabold mt-2 text-rose-400 font-mono">
            {analytics.lowStockItems.length}
          </div>

          <p className="text-[10px] text-neutral-500 mt-1">
            {analytics.criticalStockItems.length}{" "}
            critical
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="xl:col-span-2 bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
                Operational Pipeline
              </h2>

              <p className="text-[10px] text-neutral-500 mt-1">
                Current order distribution
              </p>
            </div>

            <span className="text-[10px] font-mono text-neutral-500">
              LIVE
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {(
              [
                [
                  "PENDING",
                  "Pending",
                ],
                [
                  "PREPARING",
                  "Preparing",
                ],
                [
                  "READY_FOR_PICKUP",
                  "Ready",
                ],
                [
                  "DISPATCHED",
                  "Dispatched",
                ],
                [
                  "CANCELLED",
                  "Cancelled",
                ],
              ] as const
            ).map(
              ([
                status,
                label,
              ]) => (
                <div
                  key={status}
                  className="rounded-lg border border-neutral-800 bg-neutral-950 p-3"
                >
                  <p className="text-[10px] text-neutral-500 uppercase font-mono">
                    {label}
                  </p>

                  <p className="text-2xl font-bold mt-1 font-mono">
                    {analytics
                      .statusCounts[
                      status
                    ] ||
                      0}
                  </p>
                </div>
              )
            )}
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-xs text-neutral-500 mb-2">
              <span>
                Active pipeline
              </span>

              <span>
                {
                  analytics.activeOrders
                }{" "}
                /{" "}
                {
                  analytics.totalOrders
                }
              </span>
            </div>

            <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-500"
                style={{
                  width: `${
                    analytics.totalOrders >
                    0
                      ? Math.min(
                          100,
                          (analytics.activeOrders /
                            analytics.totalOrders) *
                            100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
            Kitchen Performance
          </h2>

          <p className="text-[10px] text-neutral-500 mt-1 mb-4">
            Calculated from completed preparation timestamps
          </p>

          <div className="text-4xl font-extrabold font-mono text-cyan-400">
            {analytics.averagePrepTime >
            0
              ? `${analytics.averagePrepTime.toFixed(
                  1
                )}`
              : "—"}
          </div>

          <p className="text-xs text-neutral-500 mt-1">
            Average preparation minutes
          </p>

          <div className="mt-5 pt-4 border-t border-neutral-800 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase text-neutral-500">
                Active
              </p>

              <p className="text-xl font-bold font-mono mt-1">
                {
                  analytics.activeOrders
                }
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase text-neutral-500">
                Fulfilled
              </p>

              <p className="text-xl font-bold font-mono mt-1">
                {
                  analytics.fulfilledOrders
                }
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300 mb-4">
            Brand Performance
          </h2>

          {brandEntries.length ===
          0 ? (
            <p className="text-xs text-neutral-500">
              No order data available.
            </p>
          ) : (
            <div className="space-y-4">
              {brandEntries.map(
                ([
                  brand,
                  count,
                ]) => {
                  const revenue =
                    analytics
                      .brandRevenue[
                      brand
                    ] || 0;

                  const percentage =
                    analytics.totalOrders >
                    0
                      ? (count /
                          analytics.totalOrders) *
                        100
                      : 0;

                  const config =
                    getBrandConfig(
                      brand
                    );

                  const brandColor =
                    getBrandColor(
                      config?.colorTheme
                    );

                  return (
                    <div
                      key={brand}
                    >
                      <div className="flex justify-between text-xs mb-1">
                        <span
                          className="font-medium"
                          style={{
                            color:
                              brandColor,
                          }}
                        >
                          {config?.name ||
                            brand}
                        </span>

                        <span className="font-mono text-neutral-400">
                          {count}{" "}
                          orders ·{" "}
                          {formatCurrency(
                            revenue
                          )}
                        </span>
                      </div>

                      <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor:
                              brandColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300 mb-4">
            Channel Performance
          </h2>

          <div className="space-y-3">
            {analytics
              .topChannels.length ===
            0 ? (
              <p className="text-xs text-neutral-500">
                No channel data available.
              </p>
            ) : (
              analytics.topChannels.map(
                (channel) => (
                  <div
                    key={
                      channel.channel
                    }
                    className="flex items-center justify-between p-3 rounded bg-neutral-950 border border-neutral-800"
                  >
                    <div>
                      <p className="text-xs font-medium text-neutral-200">
                        {
                          channel.channel
                        }
                      </p>

                      <p className="text-[10px] text-neutral-500 mt-1">
                        {
                          channel.orders
                        }{" "}
                        orders
                      </p>
                    </div>

                    <span className="font-mono text-sm text-emerald-400">
                      {formatCurrency(
                        channel.revenue
                      )}
                    </span>
                  </div>
                )
              )
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300 mb-4">
            Menu Performance
          </h2>

          {analytics
            .topMenuItems.length ===
          0 ? (
            <p className="text-xs text-neutral-500">
              No menu sales data available.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase font-mono text-neutral-500 border-b border-neutral-800">
                  <tr>
                    <th className="py-2 pr-4">
                      Menu Item
                    </th>

                    <th className="py-2 pr-4">
                      Units
                    </th>

                    <th className="py-2">
                      Revenue
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {analytics.topMenuItems.map(
                    (item) => (
                      <tr
                        key={
                          item.name
                        }
                        className="border-b border-neutral-900"
                      >
                        <td className="py-3 pr-4 text-neutral-200">
                          {
                            item.name
                          }
                        </td>

                        <td className="py-3 pr-4 font-mono text-neutral-400">
                          {
                            item.quantity
                          }
                        </td>

                        <td className="py-3 font-mono text-emerald-400">
                          {formatCurrency(
                            item.revenue
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300 mb-4">
            Station Workload
          </h2>

          {analytics
            .topStations.length ===
          0 ? (
            <p className="text-xs text-neutral-500">
              No station workload data available.
            </p>
          ) : (
            <div className="space-y-3">
              {analytics.topStations.map(
                (station) => (
                  <div
                    key={
                      station.station
                    }
                    className="flex justify-between items-center p-3 bg-neutral-950 border border-neutral-800 rounded"
                  >
                    <span className="text-xs text-neutral-300">
                      {
                        station.station
                      }
                    </span>

                    <span className="font-mono text-xs text-cyan-400">
                      {
                        station.count
                      }{" "}
                      units
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
          <div className="flex justify-between items-start gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
                Inventory Intelligence
              </h2>

              <p className="text-[10px] text-neutral-500 mt-1">
                Live inventory state from the shared inventory API
              </p>
            </div>

            <span className="font-mono text-xs text-neutral-400">
              {formatCurrency(
                analytics.inventoryValue
              )}
            </span>
          </div>

          {analytics
            .lowStockItems.length ===
          0 ? (
            <div className="rounded border border-emerald-900/50 bg-emerald-950/20 p-4 text-xs text-emerald-400">
              No ingredients are currently below their reorder threshold.
            </div>
          ) : (
            <div className="space-y-2">
              {analytics.lowStockItems.map(
                (item) => {
                  const critical =
                    item.currentStock <=
                    item.reorderThreshold *
                      0.5;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-4 p-3 rounded border ${
                        critical
                          ? "bg-rose-950/30 border-rose-800/60"
                          : "bg-amber-950/20 border-amber-800/50"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-medium text-neutral-200">
                          {
                            item.name
                          }
                        </p>

                        <p className="text-[10px] text-neutral-500 font-mono mt-1">
                          Reorder at{" "}
                          {
                            item.reorderThreshold
                          }{" "}
                          {
                            item.unit
                          }
                        </p>
                      </div>

                      <div className="text-right">
                        <p
                          className={`text-sm font-bold font-mono ${
                            critical
                              ? "text-rose-400"
                              : "text-amber-400"
                          }`}
                        >
                          {
                            item.currentStock
                          }{" "}
                          {
                            item.unit
                          }
                        </p>

                        <p className="text-[9px] uppercase font-bold mt-1">
                          {critical
                            ? "Critical"
                            : "Restock Required"}
                        </p>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300 mb-4">
            Operational Attention
          </h2>

          <div className="space-y-3">
            {analytics.activeOrders >
              0 && (
              <div className="p-3 rounded border border-cyan-900/50 bg-cyan-950/20">
                <p className="text-xs font-semibold text-cyan-300">
                  Active order pipeline
                </p>

                <p className="text-[10px] text-neutral-400 mt-1">
                  {
                    analytics.activeOrders
                  }{" "}
                  order
                  {analytics.activeOrders ===
                  1
                    ? ""
                    : "s"}{" "}
                  currently require kitchen activity.
                </p>
              </div>
            )}

            {analytics.statusCounts
              .READY_FOR_PICKUP >
              0 && (
              <div className="p-3 rounded border border-emerald-900/50 bg-emerald-950/20">
                <p className="text-xs font-semibold text-emerald-300">
                  Ready for dispatch
                </p>

                <p className="text-[10px] text-neutral-400 mt-1">
                  {
                    analytics
                      .statusCounts
                      .READY_FOR_PICKUP
                  }{" "}
                  order
                  {analytics
                    .statusCounts
                    .READY_FOR_PICKUP ===
                  1
                    ? ""
                    : "s"}{" "}
                  waiting for handoff.
                </p>
              </div>
            )}

            {analytics
              .lowStockItems
              .length > 0 && (
              <div className="p-3 rounded border border-amber-900/50 bg-amber-950/20">
                <p className="text-xs font-semibold text-amber-300">
                  Inventory attention required
                </p>

                <p className="text-[10px] text-neutral-400 mt-1">
                  {
                    analytics
                      .lowStockItems
                      .length
                  }{" "}
                  ingredient
                  {analytics
                    .lowStockItems
                    .length ===
                  1
                    ? ""
                    : "s"}{" "}
                  are at or below reorder threshold.
                </p>
              </div>
            )}

            {analytics.activeOrders ===
              0 &&
              analytics.lowStockItems
                .length === 0 &&
              analytics.statusCounts
                .READY_FOR_PICKUP ===
                0 && (
                <div className="p-3 rounded border border-neutral-800 bg-neutral-950">
                  <p className="text-xs font-semibold text-neutral-300">
                    No immediate operational alerts
                  </p>

                  <p className="text-[10px] text-neutral-500 mt-1">
                    Based only on the currently available operational data.
                  </p>
                </div>
              )}
          </div>
        </div>
      </section>

      <section className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
              Active Order Monitor
            </h2>

            <p className="text-[10px] text-neutral-500 mt-1">
              Longest-running active tickets shown first
            </p>
          </div>

          <span className="text-[10px] font-mono text-neutral-600">
            LIVE TELEMETRY
          </span>
        </div>

        {activeOrderRows.length ===
        0 ? (
          <div className="rounded border border-neutral-800 bg-neutral-950 p-4 text-xs text-neutral-500">
            No active orders in the selected view.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase font-mono text-neutral-500 border-b border-neutral-800">
                <tr>
                  <th className="py-2 pr-4">
                    Order
                  </th>

                  <th className="py-2 pr-4">
                    Brand
                  </th>

                  <th className="py-2 pr-4">
                    Channel
                  </th>

                  <th className="py-2 pr-4">
                    Status
                  </th>

                  <th className="py-2">
                    Elapsed
                  </th>
                </tr>
              </thead>

              <tbody>
                {activeOrderRows.map(
                  (order) => {
                    const brand =
                      getBrandConfig(
                        order.brandId
                      );

                    return (
                      <tr
                        key={
                          order.id
                        }
                        className="border-b border-neutral-900"
                      >
                        <td className="py-3 pr-4 font-mono text-neutral-200">
                          {
                            order.id
                          }
                        </td>

                        <td className="py-3 pr-4 text-neutral-300">
                          {brand?.name ||
                            order.brandId}
                        </td>

                        <td className="py-3 pr-4 text-neutral-400">
                          {
                            order.channel
                          }
                        </td>

                        <td className="py-3 pr-4">
                          <span className="px-2 py-1 rounded border border-neutral-800 bg-neutral-950 font-mono text-[10px]">
                            {
                              order.status
                            }
                          </span>
                        </td>

                        <td className="py-3 font-mono text-cyan-400">
                          {(
                            order.elapsedMins ||
                            0
                          ).toFixed(
                            1
                          )}{" "}
                          min
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
