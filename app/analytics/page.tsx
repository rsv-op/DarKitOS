"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
      "Drizzle ORM 19-table PostgreSQL schema (db/schema.ts), Supavisor pooling (prepare: false), composite (kitchen_id, ingredient_id) stock ledgers, sorted FOR UPDATE locking, and atomic inter-kitchen transfers.",
    fix: "Set DATABASE_URL (Supavisor port 6543) & DIRECT_URL (port 5432) in Vercel/Supabase and run npm run db:migrate && npm run db:seed.",
  },
  {
    title: "Sub-second KDS & ops Realtime push with polling fallback",
    severity: "Implemented · Sprint 2",
    detail:
      "Kitchen Board (/kds), Dispatch, Live Orders, Inventory, and Owner views subscribe to org:${orgId}:kitchen:${kitchenId} / org:${orgId}:all Supabase Realtime Broadcast channels.",
    fix: "Automatically switches to 30s heartbeats when REALTIME_LIVE and degrades seamlessly to 3.5s HTTP polling when offline.",
  },
  {
    title: "Cursor pagination for high-volume historical archives",
    severity: "Medium · Sprint 2+",
    detail:
      "Indexed PostgreSQL queries (kitchen_id, status) and (brand_id, created_at) are live; add cursor pagination when historical order volumes exceed 10k rows.",
    fix: "Extend GET /api/orders with cursor pagination and date-window partitions.",
  },
];

const PRODUCTION_MILESTONES = [
  {
    id: "SPRINT-1",
    name: "Sprint 1 · Persistence & Stock Ledger",
    domain: "Supabase (ap-south-1) + Drizzle ORM",
    status: "COMPLETE",
    task: "Durable 19-table Postgres schema, per-kitchen (kitchen_id, ingredient_id) stock isolation, inter-kitchen transfers, SELECT FOR UPDATE depletion, Vitest CI.",
  },
  {
    id: "SPRINT-2",
    name: "Sprint 2 · Auth, RBAC & Realtime",
    domain: "Supabase Auth + RLS + Realtime",
    status: "COMPLETE",
    task: "Multi-tenant organizations + PostgreSQL RLS, Email/Password & OTP auth, two-level org+kitchen RBAC with instant revocation, and sub-second Realtime KDS sync.",
  },
  {
    id: "SPRINT-3A",
    name: "Sprint 3A · India GST & Razorpay",
    domain: "Compliance & Direct UPI",
    status: "PLANNED",
    task: "5% GST invoices (CGST/SGST/IGST), GSTIN & FSSAI stamps, FY sequential invoice numbers, Tally/Zoho CSV, and Razorpay Direct Web UPI/refunds.",
  },
  {
    id: "SPRINT-3B",
    name: "Sprint 3B · Aggregators & WhatsApp",
    domain: "UrbanPiper + QStash + Interakt",
    status: "PLANNED",
    task: "Signed Swiggy/Zomato webhooks via UrbanPiper, transactional outbox + Upstash QStash retries, auto-86 stockout sync, and Interakt/Gupshup WhatsApp alerts.",
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

  // Interactive Yield Calculator state (metric kg)
  const [asPurchasedWeight, setAsPurchasedWeight] = useState<number>(20);
  const [usableEdibleWeight, setUsableEdibleWeight] = useState<number>(16.8);

  const currency: SupportedCurrency = settings?.currency ?? "INR";
  const fmt = useCallback(
    (amount: number) => formatCurrency(amount, currency),
    [currency],
  );

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/system", {
        cache: "no-store",
      });
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

    // Prep durations
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

    // Dispatch dwell time (readyAt -> pickedUpAt)
    const dwellMins = orders
      .map((o) =>
        o.readyAt && o.pickedUpAt
          ? (new Date(o.pickedUpAt).getTime() -
              new Date(o.readyAt).getTime()) /
            60000
          : null,
      )
      .filter((v): v is number => v !== null && v >= 0);
    const avgDwell =
      dwellMins.length > 0
        ? dwellMins.reduce((a, b) => a + b, 0) / dwellMins.length
        : 0;

    // Total lifecycle (receivedAt -> dispatchedAt)
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

    const prePrepLoss = prePrepCancels.reduce(
      (s, c) => s + c.financialLoss,
      0,
    );
    const midPrepLoss = midPrepCancels.reduce(
      (s, c) => s + c.financialLoss,
      0,
    );
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
    const potential = leakageVectors.reduce(
      (s, v) => s + v.potentialRevenue,
      0,
    );
    const collected = leakageVectors.reduce(
      (s, v) => s + v.actualCollected,
      0,
    );
    const leaked = potential - collected;
    const pct = potential > 0 ? (leaked / potential) * 100 : 0;
    return {
      potential,
      collected,
      leaked,
      pct,
    };
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "UPDATE_LEAKAGE_VECTOR",
          id,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to update leakage status.");
        return;
      }
      setLeakageVectors(data.leakageVectors);
      setNotice(`Revenue leakage item ${id} marked as ${status}.`);
    } catch {
      setError("Network error while updating leakage vector.");
    }
  }

  return (
    <AppShell
      title="Analytics & Margin"
      subtitle="Review INR sales volume, kitchen prep SLAs, ingredient yield variance, and aggregator payout leakage."
      actions={
        <div className="flex flex-wrap rounded-xl border border-slate-800 bg-slate-900 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("BI_YIELD")}
            className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition ${
              activeTab === "BI_YIELD"
                ? "bg-sky-500 text-slate-950"
                : "text-slate-400 hover:text-white"
            }`}
          >
            1. Kitchen BI &amp; Food Yield
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("LEAKAGE")}
            className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition ${
              activeTab === "LEAKAGE"
                ? "bg-purple-500 text-slate-950"
                : "text-slate-400 hover:text-white"
            }`}
          >
            2. Revenue Leakage Audit
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ROADMAP_PERF")}
            className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition ${
              activeTab === "ROADMAP_PERF"
                ? "bg-emerald-500 text-slate-950"
                : "text-slate-400 hover:text-white"
            }`}
          >
            3. Scale &amp; Rollout Readiness
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-300">
            ⚠ {error}
          </div>
        )}

        {notice && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-mono text-xs text-emerald-300">
            ✓ {notice}
          </div>
        )}

        {activeTab === "BI_YIELD" && (
          <div className="space-y-6">
            {/* Operational Duration & Financial KPIs */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="font-mono text-[10px] font-bold uppercase text-emerald-300">
                  Net Sales Volume
                </p>
                <p className="mt-1.5 text-2xl font-black text-white">
                  {fmt(biMetrics.totalSales)}
                </p>
                <p className="font-mono text-[10px] text-slate-400">
                  AOV {fmt(biMetrics.aov)}
                </p>
              </div>

              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4">
                <p className="font-mono text-[10px] font-bold uppercase text-sky-300">
                  Avg Prep Duration
                </p>
                <p className="mt-1.5 text-2xl font-black text-white">
                  {biMetrics.avgPrep.toFixed(1)}m
                </p>
                <p className="font-mono text-[10px] text-slate-400">
                  PREPARING → READY
                </p>
              </div>

              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4">
                <p className="font-mono text-[10px] font-bold uppercase text-purple-300">
                  Rider Wait Time
                </p>
                <p className="mt-1.5 text-2xl font-black text-white">
                  {biMetrics.avgDwell.toFixed(1)}m
                </p>
                <p className="font-mono text-[10px] text-slate-400">
                  READY → PICKED_UP
                </p>
              </div>

              <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-4">
                <p className="font-mono text-[10px] font-bold uppercase text-teal-300">
                  Total Lifecycle
                </p>
                <p className="mt-1.5 text-2xl font-black text-white">
                  {biMetrics.avgLifecycle.toFixed(1)}m
                </p>
                <p className="font-mono text-[10px] text-slate-400">
                  RECEIVED → DISPATCHED
                </p>
              </div>

              <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
                <p className="font-mono text-[10px] font-bold uppercase text-red-300">
                  Cancellation Loss
                </p>
                <p className="mt-1.5 text-2xl font-black text-white">
                  {fmt(biMetrics.totalFoodLaborLoss)}
                </p>
                <p className="font-mono text-[10px] text-slate-400">
                  Mid-prep: {fmt(biMetrics.midPrepLoss)}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="font-mono text-[10px] font-bold uppercase text-amber-300">
                  Aggregator Claims
                </p>
                <p className="mt-1.5 text-2xl font-black text-white">
                  {fmt(biMetrics.totalAggregatorClaims)}
                </p>
                <p className="font-mono text-[10px] text-slate-400">
                  Post-pickup claims
                </p>
              </div>
            </section>

            {/* Food Yield Optimization & Cost Variance Engine */}
            <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-purple-400">
                  Kitchen Margin • Physical Goods Variance
                </span>
                <h2 className="mt-1 text-lg font-black text-white">
                  Raw Material Yield &amp; Theoretical vs. Actual COGS Matrix
                </h2>
                <p className="text-xs text-slate-400">
                  Compares physical inventory depletion against standardized
                  recipe yields to surface trim waste, spoilage, and
                  over-portioning.
                </p>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 bg-slate-950 font-mono text-[10px] uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2.5">SKU / Ingredient</th>
                        <th className="px-3 py-2.5">Target Yield %</th>
                        <th className="px-3 py-2.5">Actual Yield %</th>
                        <th className="px-3 py-2.5">Variance</th>
                        <th className="px-3 py-2.5">Diagnostic Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {Array.from(
                        new Map(inventory.map((i) => [i.id, i])).values(),
                      ).map((item) => {
                        const exp = item.expectedYieldPct ?? 90;
                        const act = item.actualYieldPct ?? 88;
                        const diff = act - exp;
                        const alert = diff <= -4;
                        return (
                          <tr key={`${item.kitchenId ?? "K1"}-${item.id}`}>
                            <td className="px-3 py-2.5 font-semibold text-white">
                              {item.name}{" "}
                              <span className="font-mono text-[10px] text-slate-400">
                                ({item.sku})
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-slate-300">
                              {exp.toFixed(1)}%
                            </td>
                            <td className="px-3 py-2.5 font-mono font-bold text-white">
                              {act.toFixed(1)}%
                            </td>
                            <td
                              className={`px-3 py-2.5 font-mono font-bold ${
                                alert ? "text-red-400" : "text-amber-300"
                              }`}
                            >
                              {diff > 0
                                ? `+${diff.toFixed(1)}%`
                                : `${diff.toFixed(1)}%`}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                                  alert
                                    ? "bg-red-500/20 text-red-300"
                                    : "bg-emerald-500/20 text-emerald-300"
                                }`}
                              >
                                {alert
                                  ? "OVER-PORTION / WASTE ALERT"
                                  : "WITHIN TOLERANCE"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Interactive Yield Formula Calculator & Stage-Accurate Cancellation Matrix */}
              <div className="space-y-6">
                <section className="rounded-2xl border border-purple-500/30 bg-slate-900/80 p-5">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-purple-300">
                    Interactive Food Yield Calculator (Metric)
                  </h3>
                  <code className="mt-2 block rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-purple-200">
                    Yield % = (Usable Edible Weight ÷ As Purchased Weight) × 100
                  </code>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <label className="block">
                      <span className="font-mono text-[10px] uppercase text-slate-400">
                        Purchased Weight (kg)
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
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="font-mono text-[10px] uppercase text-slate-400">
                        Usable Edible Weight (kg)
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
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-white"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                    <span className="text-xs text-slate-400">
                      Calculated Physical Yield:
                    </span>
                    <span className="font-mono text-xl font-black text-emerald-400">
                      {calculatedYieldPct.toFixed(1)}%
                    </span>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-red-400">
                    Stage-Accurate Cancellation Impact Matrix
                  </h3>
                  <div className="mt-3 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3">
                      <div>
                        <p className="font-bold text-white">
                          1. Pre-Preparation (PENDING)
                        </p>
                        <p className="text-[11px] text-slate-400">
                          No stock deducted (or restored if reserved)
                        </p>
                      </div>
                      <span className="font-mono text-sm font-black text-amber-300">
                        {biMetrics.prePrepCancels} case(s) (
                        {fmt(biMetrics.prePrepLoss)})
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3">
                      <div>
                        <p className="font-bold text-white">
                          2. Mid-Production (PREPARING / READY)
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Irreversible COGS + station labor allowance
                        </p>
                      </div>
                      <span className="font-mono text-sm font-black text-red-400">
                        {biMetrics.midPrepCancels} case(s) (
                        {fmt(biMetrics.midPrepLoss)})
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3">
                      <div>
                        <p className="font-bold text-white">
                          3. Post-Pickup (PICKED_UP / DISPATCHED)
                        </p>
                        <p className="text-[11px] text-slate-400">
                          COGS loss {fmt(biMetrics.postPickupLoss)} · Tagged for
                          aggregator claim
                        </p>
                      </div>
                      <span className="font-mono text-sm font-black text-purple-300">
                        {biMetrics.postPickupCancels} case(s) (
                        {fmt(biMetrics.totalAggregatorClaims)} claim)
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {activeTab === "LEAKAGE" && (
          <div className="space-y-6">
            {/* Revenue Leakage Diagnostic Banner */}
            <section className="rounded-2xl border border-purple-500/40 bg-purple-500/5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-purple-400">
                    Cloud Kitchen Revenue Recovery • Swiggy, Zomato &amp; Direct
                  </span>
                  <h2 className="mt-1 text-2xl font-black text-white">
                    Estimated Revenue Leakage:{" "}
                    <span className="text-purple-300">
                      {leakageSummary.pct.toFixed(2)}%
                    </span>{" "}
                    ({fmt(leakageSummary.leaked)} Uncollected)
                  </h2>
                  <code className="mt-2 inline-block rounded-lg bg-slate-950 px-3 py-1.5 font-mono text-xs text-purple-200">
                    Revenue Leakage (%) = (Potential{" "}
                    {fmt(leakageSummary.potential)} − Collected{" "}
                    {fmt(leakageSummary.collected)}) ÷ Potential × 100
                  </code>
                </div>
              </div>
            </section>

            {/* Indian Cloud Kitchen Leakage Vectors Table */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950 font-mono text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-3.5">Leakage Vector</th>
                      <th className="px-4 py-3.5">Operational Signature</th>
                      <th className="px-4 py-3.5">Financial Impact Level</th>
                      <th className="px-4 py-3.5">Leaked Amount</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5 text-right">
                        Remediation Control
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {leakageVectors.map((vec) => (
                      <tr key={vec.id}>
                        <td className="px-4 py-4 font-bold text-white">
                          {vec.vector}
                          <p className="font-mono text-[10px] text-slate-500">
                            {vec.affectedAccounts} impacted order(s)
                          </p>
                        </td>
                        <td className="px-4 py-4 text-slate-300 max-w-md">
                          {vec.signature}
                        </td>
                        <td className="px-4 py-4 font-mono text-amber-300">
                          {vec.impactNote}
                        </td>
                        <td className="px-4 py-4 font-mono text-sm font-black text-red-400">
                          {fmt(vec.leakedAmount)}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                              vec.status === "RECOVERED"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : vec.status === "AUDITING"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-red-500/20 text-red-300"
                            }`}
                          >
                            {vec.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {vec.status !== "RECOVERED" ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleLeakageAction(vec.id, "RECOVERED")
                              }
                              className="rounded-lg bg-emerald-500 px-3 py-1.5 font-mono text-[10px] font-bold text-slate-950 hover:bg-emerald-400"
                            >
                              Mark Reconciled
                            </button>
                          ) : (
                            <span className="font-mono text-[10px] text-emerald-400">
                              ✓ Reconciled
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
          <div className="space-y-6">
            {/* Production Rollout Plan */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="font-mono text-xs font-bold uppercase text-emerald-400">
                    Locked Production Stack · India Cloud Kitchens
                  </span>
                  <h2 className="mt-1 text-lg font-black text-white">
                    Sprints 1–4 Rollout Blueprint
                  </h2>
                </div>
                <span className="rounded-full bg-sky-500/20 px-3 py-1 font-mono text-xs font-bold text-sky-300">
                  Sprint 0 Showcase Verified
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {PRODUCTION_MILESTONES.map((ms) => (
                  <div
                    key={ms.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-sky-400 font-bold">{ms.id}</span>
                      <span
                        className={
                          ms.status === "NEXT"
                            ? "text-emerald-400 font-bold"
                            : "text-slate-400"
                        }
                      >
                        ● {ms.status}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-bold text-white">
                      {ms.name}
                    </p>
                    <p className="text-[11px] text-amber-300 mt-0.5">
                      {ms.domain}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">{ms.task}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Real Scaling Hotspots */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h2 className="text-lg font-black text-white mb-4">
                Verified Scaling Gaps &amp; Engineering Fixes
              </h2>
              <div className="grid gap-4 lg:grid-cols-3">
                {PERFORMANCE_HOTSPOTS.map((issue) => (
                  <div
                    key={issue.title}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-sm text-white">
                        {issue.title}
                      </h3>
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300 shrink-0">
                        {issue.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-300">
                      {issue.detail}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      <strong className="text-sky-300">Target Fix:</strong>{" "}
                      {issue.fix}
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
