"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import KitchenSlaBadge from "@/components/KitchenSlaBadge";
import OwnerBottleneckBriefBuilder from "@/components/OwnerBottleneckBriefBuilder";
import RealtimeSyncBadge from "@/components/RealtimeSyncBadge";
import { SplitInspector } from "@/components/SplitInspector";
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
} from "@/lib/db";

interface SystemResponse {
  orders?: Order[];
  inventory?: InventoryItem[];
  cancellations?: CancellationRecord[];
  activities?: OperationalActivity[];
  leakageVectors?: RevenueLeakageVector[];
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

function elapsedMinutes(iso?: string): number {
  if (!iso) return 0;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Math.floor((Date.now() - ts) / 60000));
}

const STATUS_DOT: Record<Order["status"], string> = {
  PENDING: "bg-amber-400",
  PREPARING: "bg-sky-400",
  READY_FOR_PICKUP: "bg-emerald-400",
  DRIVER_ASSIGNED: "bg-violet-400",
  PICKED_UP: "bg-indigo-400",
  DISPATCHED: "bg-teal-400",
  CANCELLED: "bg-rose-400",
};

const STATUS_TEXT: Record<Order["status"], string> = {
  PENDING: "text-amber-300",
  PREPARING: "text-sky-300",
  READY_FOR_PICKUP: "text-emerald-300",
  DRIVER_ASSIGNED: "text-violet-300",
  PICKED_UP: "text-indigo-300",
  DISPATCHED: "text-teal-300",
  CANCELLED: "text-rose-300",
};

function CopilotParamTrigger({ onOpen }: { onOpen: () => void }) {
  const params = useSearchParams();
  const copilot = params.get("copilot");
  useEffect(() => {
    if (copilot === "1") {
      onOpen();
    }
  }, [copilot, onOpen]);
  return null;
}

export default function OwnerPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [cancellations, setCancellations] = useState<CancellationRecord[]>([]);
  const [activities, setActivities] = useState<OperationalActivity[]>([]);
  const [leakageVectors, setLeakageVectors] = useState<RevenueLeakageVector[]>(
    [],
  );
  const [brands, setBrands] = useState<BrandConfig[]>(BRANDS_DB);
  const [kitchens, setKitchens] = useState<KitchenConfig[]>(KITCHENS_DB);
  const [currency, setCurrency] = useState<SupportedCurrency>("INR");
  const [prepSlaMinutes, setPrepSlaMinutes] = useState<number>(12);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [demoSandboxEnabled, setDemoSandboxEnabled] = useState<boolean>(false);

  const [kitchenScope, setKitchenScope] = useState<string>("ALL");
  const [brandScope, setBrandScope] = useState<string>("ALL");
  const [copilotOpen, setCopilotOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const openCopilot = useCallback(() => setCopilotOpen(true), []);

  const fmt = useCallback(
    (amount: number) => formatCurrency(amount, currency),
    [currency],
  );

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/system", { cache: "no-store" });
      const data = (await res.json()) as SystemResponse;

      if (!res.ok) {
        throw new Error(data.error || "Unable to load command center.");
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
        if (
          data.currentEmployee.role !== "OWNER" &&
          data.currentEmployee.kitchenId
        ) {
          setKitchenScope(data.currentEmployee.kitchenId);
        }
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

  useEffect(() => {
    const onHubChanged = (event: Event) => {
      const custom = event as CustomEvent<{ kitchenId?: string }>;
      if (custom.detail?.kitchenId) {
        setKitchenScope(custom.detail.kitchenId);
      }
    };
    const onSettingsUpdated = (event: Event) => {
      const custom = event as CustomEvent<SystemSettings>;
      if (custom.detail?.currency) setCurrency(custom.detail.currency);
      if (typeof custom.detail?.prepSlaMinutes === "number") {
        setPrepSlaMinutes(custom.detail.prepSlaMinutes);
      }
    };
    window.addEventListener("darkit:hub-changed", onHubChanged);
    window.addEventListener("darkit:settings-updated", onSettingsUpdated);
    return () => {
      window.removeEventListener("darkit:hub-changed", onHubChanged);
      window.removeEventListener("darkit:settings-updated", onSettingsUpdated);
    };
  }, []);

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
          ? "Sandbox workspace reset to clean INR seed state."
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

  const slaRiskOrders = useMemo(() => {
    return filteredOrders.filter((o) => {
      if (
        o.status !== "PENDING" &&
        o.status !== "PREPARING" &&
        o.status !== "READY_FOR_PICKUP"
      ) {
        return false;
      }
      const mins = elapsedMinutes(o.prepStartedAt ?? o.receivedAt ?? o.createdAt);
      return mins >= Math.floor(prepSlaMinutes * 0.8);
    });
  }, [filteredOrders, prepSlaMinutes]);

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
    const netCollected = nonCancelled
      .filter(
        (o) =>
          o.paymentStatus === "CAPTURED" ||
          o.paymentStatus === "AGGREGATOR_SETTLED" ||
          !o.paymentStatus,
      )
      .reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
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
      const activeCount = list.filter(
        (o) => o.status !== "DISPATCHED" && o.status !== "CANCELLED",
      ).length;
      return { ...k, count: list.length, activeCount, revenue: rev };
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
      netCollected,
      aov,
      totalLoss,
      totalClaims,
      averagePrepMinutes,
      brandStats,
      kitchenStats,
      channelMap,
    };
  }, [filteredOrders, brands, kitchens]);

  const totalLeakedAmount = useMemo(
    () => leakageVectors.reduce((s, v) => s + v.leakedAmount, 0),
    [leakageVectors],
  );

  const selectedKitchenLabel = useMemo(() => {
    if (kitchenScope === "ALL") {
      return `All Active Kitchens (${kitchens.filter((k) => k.active).length})`;
    }
    const found = kitchens.find((k) => k.id === kitchenScope);
    return found ? `${found.id} — ${found.name}` : kitchenScope;
  }, [kitchenScope, kitchens]);

  return (
    <AppShell
      title="Overview"
      subtitle={selectedKitchenLabel}
      activeHub={kitchenScope}
      onHubChange={setKitchenScope}
      toolbar={
        <select
          aria-label="Filter by brand"
          value={brandScope}
          onChange={(e) => setBrandScope(e.target.value)}
          className="h-7 rounded-md border border-white/[0.08] bg-[#151519] px-2 text-[11px] font-medium text-zinc-200 outline-none focus:border-white/[0.2]"
        >
          <option value="ALL">All Brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      }
      rightActions={
        <>
          <RealtimeSyncBadge
            connectionMode={realtimeSync.connectionMode}
            lastEventAt={realtimeSync.lastEventAt}
            topic={realtimeSync.topic}
          />
          <button
            type="button"
            onClick={() => setCopilotOpen(true)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-indigo-500/40 bg-indigo-500/15 px-2.5 text-[11px] font-medium text-indigo-200 transition-colors hover:bg-indigo-500/25"
          >
            Diagnose Bottleneck
          </button>
          <Link
            href="/live-orders?action=inject"
            className="inline-flex h-7 items-center rounded-md bg-zinc-100 px-2.5 text-[11px] font-semibold text-zinc-950 transition-colors hover:bg-white"
          >
            + Test Order
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <CopilotParamTrigger onOpen={openCopilot} />
      </Suspense>

      <div className="space-y-5">
        {error && (
          <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
            {error}
          </div>
        )}

        {notice && (
          <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200">
            {notice}
          </div>
        )}

        {/* Single Hairline Executive Metric Strip */}
        <section
          aria-label="Executive metrics"
          className="grid grid-cols-2 divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519] sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-5"
        >
          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-zinc-400">Gross Revenue</p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-zinc-100 tabular-nums">
              {fmt(analytics.grossRevenue)}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500 tabular-nums">
              AOV {fmt(analytics.aov)}
            </p>
          </div>

          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-zinc-400">Net Collected</p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-emerald-300 tabular-nums">
              {fmt(analytics.netCollected)}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500 tabular-nums">
              Leakage {fmt(totalLeakedAmount)}
            </p>
          </div>

          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-zinc-400">Active Orders</p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-zinc-100 tabular-nums">
              {analytics.activeOrders}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500 tabular-nums">
              {analytics.pendingOrders} pending · {analytics.preparingOrders} cooking ·{" "}
              {analytics.averagePrepMinutes !== null
                ? `${analytics.averagePrepMinutes.toFixed(1)}m avg`
                : `SLA ${prepSlaMinutes}m`}
            </p>
          </div>

          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-zinc-400">Food &amp; Labor Loss</p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-rose-300 tabular-nums">
              {fmt(analytics.totalLoss)}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500 tabular-nums">
              {analytics.cancelledOrders} cancelled ticket(s)
            </p>
          </div>

          <div className="col-span-2 px-4 py-3 sm:col-span-1">
            <p className="text-[11px] font-medium text-zinc-400">Aggregator Claims</p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-amber-300 tabular-nums">
              {fmt(analytics.totalClaims)}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500 tabular-nums">
              {analytics.completedOrders} dispatched
            </p>
          </div>
        </section>

        {/* Owner "Solve a Pain Point" Quick-Jump Strip */}
        <section
          aria-label="Solve a Pain Point"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] bg-[#151519]/50 px-3.5 py-2.5"
        >
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Solve a Pain Point
          </span>
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Link
              href="/inventory?filter=low_stock"
              className="flex items-center justify-between gap-2 rounded-md border border-white/[0.08] bg-[#151519] px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-amber-500/40 hover:bg-[#1d1d22] hover:text-white"
            >
              <span className="truncate">Stop Mid-Rush Stockouts</span>
              <span className="shrink-0 font-mono text-[10px] text-amber-300 tabular-nums">
                {lowStockItems.length} low →
              </span>
            </Link>

            <Link
              href="/live-orders?status=CANCELLED"
              className="flex items-center justify-between gap-2 rounded-md border border-white/[0.08] bg-[#151519] px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-rose-500/40 hover:bg-[#1d1d22] hover:text-white"
            >
              <span className="truncate">Recover Cancelled Order Losses</span>
              <span className="shrink-0 font-mono text-[10px] text-rose-300 tabular-nums">
                {analytics.cancelledOrders} →
              </span>
            </Link>

            <Link
              href="/analytics"
              className="flex items-center justify-between gap-2 rounded-md border border-white/[0.08] bg-[#151519] px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-emerald-500/40 hover:bg-[#1d1d22] hover:text-white"
            >
              <span className="truncate">Compare Brand &amp; Hub Margins</span>
              <span className="shrink-0 font-mono text-[10px] text-emerald-300">
                Audit →
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              className="flex items-center justify-between gap-2 rounded-md border border-indigo-500/35 bg-indigo-500/10 px-3 py-1.5 text-left text-xs font-medium text-indigo-200 transition-colors hover:border-indigo-400/60 hover:bg-indigo-500/20"
            >
              <span className="truncate">Diagnose My Kitchen&apos;s Bottleneck</span>
              <span className="shrink-0 font-mono text-[10px] text-indigo-300">
                AI →
              </span>
            </button>
          </div>
        </section>

        {/* Compact Stage Pipeline Strip */}
        <section
          aria-label="Order pipeline"
          className="grid grid-cols-2 divide-x divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60 sm:grid-cols-4 lg:grid-cols-7 lg:divide-y-0"
        >
          {(
            [
              { status: "PENDING", label: "Pending", href: "/cook" },
              { status: "PREPARING", label: "Preparing", href: "/cook" },
              { status: "READY_FOR_PICKUP", label: "Ready", href: "/dispatch" },
              { status: "DRIVER_ASSIGNED", label: "Assigned", href: "/dispatch" },
              { status: "PICKED_UP", label: "Picked Up", href: "/dispatch" },
              { status: "DISPATCHED", label: "Dispatched", href: "/live-orders" },
              { status: "CANCELLED", label: "Cancelled", href: "/analytics" },
            ] as const
          ).map((st) => {
            const count = filteredOrders.filter((o) => o.status === st.status).length;
            return (
              <Link
                key={st.status}
                href={st.href}
                className="flex items-center justify-between px-3.5 py-2.5 transition-colors hover:bg-[#1d1d22]"
              >
                <span className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[st.status]}`} />
                  {st.label}
                </span>
                <span className={`font-mono text-sm font-semibold tabular-nums ${STATUS_TEXT[st.status]}`}>
                  {count}
                </span>
              </Link>
            );
          })}
        </section>

        {/* Main 2-Column Operational Split */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
          {/* LEFT: Hub Throughput, Brand Breakdown & Recent Orders */}
          <div className="space-y-5">
            {/* Kitchen Hub Throughput Table */}
            <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                <h2 className="text-xs font-semibold text-zinc-200">
                  Kitchen Hub Throughput
                </h2>
                <Link
                  href="/kitchens"
                  className="text-[11px] font-medium text-zinc-400 transition-colors hover:text-zinc-100"
                >
                  Manage hubs
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-[#09090b]/40 text-[11px] font-medium text-zinc-500">
                      <th className="px-4 py-2">Hub</th>
                      <th className="px-4 py-2">Location</th>
                      <th className="px-4 py-2 text-right">Active</th>
                      <th className="px-4 py-2 text-right">Orders</th>
                      <th className="px-4 py-2 text-right">Gross Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {analytics.kitchenStats.map((k) => (
                      <tr
                        key={k.id}
                        onClick={() => setKitchenScope(k.id)}
                        className={`cursor-pointer transition-colors hover:bg-[#1d1d22]/70 ${
                          kitchenScope === k.id ? "bg-[#1d1d22]" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5 font-medium text-zinc-100">
                          <span className="mr-2 rounded bg-[#1d1d22] px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                            {k.id}
                          </span>
                          {k.name}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-400">{k.location}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-sky-300 tabular-nums">
                          {k.activeCount}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-zinc-300 tabular-nums">
                          {k.count}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium text-emerald-300 tabular-nums">
                          {fmt(k.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Brand & Channel Breakdown Split */}
            <div className="grid gap-5 md:grid-cols-2">
              <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                  <h2 className="text-xs font-semibold text-zinc-200">
                    Brand Breakdown
                  </h2>
                  <Link
                    href="/brands"
                    className="text-[11px] font-medium text-zinc-400 hover:text-zinc-100"
                  >
                    Menus
                  </Link>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {analytics.brandStats.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between px-4 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-100">
                          {b.name}
                        </p>
                        <p className="truncate text-[11px] text-zinc-500">
                          {b.cuisine}
                        </p>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <p className="font-medium text-emerald-300">
                          {fmt(b.revenue)}
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          {b.count} ord
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                  <h2 className="text-xs font-semibold text-zinc-200">
                    Channel Mix
                  </h2>
                  <Link
                    href="/analytics"
                    className="text-[11px] font-medium text-zinc-400 hover:text-zinc-100"
                  >
                    Audit
                  </Link>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {Object.keys(analytics.channelMap).length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-zinc-500">
                      No orders in scope.
                    </p>
                  ) : (
                    Object.entries(analytics.channelMap).map(([channel, stat]) => (
                      <div
                        key={channel}
                        className="flex items-center justify-between px-4 py-2.5 text-xs"
                      >
                        <span className="font-medium text-zinc-200">{channel}</span>
                        <span className="font-mono tabular-nums">
                          <span className="text-zinc-400">{stat.count} · </span>
                          <span className="font-medium text-zinc-100">
                            {fmt(stat.revenue)}
                          </span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            {/* Recent Orders Table */}
            <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                <h2 className="text-xs font-semibold text-zinc-200">
                  Recent Orders
                </h2>
                <Link
                  href="/live-orders"
                  className="text-[11px] font-medium text-zinc-400 hover:text-zinc-100"
                >
                  Open inbox
                </Link>
              </div>
              {loading && filteredOrders.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-zinc-500">
                  Loading orders...
                </p>
              ) : filteredOrders.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-zinc-500">
                  No orders in current filter scope.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-[#09090b]/40 text-[11px] font-medium text-zinc-500">
                        <th className="px-4 py-2">Order</th>
                        <th className="px-4 py-2">Hub / Channel</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2 text-right">Prep</th>
                        <th className="px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {filteredOrders.slice(0, 8).map((order) => (
                        <tr
                          key={order.id}
                          className="transition-colors hover:bg-[#1d1d22]/60"
                        >
                          <td className="px-4 py-2">
                            <Link
                              href={`/live-orders?order=${encodeURIComponent(order.id)}`}
                              className="font-mono font-medium text-zinc-100 hover:underline tabular-nums"
                            >
                              {order.id}
                            </Link>
                            <p className="truncate text-[11px] text-zinc-500">
                              {order.items
                                .map((i) => `${i.quantity}x ${i.name}`)
                                .join(", ")}
                            </p>
                          </td>
                          <td className="px-4 py-2 font-mono text-[11px] text-zinc-400">
                            {order.kitchenId} · {order.channel}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase ${STATUS_TEXT[order.status]}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[order.status]}`}
                              />
                              {order.status.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-[11px] text-zinc-400 tabular-nums">
                            {formatDuration(
                              order.prepStartedAt,
                              order.prepCompletedAt,
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-medium text-zinc-100 tabular-nums">
                            {fmt(order.totalAmount ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT: Actionable Exceptions (Low Stock + SLA Breaches + Recent Cancellations + Audit) */}
          <div className="space-y-5">
            {/* Low-Stock Watch */}
            <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold text-zinc-200">
                    Low-Stock SKUs
                  </h2>
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-300 tabular-nums">
                    {lowStockItems.length}
                  </span>
                </div>
                <Link
                  href="/inventory"
                  className="text-[11px] font-medium text-zinc-400 hover:text-zinc-100"
                >
                  Restock
                </Link>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {lowStockItems.length === 0 ? (
                  <p className="px-4 py-5 text-xs text-emerald-300">
                    All inventory SKUs are above reorder thresholds.
                  </p>
                ) : (
                  lowStockItems.slice(0, 6).map((item) => (
                    <div
                      key={`${item.kitchenId ?? "K1"}-${item.id}`}
                      className="flex items-center justify-between px-4 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-100">
                          {item.name}
                        </p>
                        <p className="font-mono text-[10px] text-zinc-500">
                          {item.kitchenId ?? "K1"} · {item.sku}
                        </p>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <span
                          className={
                            item.currentStock <= 0
                              ? "font-semibold text-rose-400"
                              : "font-semibold text-amber-300"
                          }
                        >
                          {item.currentStock} {item.unit}
                        </span>
                        <p className="text-[10px] text-zinc-500">
                          min {item.reorderThreshold}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Active SLA Breaches */}
            <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold text-zinc-200">
                    SLA Watch &amp; Breaches
                  </h2>
                  <span className="rounded bg-rose-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-rose-300 tabular-nums">
                    {slaRiskOrders.length}
                  </span>
                </div>
                <Link
                  href="/cook"
                  className="text-[11px] font-medium text-zinc-400 hover:text-zinc-100"
                >
                  Open KDS
                </Link>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {slaRiskOrders.length === 0 ? (
                  <p className="px-4 py-5 text-xs text-zinc-500">
                    No active orders breaching the {prepSlaMinutes}m prep SLA.
                  </p>
                ) : (
                  slaRiskOrders.slice(0, 5).map((o) => (
                    <Link
                      key={o.id}
                      href={`/live-orders?order=${encodeURIComponent(o.id)}`}
                      className="flex items-center justify-between px-4 py-2.5 text-xs transition-colors hover:bg-[#1d1d22]/60"
                    >
                      <div>
                        <p className="font-mono font-medium text-zinc-100 tabular-nums">
                          {o.id}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {o.kitchenId} · {o.brandId} · {o.status.replaceAll("_", " ")}
                        </p>
                      </div>
                      <KitchenSlaBadge
                        orderId={o.id}
                        anchorIso={o.prepStartedAt ?? o.receivedAt ?? o.createdAt}
                        slaMinutes={prepSlaMinutes}
                      />
                    </Link>
                  ))
                )}
              </div>
            </section>

            {/* Recent Cancellations */}
            <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold text-zinc-200">
                    Recent Cancellations
                  </h2>
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 tabular-nums">
                    {filteredCancellations.length}
                  </span>
                </div>
                <Link
                  href="/analytics"
                  className="text-[11px] font-medium text-zinc-400 hover:text-zinc-100"
                >
                  Ledger
                </Link>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {filteredCancellations.length === 0 ? (
                  <p className="px-4 py-5 text-xs text-zinc-500">
                    No cancellations recorded in current scope.
                  </p>
                ) : (
                  filteredCancellations.slice(0, 5).map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-mono font-medium text-zinc-100 tabular-nums">
                          {rec.orderId}{" "}
                          <span className="text-[10px] text-zinc-500">
                            {rec.kitchenId} · {rec.stage}
                          </span>
                        </p>
                        <p className="truncate text-[11px] text-zinc-400">
                          {rec.reason}
                        </p>
                      </div>
                      <div className="shrink-0 text-right font-mono text-[11px] tabular-nums">
                        <p className="text-rose-300">-{fmt(rec.financialLoss)}</p>
                        {rec.claimAmount > 0 && (
                          <p className="text-[10px] text-amber-300">
                            Claim {fmt(rec.claimAmount)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Activity Audit Feed */}
            <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                <h2 className="text-xs font-semibold text-zinc-200">
                  Operational Audit Feed
                </h2>
                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="text-[11px] font-medium text-zinc-400 hover:text-zinc-100"
                >
                  Refresh
                </button>
              </div>
              <div className="max-h-72 divide-y divide-white/[0.06] overflow-y-auto">
                {filteredActivities.length === 0 ? (
                  <p className="px-4 py-5 text-xs text-zinc-500">
                    No activity events yet.
                  </p>
                ) : (
                  filteredActivities.slice(0, 10).map((act) => (
                    <div key={act.id} className="px-4 py-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-zinc-200">
                          {act.title}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-zinc-500 tabular-nums">
                          {formatTime(act.timestamp)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-400">
                        {act.details}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Minimal Sandbox Reset Controls (Demo Owner only) */}
        {demoSandboxEnabled && currentEmployee?.role === "OWNER" && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-xs text-zinc-500">
            <span>Demo sandbox controls</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleStoreAction("RESET_STORE")}
                className="h-7 rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-white/[0.16] hover:text-zinc-100"
              >
                Reset Sample INR Data
              </button>
              <button
                type="button"
                onClick={() => void handleStoreAction("CLEAR_ORDERS")}
                className="h-7 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 text-[11px] font-medium text-amber-200 transition-colors hover:bg-amber-500/20"
              >
                Clear Active Orders
              </button>
            </div>
          </div>
        )}
      </div>

      {/* On-Demand Gemini Operational Copilot Slide-Over */}
      <SplitInspector
        open={copilotOpen}
        mode="overlay"
        widthClassName="max-w-[680px]"
        title="Gemini Operational Copilot"
        subtitle={`Live telemetry diagnosis · ${selectedKitchenLabel}`}
        onClose={() => setCopilotOpen(false)}
      >
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
      </SplitInspector>
    </AppShell>
  );
}
