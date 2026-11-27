"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { formatCurrency, type SupportedCurrency } from "@/lib/currency";
import type {
  CancellationRecord,
  InventoryItem,
  Order,
  RevenueLeakageVector,
  SystemSettings,
} from "@/lib/db";

const PERFORMANCE_HOTSPOTS = [
  {
    title: "Dual-mode PostgreSQL persistence & per-kitchen stock isolation",
    severity: "Implemented · Sprint 1",
    detail:
      "Drizzle ORM 24-table PostgreSQL schema, Supavisor pooling (prepare: false), composite (kitchen_id, ingredient_id) ledgers, sorted FOR UPDATE locks, and atomic transfers.",
    fix: "Configure DATABASE_URL (Supavisor 6543) & DIRECT_URL (5432) and run npm run db:migrate && npm run db:seed.",
  },
  {
    title: "Sub-second KDS & ops Realtime push with polling fallback",
    severity: "Implemented · Sprint 2",
    detail:
      "KDS, Dispatch, Live Orders, Inventory, and Command Center subscribe to org:kitchen Supabase Realtime Broadcast topics with 3.5s HTTP fallback.",
    fix: "Enable Supabase Realtime replication for orders, kitchen_inventory, and activities.",
  },
  {
    title: "Cursor pagination for high-volume historical archives",
    severity: "Planned · Scale+",
    detail:
      "Indexed queries (kitchen_id, status) and (brand_id, created_at) are live; add cursor pagination above 10k historical orders.",
    fix: "Extend GET /api/orders with cursor pagination and monthly partitions.",
  },
];

const PRODUCTION_MILESTONES = [
  {
    id: "SPRINT-1",
    name: "Persistence & Stock Ledger",
    domain: "Supabase + Drizzle ORM",
    status: "COMPLETE",
    task: "Durable Postgres schema, per-kitchen stock isolation, inter-kitchen transfers, SELECT FOR UPDATE depletion, PG16 CI.",
  },
  {
    id: "SPRINT-2",
    name: "Auth, RBAC & Realtime",
    domain: "Supabase Auth + RLS",
    status: "COMPLETE",
    task: "Multi-tenant organizations, PostgreSQL RLS, Email/OTP auth, two-level RBAC with revocation, Realtime KDS sync.",
  },
  {
    id: "SPRINT-3A",
    name: "India GST & Razorpay",
    domain: "Compliance & Direct UPI",
    status: "COMPLETE",
    task: "5% GST invoices (CGST/SGST/IGST), GSTIN/FSSAI stamps, FY sequencing, Tally/Zoho CSVs, Razorpay webhooks & auto-refunds.",
  },
  {
    id: "SPRINT-3B",
    name: "Aggregators & WhatsApp",
    domain: "UrbanPiper + QStash + Interakt",
    status: "COMPLETE",
    task: "Signed Swiggy/Zomato webhooks, transactional outbox retries, SKU mapping console, WhatsApp stock alerts & IST Daily INR Digests.",
  },
  {
    id: "SPRINT-4",
    name: "Hardware Bridges & AI Copilot",
    domain: "80mm ESC/POS + Scale + Gemini",
    status: "COMPLETE",
    task: "80mm thermal KOT print bridge, Web Audio SLA chimes, USB HID barcode/scale station, live telemetry Gemini /api/ai/diagnose.",
  },
  {
    id: "SPRINT-5",
    name: "Native Operational UI",
    domain: "Linear / Square KDS System",
    status: "COMPLETE",
    task: "52px icon rail, 44px unified top bar, ⌘K Command Palette, SplitInspector drawers, tonal hairline surfaces, tabular-nums.",
  },
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<
    "BI_YIELD" | "LEAKAGE" | "ROADMAP_PERF"
  >("BI_YIELD");

  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [cancellations, setCancellations] = useState<CancellationRecord[]>([]);
  const [leakageVectors, setLeakageVectors] = useState<RevenueLeakageVector[]>(
    [],
  );
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [asPurchasedWeight, setAsPurchasedWeight] = useState<number>(20);
  const [usableEdibleWeight, setUsableEdibleWeight] = useState<number>(16.8);

  const currency: SupportedCurrency = settings?.currency ?? "INR";
  const fmt = useCallback(
    (amount: number) => formatCurrency(amount, currency),
    [currency],
  );

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/system", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to load analytics.");
        return;
      }
      if (Array.isArray(data.orders)) setOrders(data.orders);
      if (Array.isArray(data.inventory)) setInventory(data.inventory);
      if (Array.isArray(data.cancellations))
        setCancellations(data.cancellations);
      if (Array.isArray(data.leakageVectors))
        setLeakageVectors(data.leakageVectors);
      if (data.settings) setSettings(data.settings);
      setError("");
    } catch {
      setError("Network error while loading analytics.");
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const onSettingsUpdated = (event: Event) => {
      const custom = event as CustomEvent<SystemSettings>;
      if (custom.detail) setSettings(custom.detail);
    };
    window.addEventListener("darkit:settings-updated", onSettingsUpdated);
    return () =>
      window.removeEventListener("darkit:settings-updated", onSettingsUpdated);
  }, []);

  const biMetrics = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== "CANCELLED");
    const totalSales = validOrders.reduce(
      (s, o) => s + (o.totalAmount ?? 0),
      0,
    );
    const aov = validOrders.length > 0 ? totalSales / validOrders.length : 0;

    const prepMins = orders
      .map((o) =>
        o.prepStartedAt && o.prepCompletedAt
          ? (new Date(o.prepCompletedAt).getTime() -
              new Date(o.prepStartedAt).getTime()) /
            60000
          : null,
      )
      .filter((v): v is number => v !== null && v >= 0);
    const avgPrep =
      prepMins.length > 0
        ? prepMins.reduce((a, b) => a + b, 0) / prepMins.length
        : 0;

    const dwellMins = orders
      .map((o) =>
        o.readyAt && o.pickedUpAt
          ? (new Date(o.pickedUpAt).getTime() - new Date(o.readyAt).getTime()) /
            60000
          : null,
      )
      .filter((v): v is number => v !== null && v >= 0);
    const avgDwell =
      dwellMins.length > 0
        ? dwellMins.reduce((a, b) => a + b, 0) / dwellMins.length
        : 0;

    const lifeMins = orders
      .map((o) =>
        o.receivedAt && o.dispatchedAt
          ? (new Date(o.dispatchedAt).getTime() -
              new Date(o.receivedAt).getTime()) /
            60000
          : null,
      )
      .filter((v): v is number => v !== null && v >= 0);
    const avgLifecycle =
      lifeMins.length > 0
        ? lifeMins.reduce((a, b) => a + b, 0) / lifeMins.length
        : 0;

    const prePrepCancels = cancellations.filter(
      (c) => c.stage === "BEFORE_PREP",
    );
    const midPrepCancels = cancellations.filter(
      (c) => c.stage === "DURING_OR_AFTER_PREP",
    );
    const postPickupCancels = cancellations.filter(
      (c) => c.stage === "AFTER_PICKUP",
    );

    const prePrepLoss = prePrepCancels.reduce((s, c) => s + c.financialLoss, 0);
    const midPrepLoss = midPrepCancels.reduce((s, c) => s + c.financialLoss, 0);
    const postPickupLoss = postPickupCancels.reduce(
      (s, c) => s + c.financialLoss,
      0,
    );
    const totalFoodLaborLoss = prePrepLoss + midPrepLoss + postPickupLoss;
    const totalAggregatorClaims = postPickupCancels.reduce(
      (s, c) => s + c.claimAmount,
      0,
    );

    return {
      totalSales,
      aov,
      avgPrep,
      avgDwell,
      avgLifecycle,
      prePrepCancels: prePrepCancels.length,
      midPrepCancels: midPrepCancels.length,
      postPickupCancels: postPickupCancels.length,
      prePrepLoss,
      midPrepLoss,
      postPickupLoss,
      totalFoodLaborLoss,
      totalAggregatorClaims,
    };
  }, [orders, cancellations]);

  const leakageSummary = useMemo(() => {
    const potential = leakageVectors.reduce((s, v) => s + v.potentialRevenue, 0);
    const collected = leakageVectors.reduce((s, v) => s + v.actualCollected, 0);
    const leaked = potential - collected;
    const pct = potential > 0 ? (leaked / potential) * 100 : 0;
    return { potential, collected, leaked, pct };
  }, [leakageVectors]);

  const calculatedYieldPct =
    asPurchasedWeight > 0
      ? (usableEdibleWeight / asPurchasedWeight) * 100
      : 0;

  async function handleLeakageAction(
    id: string,
    status: RevenueLeakageVector["status"],
  ) {
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/system", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE_LEAKAGE_VECTOR", id, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to update leakage status.");
        return;
      }
      setLeakageVectors(data.leakageVectors);
      setNotice(`Leakage vector ${id} marked as ${status}.`);
    } catch {
      setError("Network error while updating leakage vector.");
    }
  }

  return (
    <AppShell
      title="Analytics & Margin"
      subtitle="Throughput SLAs, yield variance & aggregator payout leakage"
      rightActions={
        <div
          role="tablist"
          className="flex items-center rounded-md border border-white/[0.06] bg-[#151519] p-0.5"
        >
          {(
            [
              { id: "BI_YIELD", label: "BI & Yield" },
              { id: "LEAKAGE", label: "Leakage Audit" },
              { id: "ROADMAP_PERF", label: "Rollout" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-[5px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-[#27272e] text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      }
    >
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

        {activeTab === "BI_YIELD" && (
          <div className="space-y-5">
            {/* Hairline Metric Strip */}
            <section className="grid grid-cols-2 divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519] sm:grid-cols-3 lg:grid-cols-6 sm:divide-x sm:divide-y-0">
              <div className="px-4 py-3">
                <p className="text-[11px] font-medium text-zinc-400">
                  Net Sales
                </p>
                <p className="mt-1 font-mono text-lg font-semibold text-emerald-300 tabular-nums">
                  {fmt(biMetrics.totalSales)}
                </p>
                <p className="text-[11px] text-zinc-500 tabular-nums">
                  AOV {fmt(biMetrics.aov)}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] font-medium text-zinc-400">
                  Avg Prep
                </p>
                <p className="mt-1 font-mono text-lg font-semibold text-zinc-100 tabular-nums">
                  {biMetrics.avgPrep.toFixed(1)}m
                </p>
                <p className="text-[11px] text-zinc-500">PREP → READY</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] font-medium text-zinc-400">
                  Rider Dwell
                </p>
                <p className="mt-1 font-mono text-lg font-semibold text-zinc-100 tabular-nums">
                  {biMetrics.avgDwell.toFixed(1)}m
                </p>
                <p className="text-[11px] text-zinc-500">READY → PICKUP</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] font-medium text-zinc-400">
                  Total Cycle
                </p>
                <p className="mt-1 font-mono text-lg font-semibold text-zinc-100 tabular-nums">
                  {biMetrics.avgLifecycle.toFixed(1)}m
                </p>
                <p className="text-[11px] text-zinc-500">IN → DISPATCH</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] font-medium text-zinc-400">
                  Cancel Loss
                </p>
                <p className="mt-1 font-mono text-lg font-semibold text-rose-300 tabular-nums">
                  {fmt(biMetrics.totalFoodLaborLoss)}
                </p>
                <p className="text-[11px] text-zinc-500 tabular-nums">
                  Mid {fmt(biMetrics.midPrepLoss)}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] font-medium text-zinc-400">Claims</p>
                <p className="mt-1 font-mono text-lg font-semibold text-amber-300 tabular-nums">
                  {fmt(biMetrics.totalAggregatorClaims)}
                </p>
                <p className="text-[11px] text-zinc-500">Post-pickup</p>
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
              {/* Raw Material Yield Table */}
              <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60">
                <div className="border-b border-white/[0.06] px-4 py-2.5">
                  <h2 className="text-xs font-semibold text-zinc-200">
                    Raw Material Yield &amp; Theoretical vs. Actual COGS
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-[#09090b]/40 text-[11px] font-medium text-zinc-500">
                        <th className="px-4 py-2">Ingredient</th>
                        <th className="px-4 py-2 text-right">Target %</th>
                        <th className="px-4 py-2 text-right">Actual %</th>
                        <th className="px-4 py-2 text-right">Variance</th>
                        <th className="px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {Array.from(
                        new Map(inventory.map((i) => [i.id, i])).values(),
                      ).map((item) => {
                        const exp = item.expectedYieldPct ?? 90;
                        const act = item.actualYieldPct ?? 88;
                        const diff = act - exp;
                        const alert = diff <= -4;
                        return (
                          <tr
                            key={`${item.kitchenId ?? "K1"}-${item.id}`}
                            className="hover:bg-[#1d1d22]/40"
                          >
                            <td className="px-4 py-2.5 font-medium text-zinc-100">
                              {item.name}{" "}
                              <span className="font-mono text-[10px] text-zinc-500">
                                {item.sku}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-zinc-400 tabular-nums">
                              {exp.toFixed(1)}%
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-medium text-zinc-100 tabular-nums">
                              {act.toFixed(1)}%
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right font-mono font-semibold tabular-nums ${
                                alert ? "text-rose-400" : "text-amber-300"
                              }`}
                            >
                              {diff > 0
                                ? `+${diff.toFixed(1)}%`
                                : `${diff.toFixed(1)}%`}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium ${
                                  alert
                                    ? "border-rose-500/35 bg-rose-500/10 text-rose-300"
                                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                }`}
                              >
                                {alert ? "WASTE ALERT" : "OK"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Right Column: Yield Calculator & Stage Cancellation Breakdown */}
              <div className="space-y-5">
                <section className="rounded-lg border border-white/[0.06] bg-[#151519]/60 p-4">
                  <h3 className="text-xs font-semibold text-zinc-200">
                    Metric Food Yield Calculator
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs">
                    <label className="block">
                      <span className="text-[11px] text-zinc-400">
                        Purchased (kg)
                      </span>
                      <input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={asPurchasedWeight}
                        onChange={(e) =>
                          setAsPurchasedWeight(
                            Math.max(0.1, Number(e.target.value) || 0.1),
                          )
                        }
                        className="mt-1 h-8 w-full rounded-md border border-white/[0.08] bg-[#0e0e11] px-2.5 font-mono text-zinc-100 tabular-nums"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-zinc-400">
                        Usable Edible (kg)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={usableEdibleWeight}
                        onChange={(e) =>
                          setUsableEdibleWeight(
                            Math.max(0, Number(e.target.value) || 0),
                          )
                        }
                        className="mt-1 h-8 w-full rounded-md border border-white/[0.08] bg-[#0e0e11] px-2.5 font-mono text-zinc-100 tabular-nums"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-md border border-white/[0.06] bg-[#0e0e11] px-3 py-2">
                    <span className="text-xs text-zinc-400">Physical Yield</span>
                    <span className="font-mono text-base font-semibold text-emerald-300 tabular-nums">
                      {calculatedYieldPct.toFixed(1)}%
                    </span>
                  </div>
                </section>

                <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60">
                  <div className="border-b border-white/[0.06] px-4 py-2.5">
                    <h3 className="text-xs font-semibold text-zinc-200">
                      Cancellation Stage Impact
                    </h3>
                  </div>
                  <div className="divide-y divide-white/[0.06] text-xs">
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="font-medium text-zinc-100">
                          Before Prep (PENDING)
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          Stock restored + GST credit note
                        </p>
                      </div>
                      <span className="font-mono text-amber-300 tabular-nums">
                        {biMetrics.prePrepCancels} ({fmt(biMetrics.prePrepLoss)})
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="font-medium text-zinc-100">
                          Mid-Production
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          Irreversible COGS + prep labor
                        </p>
                      </div>
                      <span className="font-mono text-rose-300 tabular-nums">
                        {biMetrics.midPrepCancels} ({fmt(biMetrics.midPrepLoss)})
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="font-medium text-zinc-100">Post-Pickup</p>
                        <p className="text-[11px] text-zinc-500">
                          Aggregator payout dispute claim
                        </p>
                      </div>
                      <span className="font-mono text-violet-300 tabular-nums">
                        {biMetrics.postPickupCancels} (
                        {fmt(biMetrics.totalAggregatorClaims)})
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {activeTab === "LEAKAGE" && (
          <div className="space-y-5">
            <section className="grid grid-cols-2 divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              <div className="px-4 py-3">
                <p className="text-[11px] text-zinc-400">Potential Revenue</p>
                <p className="mt-1 font-mono text-lg font-semibold text-zinc-100 tabular-nums">
                  {fmt(leakageSummary.potential)}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] text-zinc-400">Actual Collected</p>
                <p className="mt-1 font-mono text-lg font-semibold text-emerald-300 tabular-nums">
                  {fmt(leakageSummary.collected)}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] text-zinc-400">Leaked Amount</p>
                <p className="mt-1 font-mono text-lg font-semibold text-rose-300 tabular-nums">
                  {fmt(leakageSummary.leaked)}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] text-zinc-400">Leakage Rate</p>
                <p className="mt-1 font-mono text-lg font-semibold text-amber-300 tabular-nums">
                  {leakageSummary.pct.toFixed(2)}%
                </p>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-[#09090b]/40 text-[11px] font-medium text-zinc-500">
                      <th className="px-4 py-2">Leakage Vector</th>
                      <th className="px-4 py-2">Operational Signature</th>
                      <th className="px-4 py-2">Impact</th>
                      <th className="px-4 py-2 text-right">Leaked</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2 text-right">Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {leakageVectors.map((vec) => (
                      <tr key={vec.id} className="hover:bg-[#1d1d22]/40">
                        <td className="px-4 py-2.5 font-medium text-zinc-100">
                          {vec.vector}
                          <p className="font-mono text-[10px] text-zinc-500 tabular-nums">
                            {vec.affectedAccounts} order(s)
                          </p>
                        </td>
                        <td className="max-w-md px-4 py-2.5 text-zinc-400">
                          {vec.signature}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-amber-300">
                          {vec.impactNote}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-rose-300 tabular-nums">
                          {fmt(vec.leakedAmount)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium ${
                              vec.status === "RECOVERED"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : vec.status === "AUDITING"
                                  ? "border-amber-500/35 bg-amber-500/10 text-amber-300"
                                  : "border-rose-500/35 bg-rose-500/10 text-rose-300"
                            }`}
                          >
                            {vec.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {vec.status !== "RECOVERED" ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleLeakageAction(vec.id, "RECOVERED")
                              }
                              className="h-7 rounded-md bg-emerald-500 px-2.5 text-[11px] font-semibold text-zinc-950 hover:bg-emerald-400"
                            >
                              Reconcile
                            </button>
                          ) : (
                            <span className="font-mono text-[11px] text-emerald-400">
                              Reconciled
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeTab === "ROADMAP_PERF" && (
          <div className="space-y-5">
            <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60">
              <div className="border-b border-white/[0.06] px-4 py-2.5">
                <h2 className="text-xs font-semibold text-zinc-200">
                  Production Rollout Blueprint (Sprints 1–5 Complete)
                </h2>
              </div>
              <div className="grid divide-y divide-white/[0.06] sm:grid-cols-2 sm:divide-x lg:grid-cols-3">
                {PRODUCTION_MILESTONES.map((ms) => (
                  <div key={ms.id} className="p-4 text-xs">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="font-semibold text-zinc-300">
                        {ms.id}
                      </span>
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-300">
                        {ms.status}
                      </span>
                    </div>
                    <p className="mt-1.5 font-semibold text-zinc-100">
                      {ms.name}
                    </p>
                    <p className="text-[11px] text-zinc-500">{ms.domain}</p>
                    <p className="mt-2 text-zinc-400">{ms.task}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]/60">
              <div className="border-b border-white/[0.06] px-4 py-2.5">
                <h2 className="text-xs font-semibold text-zinc-200">
                  Scaling Architecture Notes
                </h2>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {PERFORMANCE_HOTSPOTS.map((issue) => (
                  <div key={issue.title} className="p-4 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-zinc-100">
                        {issue.title}
                      </h3>
                      <span className="shrink-0 rounded bg-[#1d1d22] px-2 py-0.5 font-mono text-[10px] text-zinc-300">
                        {issue.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-zinc-400">{issue.detail}</p>
                    <p className="mt-1 font-mono text-[11px] text-zinc-500">
                      Target: {issue.fix}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
