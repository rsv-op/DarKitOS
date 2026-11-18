"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import DesktopWindowManager from "@/components/DesktopWindowManager";
import WorkspaceQuickStart from "@/components/WorkspaceQuickStart";
import {
  BRANDS_DB,
  KITCHENS_DB,
  type CancellationRecord,
  type InventoryItem,
  type OperationalActivity,
  type Order,
  type RevenueLeakageVector,
  type VirtualFileAsset,
} from "@/lib/db";

interface SystemResponse {
  orders?: Order[];
  inventory?: InventoryItem[];
  cancellations?: CancellationRecord[];
  activities?: OperationalActivity[];
  leakageVectors?: RevenueLeakageVector[];
  files?: VirtualFileAsset[];
  error?: string;
}

function formatTime(value?: string): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(
  start?: string,
  end?: string,
): string {
  if (!start || !end) return "--";
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (
    Number.isNaN(s) ||
    Number.isNaN(e) ||
    e < s
  )
    return "--";
  return `${((e - s) / 60000).toFixed(1)}m`;
}

const STATUS_BADGE: Record<
  Order["status"],
  string
> = {
  PENDING:
    "border-amber-500/40 bg-amber-500/10 text-amber-300",
  PREPARING:
    "border-sky-500/40 bg-sky-500/10 text-sky-300",
  READY_FOR_PICKUP:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  DRIVER_ASSIGNED:
    "border-purple-500/40 bg-purple-500/10 text-purple-300",
  PICKED_UP:
    "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
  DISPATCHED:
    "border-teal-500/40 bg-teal-500/10 text-teal-300",
  CANCELLED:
    "border-red-500/40 bg-red-500/10 text-red-300",
};

export default function OwnerPage() {
  const [orders, setOrders] = useState<Order[]>(
    [],
  );
  const [inventory, setInventory] = useState<
    InventoryItem[]
  >([]);
  const [cancellations, setCancellations] =
    useState<CancellationRecord[]>([]);
  const [activities, setActivities] = useState<
    OperationalActivity[]
  >([]);
  const [leakageVectors, setLeakageVectors] =
    useState<RevenueLeakageVector[]>([]);
  const [files, setFiles] = useState<
    VirtualFileAsset[]
  >([]);

  const [kitchenScope, setKitchenScope] =
    useState<string>("ALL");
  const [brandScope, setBrandScope] =
    useState<string>("ALL");
  const [viewMode, setViewMode] = useState<
    "FLUIDIC" | "DESKTOP_OS"
  >("FLUIDIC");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/system", {
        cache: "no-store",
      });
      const data =
        (await res.json()) as SystemResponse;

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Unable to load canonical system state.",
        );
      }

      setOrders(
        Array.isArray(data.orders)
          ? data.orders
          : [],
      );
      setInventory(
        Array.isArray(data.inventory)
          ? data.inventory
          : [],
      );
      setCancellations(
        Array.isArray(data.cancellations)
          ? data.cancellations
          : [],
      );
      setActivities(
        Array.isArray(data.activities)
          ? data.activities
          : [],
      );
      setLeakageVectors(
        Array.isArray(data.leakageVectors)
          ? data.leakageVectors
          : [],
      );
      setFiles(
        Array.isArray(data.files)
          ? data.files
          : [],
      );
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load command center data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => {
      void loadData();
    }, 6000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  async function handleQuickTransition(
    orderId: string,
    status: Order["status"],
  ) {
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          action: status,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(
          err.error || "Transition failed",
        );
      }
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Action failed",
      );
    }
  }

  async function handleStoreAction(
    action: "RESET_STORE" | "CLEAR_ORDERS",
  ) {
    await fetch("/api/system", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    });
    await loadData();
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const kMatch =
        kitchenScope === "ALL" ||
        order.kitchenId === kitchenScope;
      const bMatch =
        brandScope === "ALL" ||
        order.brandId === brandScope;
      return kMatch && bMatch;
    });
  }, [orders, kitchenScope, brandScope]);

  const analytics = useMemo(() => {
    const activeOrders = filteredOrders.filter(
      (o) =>
        o.status === "PENDING" ||
        o.status === "PREPARING" ||
        o.status === "READY_FOR_PICKUP" ||
        o.status === "DRIVER_ASSIGNED" ||
        o.status === "PICKED_UP",
    );
    const pendingOrders = filteredOrders.filter(
      (o) => o.status === "PENDING",
    );
    const preparingOrders =
      filteredOrders.filter(
        (o) => o.status === "PREPARING",
      );
    const readyOrders = filteredOrders.filter(
      (o) => o.status === "READY_FOR_PICKUP",
    );
    const inTransitOrders =
      filteredOrders.filter(
        (o) =>
          o.status === "DRIVER_ASSIGNED" ||
          o.status === "PICKED_UP",
      );
    const completedOrders =
      filteredOrders.filter(
        (o) => o.status === "DISPATCHED",
      );
    const cancelledOrders =
      filteredOrders.filter(
        (o) => o.status === "CANCELLED",
      );

    const nonCancelled = filteredOrders.filter(
      (o) => o.status !== "CANCELLED",
    );
    const grossRevenue = nonCancelled.reduce(
      (sum, o) => sum + (o.totalAmount ?? 0),
      0,
    );
    const aov =
      nonCancelled.length > 0
        ? grossRevenue / nonCancelled.length
        : 0;

    const totalLoss = filteredOrders.reduce(
      (sum, o) => sum + (o.lossAmount ?? 0),
      0,
    );
    const totalClaims = filteredOrders.reduce(
      (sum, o) => sum + (o.claimAmount ?? 0),
      0,
    );

    const prepDurations = filteredOrders
      .map((o) =>
        o.prepStartedAt && o.prepCompletedAt
          ? (new Date(
              o.prepCompletedAt,
            ).getTime() -
              new Date(
                o.prepStartedAt,
              ).getTime()) /
            60000
          : null,
      )
      .filter(
        (v): v is number =>
          v !== null &&
          Number.isFinite(v) &&
          v >= 0,
      );

    const averagePrepMinutes =
      prepDurations.length > 0
        ? prepDurations.reduce(
            (a, b) => a + b,
            0,
          ) / prepDurations.length
        : null;

    const brandStats = BRANDS_DB.map((b) => {
      const list = filteredOrders.filter(
        (o) => o.brandId === b.id,
      );
      const rev = list
        .filter((o) => o.status !== "CANCELLED")
        .reduce(
          (s, o) => s + (o.totalAmount ?? 0),
          0,
        );
      return {
        ...b,
        count: list.length,
        revenue: rev,
      };
    });

    const kitchenStats = KITCHENS_DB.map(
      (k) => {
        const list = filteredOrders.filter(
          (o) => o.kitchenId === k.id,
        );
        const rev = list
          .filter(
            (o) => o.status !== "CANCELLED",
          )
          .reduce(
            (s, o) => s + (o.totalAmount ?? 0),
            0,
          );
        return {
          ...k,
          count: list.length,
          revenue: rev,
        };
      },
    );

    const channelMap: Record<
      string,
      { count: number; revenue: number }
    > = {};
    for (const o of filteredOrders) {
      if (!channelMap[o.channel]) {
        channelMap[o.channel] = {
          count: 0,
          revenue: 0,
        };
      }
      channelMap[o.channel].count += 1;
      if (o.status !== "CANCELLED") {
        channelMap[o.channel].revenue +=
          o.totalAmount ?? 0;
      }
    }

    return {
      totalOrders: filteredOrders.length,
      activeOrders: activeOrders.length,
      pendingOrders: pendingOrders.length,
      preparingOrders: preparingOrders.length,
      readyOrders: readyOrders.length,
      inTransitOrders: inTransitOrders.length,
      completedOrders: completedOrders.length,
      cancelledOrders: cancelledOrders.length,
      grossRevenue,
      aov,
      totalLoss,
      totalClaims,
      averagePrepMinutes,
      brandStats,
      kitchenStats,
      channelMap,
    };
  }, [filteredOrders]);

  const lowStockItems = useMemo(
    () =>
      inventory.filter(
        (item) =>
          item.currentStock <=
          item.reorderThreshold,
      ),
    [inventory],
  );

  const totalPotentialRev = useMemo(
    () =>
      leakageVectors.reduce(
        (s, v) => s + v.potentialRevenue,
        0,
      ),
    [leakageVectors],
  );
  const totalCollectedRev = useMemo(
    () =>
      leakageVectors.reduce(
        (s, v) => s + v.actualCollected,
        0,
      ),
    [leakageVectors],
  );
  const leakagePct =
    totalPotentialRev > 0
      ? ((totalPotentialRev -
          totalCollectedRev) /
          totalPotentialRev) *
        100
      : 0;

  return (
    <AppShell
      title="Overview"
      subtitle="See orders, ingredient stock, and sales across the kitchens you can access."
      actions={
        <>
          <div role="group" aria-label="Overview view" className="flex rounded-xl border border-slate-800 bg-slate-900 p-1">
            <button
              type="button"
              onClick={() =>
                setViewMode("FLUIDIC")
              }
              className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition ${
                viewMode === "FLUIDIC"
                  ? "bg-sky-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() =>
                setViewMode("DESKTOP_OS")
              }
              className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition ${
                viewMode === "DESKTOP_OS"
                  ? "bg-emerald-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Desktop view
            </button>
          </div>

          <Link
            href="/order-injection"
            className="rounded-xl bg-sky-500 px-3.5 py-2 font-mono text-xs font-bold text-slate-950 transition hover:bg-sky-400"
          >
            Add sample order
          </Link>

          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 font-mono text-xs font-bold text-white hover:bg-slate-700"
          >
            ↻ Refresh
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-300">
          ⚠ {error}
        </div>
      )}

      {viewMode === "DESKTOP_OS" ? (
        <DesktopWindowManager
          orders={filteredOrders}
          inventory={inventory}
          files={files}
          onQuickTransition={
            handleQuickTransition
          }
        />
      ) : (
        <div className="space-y-6">
          <WorkspaceQuickStart />
          <section aria-label="Overview filters" className="grid gap-4 rounded-2xl border border-slate-800/90 bg-slate-900/60 p-4 sm:grid-cols-2">
            <label className="block">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Kitchen location
              </span>
              <select
                value={kitchenScope}
                onChange={(e) =>
                  setKitchenScope(
                    e.target.value,
                  )
                }
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400"
              >
                <option value="ALL">
                  All kitchens
                </option>
                {KITCHENS_DB.map((k) => (
                  <option
                    key={k.id}
                    value={k.id}
                  >
                    {k.id} • {k.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Food brand
              </span>
              <select
                value={brandScope}
                onChange={(e) =>
                  setBrandScope(e.target.value)
                }
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400"
              >
                <option value="ALL">
                  All brands
                </option>
                {BRANDS_DB.map((b) => (
                  <option
                    key={b.id}
                    value={b.id}
                  >
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </label>

          </section>

          {/* 8 Real-Time KPI Cards */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            <KpiCard
              label="Total Orders"
              value={String(
                analytics.totalOrders,
              )}
              sub="Across selected kitchens"
              tone="slate"
            />
            <KpiCard
              label="Gross Sales"
              value={`$${analytics.grossRevenue.toFixed(2)}`}
              sub={`Average $${analytics.aov.toFixed(2)} per order`}
              tone="emerald"
            />
            <KpiCard
              label="Active Queue"
              value={String(
                analytics.activeOrders,
              )}
              sub={`${analytics.pendingOrders} Pending`}
              tone="sky"
            />
            <KpiCard
              label="Preparing"
              value={String(
                analytics.preparingOrders,
              )}
              sub="On the Kitchen Board"
              tone="amber"
            />
            <KpiCard
              label="Ready for Pickup"
              value={String(
                analytics.readyOrders,
              )}
              sub={`${analytics.inTransitOrders} With Courier`}
              tone="emerald"
            />
            <KpiCard
              label="Dispatched"
              value={String(
                analytics.completedOrders,
              )}
              sub="Handed to courier"
              tone="teal"
            />
            <KpiCard
              label="Cancelled"
              value={String(
                analytics.cancelledOrders,
              )}
              sub={`Loss $${analytics.totalLoss.toFixed(2)}`}
              tone="red"
            />
            <KpiCard
              label="Avg Prep Time"
              value={
                analytics.averagePrepMinutes !==
                null
                  ? `${analytics.averagePrepMinutes.toFixed(1)}m`
                  : "--"
              }
              sub="Target SLA <= 12m"
              tone="purple"
            />
          </section>

          {/* Operational Pipeline Progress Bar */}
          <section className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Orders by status
                </h2>
                <p className="text-xs text-slate-400">
                  See how many orders are waiting, cooking, or on their way out.
                </p>
              </div>
              <Link
                href="/live-orders"
                className="font-mono text-xs font-bold text-sky-400 hover:underline"
              >
                View Live Orders →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
              {(
                [
                  {
                    status: "PENDING",
                    label: "Pending",
                    href: "/kds",
                  },
                  {
                    status: "PREPARING",
                    label: "Preparing",
                    href: "/kds",
                  },
                  {
                    status: "READY_FOR_PICKUP",
                    label: "Ready",
                    href: "/dispatch",
                  },
                  {
                    status: "DRIVER_ASSIGNED",
                    label: "Driver Assigned",
                    href: "/dispatch",
                  },
                  {
                    status: "PICKED_UP",
                    label: "Picked Up",
                    href: "/dispatch",
                  },
                  {
                    status: "DISPATCHED",
                    label: "Dispatched",
                    href: "/live-orders",
                  },
                  {
                    status: "CANCELLED",
                    label: "Cancelled",
                    href: "/analytics",
                  },
                ] as const
              ).map((st) => {
                const count =
                  filteredOrders.filter(
                    (o) =>
                      o.status === st.status,
                  ).length;
                return (
                  <Link
                    key={st.status}
                    href={st.href}
                    className={`rounded-xl border p-3 transition hover:scale-[1.02] ${STATUS_BADGE[st.status]}`}
                  >
                    <p className="font-mono text-[10px] font-bold uppercase">
                      {st.label}
                    </p>
                    <p className="mt-1 text-2xl font-black">
                      {count}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* 3 Diagnostic Highlights: VerticalForge Leakage, Inventory Watch, Cancellation Ledger */}
          <section className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-2xl border border-purple-500/30 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase text-purple-400">
                  VerticalForge • Quote-to-Cash
                </span>
                <Link
                  href="/analytics"
                  className="font-mono text-xs text-purple-300 hover:underline"
                >
                  Full Audit →
                </Link>
              </div>
              <p className="mt-2 text-3xl font-black text-white">
                {leakagePct.toFixed(2)}%{" "}
                <span className="text-sm font-normal text-slate-400">
                  Revenue Leakage
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Formula: (Potential $
                {totalPotentialRev.toLocaleString()}{" "}
                − Collected $
                {totalCollectedRev.toLocaleString()}
                ) ÷ Potential
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {leakageVectors
                  .slice(0, 3)
                  .map((v) => (
                    <span
                      key={v.id}
                      className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-[10px] text-slate-300"
                    >
                      {v.vector}: -$
                      {v.leakedAmount}
                    </span>
                  ))}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase text-amber-400">
                  Stock Control • Reorder Watch
                </span>
                <Link
                  href="/inventory"
                  className="font-mono text-xs text-amber-300 hover:underline"
                >
                  Restock →
                </Link>
              </div>
              <p className="mt-2 text-3xl font-black text-white">
                {lowStockItems.length}{" "}
                <span className="text-sm font-normal text-slate-400">
                  Low-Stock SKUs
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Items at or below canonical{" "}
                <code>reorderThreshold</code>
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {lowStockItems.length === 0 ? (
                  <span className="text-xs text-emerald-400">
                    All inventory SKUs healthy.
                  </span>
                ) : (
                  lowStockItems.map((i) => (
                    <span
                      key={i.id}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-[10px] text-amber-300"
                    >
                      {i.name}:{" "}
                      {i.currentStock} {i.unit}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-red-500/30 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase text-red-400">
                  Stage-Aware Cancellation Impact
                </span>
                <Link
                  href="/live-orders"
                  className="font-mono text-xs text-red-300 hover:underline"
                >
                  Manage →
                </Link>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400">
                    Food & Labor Loss
                  </p>
                  <p className="text-2xl font-black text-red-400">
                    $
                    {analytics.totalLoss.toFixed(
                      2,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">
                    Aggregator Claims
                  </p>
                  <p className="text-2xl font-black text-amber-300">
                    $
                    {analytics.totalClaims.toFixed(
                      2,
                    )}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {cancellations.length} recorded
                cancellation event(s) in canonical
                ledger.
              </p>
            </div>
          </section>

          {/* Brand, Kitchen & Channel Performance Matrices */}
          <section className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-white">
                  Brand Performance
                </h2>
                <Link
                  href="/brands"
                  className="font-mono text-xs text-sky-400 hover:underline"
                >
                  Matrix →
                </Link>
              </div>
              <div className="space-y-2.5">
                {analytics.brandStats.map(
                  (b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950 px-3.5 py-2.5"
                    >
                      <div>
                        <p className="font-semibold text-white">
                          {b.name}
                        </p>
                        <p className="font-mono text-[10px] text-slate-400">
                          {b.cuisine}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold text-emerald-400">
                          $
                          {b.revenue.toFixed(2)}
                        </p>
                        <p className="font-mono text-[10px] text-slate-400">
                          {b.count} orders
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-white">
                  Kitchen Performance
                </h2>
                <Link
                  href="/kitchens"
                  className="font-mono text-xs text-sky-400 hover:underline"
                >
                  Facilities →
                </Link>
              </div>
              <div className="space-y-2.5">
                {analytics.kitchenStats.map(
                  (k) => (
                    <div
                      key={k.id}
                      className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950 px-3.5 py-2.5"
                    >
                      <div>
                        <p className="font-semibold text-white">
                          {k.id} • {k.name}
                        </p>
                        <p className="font-mono text-[10px] text-slate-400">
                          {k.location}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold text-sky-400">
                          $
                          {k.revenue.toFixed(2)}
                        </p>
                        <p className="font-mono text-[10px] text-slate-400">
                          {k.count} orders
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-white">
                  Channel Performance
                </h2>
                <Link
                  href="/order-injection"
                  className="font-mono text-xs text-sky-400 hover:underline"
                >
                  Webhooks →
                </Link>
              </div>
              {Object.keys(
                analytics.channelMap,
              ).length === 0 ? (
                <p className="rounded-xl bg-slate-950 p-6 text-center text-xs text-slate-500">
                  No channel order data available
                  yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {Object.entries(
                    analytics.channelMap,
                  ).map(([channel, stat]) => (
                    <div
                      key={channel}
                      className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950 px-3.5 py-2.5"
                    >
                      <span className="font-semibold text-slate-200">
                        {channel}
                      </span>
                      <div className="text-right font-mono">
                        <span className="text-sm font-bold text-white">
                          {stat.count}
                        </span>
                        <span className="ml-2 text-xs text-emerald-400">
                          ($
                          {stat.revenue.toFixed(
                            2,
                          )}
                          )
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Bottom Split: Live Operational Activity Stream & Recent Orders */}
          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-white">
                  Live Operational Activity Stream
                </h2>
                <span className="font-mono text-[10px] text-slate-400">
                  Real-time Audit Trail
                </span>
              </div>

              {loading &&
              activities.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Loading operational activity...
                </p>
              ) : activities.length === 0 ? (
                <p className="rounded-xl bg-slate-950 p-6 text-center text-xs text-slate-500">
                  No operational activity available.
                </p>
              ) : (
                <div className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
                  {activities
                    .slice(0, 12)
                    .map((act) => (
                      <div
                        key={act.id}
                        className="rounded-xl border border-slate-800/90 bg-slate-950 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-xs text-white">
                            {act.title}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 shrink-0">
                            {formatTime(
                              act.timestamp,
                            )}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {act.details}
                        </p>
                        <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-slate-500">
                          <span>
                            Actor: {act.actor}
                          </span>
                          {act.kitchenId && (
                            <span>
                              • Kitchen:{" "}
                              {act.kitchenId}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-white">
                  Recent Canonical Orders
                </h2>
                <Link
                  href="/live-orders"
                  className="font-mono text-xs text-sky-400 hover:underline"
                >
                  Open Monitor →
                </Link>
              </div>

              {loading &&
              filteredOrders.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Loading orders...
                </p>
              ) : filteredOrders.length === 0 ? (
                <p className="rounded-xl bg-slate-950 p-6 text-center text-xs text-slate-500">
                  No active orders in current scope.
                </p>
              ) : (
                <div className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
                  {filteredOrders
                    .slice(0, 10)
                    .map((order) => (
                      <div
                        key={order.id}
                        className="rounded-xl border border-slate-800/90 bg-slate-950 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="font-mono text-sm font-bold text-white">
                              {order.id}
                            </span>
                            <span className="ml-2 text-xs text-slate-400">
                              {order.brandId} •{" "}
                              {order.kitchenId} •{" "}
                              {order.channel}
                            </span>
                          </div>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${STATUS_BADGE[order.status]}`}
                          >
                            {order.status.replaceAll(
                              "_",
                              " ",
                            )}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-300">
                          {order.items
                            .map(
                              (i) =>
                                `${i.quantity}× ${i.name}`,
                            )
                            .join(", ")}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-slate-500">
                          <span>
                            Received:{" "}
                            {formatTime(
                              order.receivedAt ||
                                order.createdAt,
                            )}
                          </span>
                          <span>
                            Prep:{" "}
                            {formatDuration(
                              order.prepStartedAt,
                              order.prepCompletedAt,
                            )}
                          </span>
                          <span className="text-emerald-400 font-bold">
                            $
                            {(
                              order.totalAmount ??
                              0
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      <details className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">Demo data tools</summary>
        <p className="mt-2 text-sm text-slate-400">These actions change the shared demo workspace.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void handleStoreAction("RESET_STORE")} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-sky-500/40">
            Reset sample data
          </button>
          <button type="button" onClick={() => void handleStoreAction("CLEAR_ORDERS")} className="rounded-lg border border-amber-500/25 bg-slate-950 px-3 py-2 text-xs font-semibold text-amber-200 hover:border-amber-500/60">
            Clear all orders
          </button>
        </div>
      </details>
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone:
    | "slate"
    | "emerald"
    | "sky"
    | "amber"
    | "teal"
    | "red"
    | "purple";
}) {
  const toneStyles: Record<string, string> = {
    slate:
      "border-slate-800 bg-slate-900/70 text-white",
    emerald:
      "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
    sky: "border-sky-500/30 bg-sky-500/5 text-sky-300",
    amber:
      "border-amber-500/30 bg-amber-500/5 text-amber-300",
    teal: "border-teal-500/30 bg-teal-500/5 text-teal-300",
    red: "border-red-500/30 bg-red-500/5 text-red-300",
    purple:
      "border-purple-500/30 bg-purple-500/5 text-purple-300",
  };

  return (
    <div
      className={`rounded-2xl border p-3.5 ${toneStyles[tone]}`}
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-black">
        {value}
      </p>
      <p className="mt-1 font-mono text-[10px] text-slate-400">
        {sub}
      </p>
    </div>
  );
}
