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
import OwnerBottleneckBriefBuilder from "@/components/OwnerBottleneckBriefBuilder";
import RealtimeSyncBadge from "@/components/RealtimeSyncBadge";
import WorkspaceQuickStart from "@/components/WorkspaceQuickStart";
import { useRealtimeKitchenSync } from "@/hooks/useRealtimeKitchenSync";
import { formatCurrency, type SupportedCurrency } from "@/lib/currency";
import {
  BRANDS_DB,
  KITCHENS_DB,
  type BrandConfig,
  type CancellationRecord,
  type Employee,
  type InventoryItem,
  type KitchenConfig,
  type OperationalActivity,
  type Order,
  type RevenueLeakageVector,
  type SystemSettings,
  type VirtualFileAsset,
} from "@/lib/db";

interface SystemResponse {
  orders?: Order[];
  inventory?: InventoryItem[];
  cancellations?: CancellationRecord[];
  activities?: OperationalActivity[];
  leakageVectors?: RevenueLeakageVector[];
  files?: VirtualFileAsset[];
  brands?: BrandConfig[];
  kitchens?: KitchenConfig[];
  settings?: SystemSettings;
  currentEmployee?: Employee;
  demoSandboxEnabled?: boolean;
  error?: string;
}

function formatTime(value?: string): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return "--";
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return "--";
  return `${((e - s) / 60000).toFixed(1)}m`;
}

const STATUS_BADGE: Record<Order["status"], string> = {
  PENDING: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  PREPARING: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  READY_FOR_PICKUP: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  DRIVER_ASSIGNED: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  PICKED_UP: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
  DISPATCHED: "border-teal-500/40 bg-teal-500/10 text-teal-300",
  CANCELLED: "border-red-500/40 bg-red-500/10 text-red-300",
};

export default function OwnerPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [cancellations, setCancellations] = useState<CancellationRecord[]>([]);
  const [activities, setActivities] = useState<OperationalActivity[]>([]);
  const [leakageVectors, setLeakageVectors] = useState<RevenueLeakageVector[]>(
    [],
  );
  const [files, setFiles] = useState<VirtualFileAsset[]>([]);
  const [brands, setBrands] = useState<BrandConfig[]>(BRANDS_DB);
  const [kitchens, setKitchens] = useState<KitchenConfig[]>(KITCHENS_DB);
  const [currency, setCurrency] = useState<SupportedCurrency>("INR");
  const [prepSlaMinutes, setPrepSlaMinutes] = useState<number>(12);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [demoSandboxEnabled, setDemoSandboxEnabled] = useState<boolean>(false);

  const [kitchenScope, setKitchenScope] = useState<string>("ALL");
  const [brandScope, setBrandScope] = useState<string>("ALL");
  const [showDesktopOs, setShowDesktopOs] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fmt = useCallback(
    (amount: number) => formatCurrency(amount, currency),
    [currency],
  );

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/system", { cache: "no-store" });
      const data = (await res.json()) as SystemResponse;

      if (!res.ok) {
        throw new Error(data.error || "Unable to load kitchen overview.");
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setInventory(Array.isArray(data.inventory) ? data.inventory : []);
      setCancellations(
        Array.isArray(data.cancellations) ? data.cancellations : [],
      );
      setActivities(Array.isArray(data.activities) ? data.activities : []);
      setLeakageVectors(
        Array.isArray(data.leakageVectors) ? data.leakageVectors : [],
      );
      setFiles(Array.isArray(data.files) ? data.files : []);
      if (Array.isArray(data.brands) && data.brands.length > 0) {
        setBrands(data.brands);
      }
      if (Array.isArray(data.kitchens) && data.kitchens.length > 0) {
        setKitchens(data.kitchens);
      }
      if (data.settings?.currency) {
        setCurrency(data.settings.currency);
      }
      if (typeof data.settings?.prepSlaMinutes === "number") {
        setPrepSlaMinutes(data.settings.prepSlaMinutes);
      }
      if (data.currentEmployee) {
        setCurrentEmployee(data.currentEmployee);
      }
      setDemoSandboxEnabled(Boolean(data.demoSandboxEnabled));
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
  }, [loadData]);

  const realtimeSync = useRealtimeKitchenSync({
    organizationId: currentEmployee?.organizationId,
    kitchenId:
      currentEmployee?.role !== "OWNER" && currentEmployee?.kitchenId
        ? currentEmployee.kitchenId
        : kitchenScope !== "ALL"
          ? kitchenScope
          : null,
    onSync: loadData,
  });

  useEffect(() => {
    const onSettingsUpdated = (event: Event) => {
      const custom = event as CustomEvent<SystemSettings>;
      if (custom.detail?.currency) setCurrency(custom.detail.currency);
      if (typeof custom.detail?.prepSlaMinutes === "number") {
        setPrepSlaMinutes(custom.detail.prepSlaMinutes);
      }
    };
    window.addEventListener("darkit:settings-updated", onSettingsUpdated);
    return () =>
      window.removeEventListener("darkit:settings-updated", onSettingsUpdated);
  }, []);

  async function handleQuickTransition(
    orderId: string,
    status: Order["status"],
  ) {
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action: status }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Order update failed");
      }
      setError("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function handleStoreAction(action: "RESET_STORE" | "CLEAR_ORDERS") {
    try {
      setError("");
      setNotice("");
      const res = await fetch("/api/system", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Unable to execute ${action}`);
      }
      setNotice(
        action === "RESET_STORE"
          ? "Demo workspace reset to clean INR sample state."
          : "Active order queue cleared.",
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sandbox action failed");
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const kMatch =
        kitchenScope === "ALL" || order.kitchenId === kitchenScope;
      const bMatch = brandScope === "ALL" || order.brandId === brandScope;
      return kMatch && bMatch;
    });
  }, [orders, kitchenScope, brandScope]);

  const filteredCancellations = useMemo(() => {
    return cancellations.filter((rec) => {
      const kMatch = kitchenScope === "ALL" || rec.kitchenId === kitchenScope;
      const bMatch = brandScope === "ALL" || rec.brandId === brandScope;
      return kMatch && bMatch;
    });
  }, [cancellations, kitchenScope, brandScope]);

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      const kMatch =
        kitchenScope === "ALL" ||
        !act.kitchenId ||
        act.kitchenId === kitchenScope;
      const bMatch =
        brandScope === "ALL" || !act.brandId || act.brandId === brandScope;
      return kMatch && bMatch;
    });
  }, [activities, kitchenScope, brandScope]);

  const lowStockItems = useMemo(
    () =>
      inventory.filter((item) => {
        const isLow = item.currentStock <= item.reorderThreshold;
        const kMatch =
          kitchenScope === "ALL" ||
          !item.kitchenId ||
          item.kitchenId === kitchenScope;
        return isLow && kMatch;
      }),
    [inventory, kitchenScope],
  );

  const analytics = useMemo(() => {
    const activeOrders = filteredOrders.filter(
      (o) =>
        o.status === "PENDING" ||
        o.status === "PREPARING" ||
        o.status === "READY_FOR_PICKUP" ||
        o.status === "DRIVER_ASSIGNED" ||
        o.status === "PICKED_UP",
    );
    const pendingOrders = filteredOrders.filter((o) => o.status === "PENDING");
    const preparingOrders = filteredOrders.filter(
      (o) => o.status === "PREPARING",
    );
    const readyOrders = filteredOrders.filter(
      (o) => o.status === "READY_FOR_PICKUP",
    );
    const completedOrders = filteredOrders.filter(
      (o) => o.status === "DISPATCHED",
    );
    const cancelledOrders = filteredOrders.filter(
      (o) => o.status === "CANCELLED",
    );

    const nonCancelled = filteredOrders.filter((o) => o.status !== "CANCELLED");
    const grossRevenue = nonCancelled.reduce(
      (sum, o) => sum + (o.totalAmount ?? 0),
      0,
    );
    const aov =
      nonCancelled.length > 0 ? grossRevenue / nonCancelled.length : 0;

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
          ? (new Date(o.prepCompletedAt).getTime() -
              new Date(o.prepStartedAt).getTime()) /
            60000
          : null,
      )
      .filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0);

    const averagePrepMinutes =
      prepDurations.length > 0
        ? prepDurations.reduce((a, b) => a + b, 0) / prepDurations.length
        : null;

    const brandStats = brands.map((b) => {
      const list = filteredOrders.filter((o) => o.brandId === b.id);
      const rev = list
        .filter((o) => o.status !== "CANCELLED")
        .reduce((s, o) => s + (o.totalAmount ?? 0), 0);
      return { ...b, count: list.length, revenue: rev };
    });

    const kitchenStats = kitchens.map((k) => {
      const list = filteredOrders.filter((o) => o.kitchenId === k.id);
      const rev = list
        .filter((o) => o.status !== "CANCELLED")
        .reduce((s, o) => s + (o.totalAmount ?? 0), 0);
      return { ...k, count: list.length, revenue: rev };
    });

    const channelMap: Record<string, { count: number; revenue: number }> = {};
    for (const o of filteredOrders) {
      if (!channelMap[o.channel]) {
        channelMap[o.channel] = { count: 0, revenue: 0 };
      }
      channelMap[o.channel].count += 1;
      if (o.status !== "CANCELLED") {
        channelMap[o.channel].revenue += o.totalAmount ?? 0;
      }
    }

    return {
      totalOrders: filteredOrders.length,
      activeOrders: activeOrders.length,
      pendingOrders: pendingOrders.length,
      preparingOrders: preparingOrders.length,
      readyOrders: readyOrders.length,
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
  }, [filteredOrders, brands, kitchens]);

  const totalPotentialRev = useMemo(
    () => leakageVectors.reduce((s, v) => s + v.potentialRevenue, 0),
    [leakageVectors],
  );
  const totalCollectedRev = useMemo(
    () => leakageVectors.reduce((s, v) => s + v.actualCollected, 0),
    [leakageVectors],
  );
  const totalLeakedAmount = useMemo(
    () => leakageVectors.reduce((s, v) => s + v.leakedAmount, 0),
    [leakageVectors],
  );
  const leakagePct =
    totalPotentialRev > 0
      ? ((totalPotentialRev - totalCollectedRev) / totalPotentialRev) * 100
      : 0;

  const selectedKitchenLabel = useMemo(() => {
    if (kitchenScope === "ALL") {
      return `All Active Kitchens (${kitchens.filter((k) => k.active).length})`;
    }
    const found = kitchens.find((k) => k.id === kitchenScope);
    return found ? `${found.id} — ${found.name}` : kitchenScope;
  }, [kitchenScope, kitchens]);

  return (
    <AppShell
      title="Owner Showcase"
      subtitle="Live INR sales, order throughput, low-stock risks, and a 1-click Bottleneck Brief builder for your cloud kitchens."
      actions={
        <>
          <RealtimeSyncBadge
            connectionMode={realtimeSync.connectionMode}
            lastEventAt={realtimeSync.lastEventAt}
            topic={realtimeSync.topic}
          />
          <a
            href="#owner-bottleneck-brief"
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/25"
          >
            Export Dev Brief (.md)
          </a>

          <Link
            href="/order-injection"
            className="rounded-xl bg-sky-500 px-3.5 py-2 text-xs font-bold text-slate-950 transition hover:bg-sky-400"
          >
            + Add Sample Order
          </Link>

          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-700"
          >
            ↻ Refresh
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-200">
          ⚠ {error}
        </div>
      )}

      {notice && (
        <div className="mb-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-200">
          ✓ {notice}
        </div>
      )}

      {showDesktopOs ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
            <p className="text-xs text-slate-300">
              Viewing optional multi-window Desktop Workbench mode.
            </p>
            <button
              type="button"
              onClick={() => setShowDesktopOs(false)}
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400"
            >
              Return to Owner Showcase
            </button>
          </div>
          <DesktopWindowManager
            orders={filteredOrders}
            inventory={inventory}
            files={files}
            onQuickTransition={handleQuickTransition}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <WorkspaceQuickStart />

          {/* Scope Filters */}
          <section
            aria-label="Overview filters"
            className="grid gap-4 rounded-2xl border border-slate-800/90 bg-slate-900/60 p-4 sm:grid-cols-2"
          >
            <label className="block">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Kitchen location
              </span>
              <select
                value={kitchenScope}
                onChange={(e) => setKitchenScope(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400"
              >
                <option value="ALL">All kitchens</option>
                {kitchens.map((k) => (
                  <option key={k.id} value={k.id}>
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
                onChange={(e) => setBrandScope(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400"
              >
                <option value="ALL">All brands</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </label>
          </section>

          {/* 6 Business-First INR KPI Cards */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              label="Gross Sales"
              value={fmt(analytics.grossRevenue)}
              sub={`Avg ${fmt(analytics.aov)} / order`}
              tone="emerald"
            />
            <KpiCard
              label="Active Queue"
              value={String(analytics.activeOrders)}
              sub={`${analytics.pendingOrders} Pending · ${analytics.preparingOrders} Cooking`}
              tone="sky"
            />
            <KpiCard
              label="Dispatched"
              value={String(analytics.completedOrders)}
              sub={`${analytics.readyOrders} ready at pass`}
              tone="teal"
            />
            <KpiCard
              label="Avg Prep Time"
              value={
                analytics.averagePrepMinutes !== null
                  ? `${analytics.averagePrepMinutes.toFixed(1)}m`
                  : "--"
              }
              sub={`Target SLA ≤ ${prepSlaMinutes}m`}
              tone="purple"
            />
            <KpiCard
              label="Cancellation Loss"
              value={fmt(analytics.totalLoss)}
              sub={`${analytics.cancelledOrders} cancelled · ${fmt(analytics.totalClaims)} claims`}
              tone="red"
            />
            <KpiCard
              label="Low-Stock Alerts"
              value={String(lowStockItems.length)}
              sub={
                lowStockItems.length === 0
                  ? "All SKUs healthy"
                  : "Needs reorder check"
              }
              tone="amber"
            />
          </section>

          {/* Order Flow by Status */}
          <section className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Live Order Pipeline
                </h2>
                <p className="text-xs text-slate-400">
                  Click any stage to jump directly into the station board.
                </p>
              </div>
              <Link
                href="/live-orders"
                className="font-mono text-xs font-bold text-sky-400 hover:underline"
              >
                Open Live Orders →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
              {(
                [
                  { status: "PENDING", label: "Pending", href: "/kds" },
                  { status: "PREPARING", label: "Preparing", href: "/kds" },
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
                  { status: "PICKED_UP", label: "Picked Up", href: "/dispatch" },
                  {
                    status: "DISPATCHED",
                    label: "Dispatched",
                    href: "/live-orders",
                  },
                  { status: "CANCELLED", label: "Cancelled", href: "/analytics" },
                ] as const
              ).map((st) => {
                const count = filteredOrders.filter(
                  (o) => o.status === st.status,
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
                    <p className="mt-1 text-2xl font-black">{count}</p>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* 3 Business Health Highlights: Revenue Leakage, Stock Watch, Cancellations */}
          <section className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-2xl border border-purple-500/30 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase text-purple-400">
                  Margin &amp; Payout Leakage
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
                  ({fmt(totalLeakedAmount)})
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Collected {fmt(totalCollectedRev)} of {fmt(totalPotentialRev)}{" "}
                potential across Swiggy, Zomato &amp; Direct orders.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {leakageVectors.slice(0, 3).map((v) => (
                  <span
                    key={v.id}
                    className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-[10px] text-slate-300"
                  >
                    {v.vector}: -{fmt(v.leakedAmount)}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase text-amber-400">
                  Inventory Reorder Watch
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
                Ingredients at or below reorder threshold in selected scope.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {lowStockItems.length === 0 ? (
                  <span className="text-xs text-emerald-400">
                    All inventory SKUs are healthy.
                  </span>
                ) : (
                  lowStockItems.map((i) => (
                    <span
                      key={`${i.kitchenId ?? "K1"}-${i.id}`}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-[10px] text-amber-300"
                    >
                      {i.kitchenId ? `[${i.kitchenId}] ` : ""}
                      {i.name}: {i.currentStock} {i.unit}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-red-500/30 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase text-red-400">
                  Cancellation Impact Ledger
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
                  <p className="text-xs text-slate-400">Food &amp; Labor Loss</p>
                  <p className="text-2xl font-black text-red-400">
                    {fmt(analytics.totalLoss)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Aggregator Claims</p>
                  <p className="text-2xl font-black text-amber-300">
                    {fmt(analytics.totalClaims)}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {filteredCancellations.length} cancellation event(s) in current
                filter scope.
              </p>
            </div>
          </section>

          {/* Brand, Kitchen & Channel Performance */}
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
                  Brands &amp; Menus →
                </Link>
              </div>
              <div className="space-y-2.5">
                {analytics.brandStats.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950 px-3.5 py-2.5"
                  >
                    <div>
                      <p className="font-semibold text-white">{b.name}</p>
                      <p className="font-mono text-[10px] text-slate-400">
                        {b.cuisine}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold text-emerald-400">
                        {fmt(b.revenue)}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400">
                        {b.count} order(s)
                      </p>
                    </div>
                  </div>
                ))}
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
                {analytics.kitchenStats.map((k) => (
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
                        {fmt(k.revenue)}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400">
                        {k.count} order(s)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-white">
                  Channel Breakdown
                </h2>
                <Link
                  href="/order-injection"
                  className="font-mono text-xs text-sky-400 hover:underline"
                >
                  Test Order →
                </Link>
              </div>
              {Object.keys(analytics.channelMap).length === 0 ? (
                <p className="rounded-xl bg-slate-950 p-6 text-center text-xs text-slate-500">
                  No channel order data available yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {Object.entries(analytics.channelMap).map(
                    ([channel, stat]) => (
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
                            ({fmt(stat.revenue)})
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Interactive Owner Bottleneck -> Downloadable .md Brief Builder */}
          <OwnerBottleneckBriefBuilder
            ownerName={currentEmployee?.name || "Cloud Kitchen Owner"}
            kitchenScope={selectedKitchenLabel}
            telemetry={{
              grossRevenue: analytics.grossRevenue,
              aov: analytics.aov,
              activeOrdersCount: analytics.activeOrders,
              completedOrdersCount: analytics.completedOrders,
              cancelledOrdersCount: analytics.cancelledOrders,
              totalLoss: analytics.totalLoss,
              totalClaims: analytics.totalClaims,
              totalLeakage: totalLeakedAmount,
              lowStockItems: lowStockItems.map(
                (i) => `${i.name} (${i.currentStock} ${i.unit})`,
              ),
              activeBrandsCount: brands.filter((b) => b.active).length,
              onlineKitchensCount: kitchens.filter((k) => k.active).length,
              currency,
            }}
            onSavedToExplorer={() => void loadData()}
          />

          {/* Recent Orders & Live Operational Activity */}
          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-white">
                  Recent Orders
                </h2>
                <Link
                  href="/live-orders"
                  className="font-mono text-xs text-sky-400 hover:underline"
                >
                  Open Monitor →
                </Link>
              </div>

              {loading && filteredOrders.length === 0 ? (
                <p className="text-xs text-slate-400">Loading orders...</p>
              ) : filteredOrders.length === 0 ? (
                <p className="rounded-xl bg-slate-950 p-6 text-center text-xs text-slate-500">
                  No orders in current filter scope.
                </p>
              ) : (
                <div className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
                  {filteredOrders.slice(0, 10).map((order) => (
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
                            {order.brandId} • {order.kitchenId} •{" "}
                            {order.channel}
                          </span>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${STATUS_BADGE[order.status]}`}
                        >
                          {order.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-300">
                        {order.items
                          .map((i) => `${i.quantity}× ${i.name}`)
                          .join(", ")}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-slate-500">
                        <span>
                          Received:{" "}
                          {formatTime(order.receivedAt || order.createdAt)}
                        </span>
                        <span>
                          Prep:{" "}
                          {formatDuration(
                            order.prepStartedAt,
                            order.prepCompletedAt,
                          )}
                        </span>
                        <span className="text-emerald-400 font-bold">
                          {fmt(order.totalAmount ?? 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-white">
                  Live Kitchen Activity Stream
                </h2>
                <span className="font-mono text-[10px] text-slate-400">
                  Audit Log
                </span>
              </div>

              {loading && filteredActivities.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Loading operational activity...
                </p>
              ) : filteredActivities.length === 0 ? (
                <p className="rounded-xl bg-slate-950 p-6 text-center text-xs text-slate-500">
                  No activity in current filter scope.
                </p>
              ) : (
                <div className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
                  {filteredActivities.slice(0, 12).map((act) => (
                    <div
                      key={act.id}
                      className="rounded-xl border border-slate-800/90 bg-slate-950 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-xs text-white">
                          {act.title}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 shrink-0">
                          {formatTime(act.timestamp)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {act.details}
                      </p>
                      <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-slate-500">
                        <span>Actor: {act.actor}</span>
                        {act.kitchenId && (
                          <span>• Kitchen: {act.kitchenId}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Collapsed-by-default Developer & Sandbox Drawer */}
      <details className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200">
          Developer &amp; Sandbox Tools (Hidden from daily kitchen flow)
        </summary>
        <p className="mt-2 text-xs text-slate-400">
          Optional multi-window workbench and demo reset actions. Destructive
          sandbox resets are strictly disabled when Demo Sandbox Mode is off.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowDesktopOs((v) => !v)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-500/40"
          >
            {showDesktopOs
              ? "Switch back to Owner Showcase"
              : "Open Desktop Workbench View"}
          </button>

          {demoSandboxEnabled && currentEmployee?.role === "OWNER" && (
            <>
              <button
                type="button"
                onClick={() => void handleStoreAction("RESET_STORE")}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-sky-500/40"
              >
                Reset Sample INR Data
              </button>
              <button
                type="button"
                onClick={() => void handleStoreAction("CLEAR_ORDERS")}
                className="rounded-lg border border-amber-500/25 bg-slate-950 px-3 py-2 text-xs font-semibold text-amber-200 hover:border-amber-500/60"
              >
                Clear Active Orders
              </button>
            </>
          )}
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
  tone: "slate" | "emerald" | "sky" | "amber" | "teal" | "red" | "purple";
}) {
  const toneStyles: Record<string, string> = {
    slate: "border-slate-800 bg-slate-900/70 text-white",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
    sky: "border-sky-500/30 bg-sky-500/5 text-sky-300",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-300",
    teal: "border-teal-500/30 bg-teal-500/5 text-teal-300",
    red: "border-red-500/30 bg-red-500/5 text-red-300",
    purple: "border-purple-500/30 bg-purple-500/5 text-purple-300",
  };

  return (
    <div className={`rounded-2xl border p-3.5 ${toneStyles[tone]}`}>
      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-black">{value}</p>
      <p className="mt-1 font-mono text-[10px] text-slate-400">{sub}</p>
    </div>
  );
}
