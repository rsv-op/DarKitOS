"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import AppShell from "@/components/AppShell";
import type {
  CancellationRecord,
  InventoryItem,
  Order,
  RevenueLeakageVector,
  SystemSettings,
} from "@/lib/db";

const PERFORMANCE_HOTSPOTS = [
  {
    title: "Array scans on every request",
    severity: "High",
    detail:
      "Employee lookups, permission checks, and inventory matching use O(n) scans across the request lifecycle.",
    impact:
      "As multi-brand order volumes increase across kitchens, request latency scales linearly with lookup count.",
    fix: "Index employees, permissions, and inventory SKUs in constant-time O(1) Maps.",
  },
  {
    title: "Store clones are too broad",
    severity: "Medium",
    detail:
      "Full store snapshots clone nested arrays on reads and updates rather than structural sharing.",
    impact:
      "Increases allocation churn under high-frequency KDS WebSocket/polling intervals.",
    fix: "Adopt shallow clone-on-write for mutated aggregates only.",
  },
  {
    title: "Orders API cursor pagination",
    severity: "High",
    detail:
      "GET /api/orders supports server-side filtering by status, brand, kitchen, and channel.",
    impact:
      "Prevents client-side memory bloat as historical order archives grow.",
    fix: "Combine server-side filters with cursor-based pagination for archival queries.",
  },
];

const AUTONOMOUS_AGENTS = [
  {
    id: "AGT-RLS-01",
    name: "postgres-rls-auditor",
    domain: "Database Security",
    status: "ACTIVE",
    task: "Verifies set_config('app.current_tenant', id, true) across PgBouncer transaction pools.",
  },
  {
    id: "AGT-QA-02",
    name: "idempotency-chaos-tester",
    domain: "QA & Reliability",
    status: "ACTIVE",
    task: "Simulates concurrent aggregator webhook retries against ON CONFLICT DO NOTHING constraints.",
  },
  {
    id: "AGT-VF-03",
    name: "quote-to-cash-reconciler",
    domain: "VerticalForge FinOps",
    status: "SCANNING",
    task: "Cross-references CRM upgrades, coupon expirations, and billing invoices for leakage.",
  },
  {
    id: "AGT-KDS-04",
    name: "kds-sync-watchdog",
    domain: "Edge Operations",
    status: "ACTIVE",
    task: "Monitors WebSocket heartbeat latency and orchestrates SSE / HTTP-Polling failover.",
  },
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<
    "BI_YIELD" | "LEAKAGE" | "CLOUD7_PERF"
  >("BI_YIELD");

  const [orders, setOrders] = useState<Order[]>(
    [],
  );
  const [inventory, setInventory] = useState<
    InventoryItem[]
  >([]);
  const [cancellations, setCancellations] =
    useState<CancellationRecord[]>([]);
  const [leakageVectors, setLeakageVectors] =
    useState<RevenueLeakageVector[]>([]);
  const [settings, setSettings] =
    useState<SystemSettings | null>(null);
  const [notice, setNotice] = useState("");

  // Interactive Yield Calculator state
  const [asPurchasedWeight, setAsPurchasedWeight] =
    useState<number>(50);
  const [usableEdibleWeight, setUsableEdibleWeight] =
    useState<number>(40);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/system", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.orders))
        setOrders(data.orders);
      if (Array.isArray(data.inventory))
        setInventory(data.inventory);
      if (Array.isArray(data.cancellations))
        setCancellations(data.cancellations);
      if (Array.isArray(data.leakageVectors))
        setLeakageVectors(data.leakageVectors);
      if (data.settings)
        setSettings(data.settings);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const biMetrics = useMemo(() => {
    const validOrders = orders.filter(
      (o) => o.status !== "CANCELLED",
    );
    const totalSales = validOrders.reduce(
      (s, o) => s + (o.totalAmount ?? 0),
      0,
    );
    const aov =
      validOrders.length > 0
        ? totalSales / validOrders.length
        : 0;

    // Prep durations
    const prepMins = orders
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
          v !== null && v >= 0,
      );
    const avgPrep =
      prepMins.length > 0
        ? prepMins.reduce((a, b) => a + b, 0) /
          prepMins.length
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
      .filter(
        (v): v is number =>
          v !== null && v >= 0,
      );
    const avgDwell =
      dwellMins.length > 0
        ? dwellMins.reduce((a, b) => a + b, 0) /
          dwellMins.length
        : 0;

    // Total lifecycle (receivedAt -> dispatchedAt)
    const lifeMins = orders
      .map((o) =>
        o.receivedAt && o.dispatchedAt
          ? (new Date(
              o.dispatchedAt,
            ).getTime() -
              new Date(o.receivedAt).getTime()) /
            60000
          : null,
      )
      .filter(
        (v): v is number =>
          v !== null && v >= 0,
      );
    const avgLifecycle =
      lifeMins.length > 0
        ? lifeMins.reduce((a, b) => a + b, 0) /
          lifeMins.length
        : 0;

    const prePrepCancels = cancellations.filter(
      (c) => c.stage === "BEFORE_PREP",
    );
    const midPrepCancels = cancellations.filter(
      (c) => c.stage === "DURING_OR_AFTER_PREP",
    );
    const postPickupCancels =
      cancellations.filter(
        (c) => c.stage === "AFTER_PICKUP",
      );

    const totalFoodLaborLoss =
      cancellations.reduce(
        (s, c) => s + c.financialLoss,
        0,
      );
    const totalAggregatorClaims =
      cancellations.reduce(
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
      postPickupCancels:
        postPickupCancels.length,
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
    const pct =
      potential > 0
        ? (leaked / potential) * 100
        : 0;
    return {
      potential,
      collected,
      leaked,
      pct,
    };
  }, [leakageVectors]);

  const calculatedYieldPct =
    asPurchasedWeight > 0
      ? (usableEdibleWeight /
          asPurchasedWeight) *
        100
      : 0;

  async function handleLeakageAction(
    id: string,
    status: RevenueLeakageVector["status"],
  ) {
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
    if (res.ok) {
      const data = await res.json();
      setLeakageVectors(data.leakageVectors);
      setNotice(
        `VerticalForge Leakage Vector ${id} updated to ${status}.`,
      );
    }
  }

  async function handleCircuitBreakerChange(
    state: SystemSettings["circuitBreakerState"],
  ) {
    const res = await fetch("/api/system", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "UPDATE_SETTINGS",
        settings: {
          circuitBreakerState: state,
        },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
      setNotice(
        `Cloud7 Edge API Gateway Circuit Breaker transitioned to ${state}.`,
      );
    }
  }

  return (
    <AppShell
      title="Business Intelligence, VerticalForge & Cloud7 Diagnostics"
      subtitle="Quantify operational durations, food yield & COGS variance, quote-to-cash revenue leakage, and Cloud7 multi-tenant infrastructure health."
      actions={
        <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1">
          <button
            type="button"
            onClick={() =>
              setActiveTab("BI_YIELD")
            }
            className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition ${
              activeTab === "BI_YIELD"
                ? "bg-sky-500 text-slate-950"
                : "text-slate-400 hover:text-white"
            }`}
          >
            1. Operational BI & Food Yield
          </button>
          <button
            type="button"
            onClick={() =>
              setActiveTab("LEAKAGE")
            }
            className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition ${
              activeTab === "LEAKAGE"
                ? "bg-purple-500 text-slate-950"
                : "text-slate-400 hover:text-white"
            }`}
          >
            2. Revenue Leakage Engine
          </button>
          <button
            type="button"
            onClick={() =>
              setActiveTab("CLOUD7_PERF")
            }
            className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition ${
              activeTab === "CLOUD7_PERF"
                ? "bg-emerald-500 text-slate-950"
                : "text-slate-400 hover:text-white"
            }`}
          >
            3. Cloud7 RLS & Performance
          </button>
        </div>
      }
    >
      <div className="space-y-6">
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
                  $
                  {biMetrics.totalSales.toFixed(
                    2,
                  )}
                </p>
                <p className="font-mono text-[10px] text-slate-400">
                  AOV ${biMetrics.aov.toFixed(2)}
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
                  PENDING → READY
                </p>
              </div>

              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4">
                <p className="font-mono text-[10px] font-bold uppercase text-purple-300">
                  Dispatch Dwell Time
                </p>
                <p className="mt-1.5 text-2xl font-black text-white">
                  {biMetrics.avgDwell.toFixed(
                    1,
                  )}
                  m
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
                  {biMetrics.avgLifecycle.toFixed(
                    1,
                  )}
                  m
                </p>
                <p className="font-mono text-[10px] text-slate-400">
                  RECEIVED → DISPATCHED
                </p>
              </div>

              <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
                <p className="font-mono text-[10px] font-bold uppercase text-red-300">
                  Food & Labor Loss
                </p>
                <p className="mt-1.5 text-2xl font-black text-white">
                  $
                  {biMetrics.totalFoodLaborLoss.toFixed(
                    2,
                  )}
                </p>
                <p className="font-mono text-[10px] text-slate-400">
                  Mid-prep cancellations
                </p>
              </div>

              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="font-mono text-[10px] font-bold uppercase text-amber-300">
                  Aggregator Claims
                </p>
                <p className="mt-1.5 text-2xl font-black text-white">
                  $
                  {biMetrics.totalAggregatorClaims.toFixed(
                    2,
                  )}
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
                  VerticalForge • Physical Goods Variance
                </span>
                <h2 className="mt-1 text-lg font-black text-white">
                  Raw Material Yield & Theoretical vs. Actual COGS Matrix
                </h2>
                <p className="text-xs text-slate-400">
                  Compares physical inventory depletion against standardized recipe yields to surface trim waste, spoilage, and over-portioning.
                </p>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 bg-slate-950 font-mono text-[10px] uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2.5">
                          SKU / Ingredient
                        </th>
                        <th className="px-3 py-2.5">
                          Target Yield %
                        </th>
                        <th className="px-3 py-2.5">
                          Actual Yield %
                        </th>
                        <th className="px-3 py-2.5">
                          Variance
                        </th>
                        <th className="px-3 py-2.5">
                          Diagnostic Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {inventory.map((item) => {
                        const exp =
                          item.expectedYieldPct ??
                          90;
                        const act =
                          item.actualYieldPct ??
                          88;
                        const diff = act - exp;
                        const alert = diff <= -4;
                        return (
                          <tr key={item.id}>
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
                                alert
                                  ? "text-red-400"
                                  : "text-amber-300"
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

              {/* Interactive Yield Formula Calculator & Cancellation Matrix */}
              <div className="space-y-6">
                <section className="rounded-2xl border border-purple-500/30 bg-slate-900/80 p-5">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-purple-300">
                    Interactive Food Yield Formula Calculator
                  </h3>
                  <code className="mt-2 block rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-purple-200">
                    Yield % = (Usable Edible Weight ÷ As Purchased Weight) × 100
                  </code>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <label className="block">
                      <span className="font-mono text-[10px] uppercase text-slate-400">
                        As Purchased Weight (lbs)
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={asPurchasedWeight}
                        onChange={(e) =>
                          setAsPurchasedWeight(
                            Math.max(
                              0.1,
                              Number(
                                e.target.value,
                              ) || 1,
                            ),
                          )
                        }
                        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="font-mono text-[10px] uppercase text-slate-400">
                        Usable Edible Weight (lbs)
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={usableEdibleWeight}
                        onChange={(e) =>
                          setUsableEdibleWeight(
                            Math.max(
                              0,
                              Number(
                                e.target.value,
                              ) || 0,
                            ),
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
                      {calculatedYieldPct.toFixed(
                        1,
                      )}
                      %
                    </span>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-red-400">
                    Categorized Cancellation Loss Matrix
                  </h3>
                  <div className="mt-3 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3">
                      <div>
                        <p className="font-bold text-white">
                          1. Pre-Preparation (PENDING)
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Ingredients restored to active inventory ledger
                        </p>
                      </div>
                      <span className="font-mono text-sm font-black text-amber-300">
                        {
                          biMetrics.prePrepCancels
                        }{" "}
                        cases
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3">
                      <div>
                        <p className="font-bold text-white">
                          2. Mid-Production (PREPARING / READY)
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Logged as irreversible Food & Labor Loss
                        </p>
                      </div>
                      <span className="font-mono text-sm font-black text-red-400">
                        {
                          biMetrics.midPrepCancels
                        }{" "}
                        cases ($
                        {biMetrics.totalFoodLaborLoss.toFixed(
                          2,
                        )}
                        )
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3">
                      <div>
                        <p className="font-bold text-white">
                          3. Post-Pickup (PICKED_UP / DISPATCHED)
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Tagged for Aggregator Accounting Reconciliation
                        </p>
                      </div>
                      <span className="font-mono text-sm font-black text-purple-300">
                        {
                          biMetrics.postPickupCancels
                        }{" "}
                        cases ($
                        {biMetrics.totalAggregatorClaims.toFixed(
                          2,
                        )}
                        )
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
                    VerticalForge • Quote-to-Cash Revenue Leakage Engine
                  </span>
                  <h2 className="mt-1 text-2xl font-black text-white">
                    Baseline Revenue Leakage:{" "}
                    <span className="text-purple-300">
                      {leakageSummary.pct.toFixed(
                        2,
                      )}
                      %
                    </span>{" "}
                    (${leakageSummary.leaked.toLocaleString()}{" "}
                    Uncollected)
                  </h2>
                  <code className="mt-2 inline-block rounded-lg bg-slate-950 px-3 py-1.5 font-mono text-xs text-purple-200">
                    Revenue Leakage (%) = (Total Potential Revenue $
                    {leakageSummary.potential.toLocaleString()}{" "}
                    − Actual Collected Revenue $
                    {leakageSummary.collected.toLocaleString()}
                    ) ÷ Total Potential Revenue × 100
                  </code>
                </div>
              </div>
            </section>

            {/* 5 Primary Leakage Vectors Table */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950 font-mono text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-3.5">
                        Leakage Vector
                      </th>
                      <th className="px-4 py-3.5">
                        Operational Signature
                      </th>
                      <th className="px-4 py-3.5">
                        Financial Impact Level
                      </th>
                      <th className="px-4 py-3.5">
                        Leaked Amount
                      </th>
                      <th className="px-4 py-3.5">
                        Status
                      </th>
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
                            {vec.affectedAccounts}{" "}
                            affected accounts
                          </p>
                        </td>
                        <td className="px-4 py-4 text-slate-300 max-w-md">
                          {vec.signature}
                        </td>
                        <td className="px-4 py-4 font-mono text-amber-300">
                          {vec.impactNote}
                        </td>
                        <td className="px-4 py-4 font-mono text-sm font-black text-red-400">
                          $
                          {vec.leakedAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                              vec.status ===
                              "RECOVERED"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : vec.status ===
                                    "AUDITING"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-red-500/20 text-red-300"
                            }`}
                          >
                            {vec.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {vec.status !==
                          "RECOVERED" ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleLeakageAction(
                                  vec.id,
                                  "RECOVERED",
                                )
                              }
                              className="rounded-lg bg-emerald-500 px-3 py-1.5 font-mono text-[10px] font-bold text-slate-950 hover:bg-emerald-400"
                            >
                              Recover Capital
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

        {activeTab === "CLOUD7_PERF" && (
          <div className="space-y-6">
            {/* Cloud7 Multi-Tenant RLS & API Gateway Circuit Breaker */}
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-sky-500/30 bg-slate-900/70 p-6">
                <span className="font-mono text-xs font-bold uppercase text-sky-400">
                  Cloud7 • Multi-Tenant Data Isolation
                </span>
                <h2 className="mt-1 text-lg font-black text-white">
                  PostgreSQL Row-Level Security (RLS) & PgBouncer Pooling
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Prevents cross-tenant data leakage in transaction-mode connection poolers by strictly scoping tenant context to the transaction lifecycle (
                  <code>is_local = true</code>).
                </p>
                <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-mono text-[11px] text-sky-300">
{`BEGIN TRANSACTION;
SELECT set_config('app.current_tenant', 'tenant_darkit_k1', true);
-- RLS Policy enforced automatically by PostgreSQL engine:
-- USING (tenant_id = current_setting('app.current_tenant', true))
COMMIT; -- Context vanishes immediately upon commit`}
                </pre>
              </section>

              <section className="rounded-2xl border border-emerald-500/30 bg-slate-900/70 p-6">
                <span className="font-mono text-xs font-bold uppercase text-emerald-400">
                  Cloud7 • Edge Routing & Resilience
                </span>
                <h2 className="mt-1 text-lg font-black text-white">
                  API Gateway Circuit Breaker & Token Bucket Rate Limiter
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Protects downstream microservices from noisy-neighbor spikes and cascading aggregator timeouts.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(
                    [
                      "CLOSED",
                      "HALF_OPEN",
                      "OPEN",
                    ] as const
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() =>
                        void handleCircuitBreakerChange(
                          st,
                        )
                      }
                      className={`rounded-xl border px-4 py-2.5 font-mono text-xs font-bold transition ${
                        (settings?.circuitBreakerState ||
                          "CLOSED") === st
                          ? "border-emerald-500 bg-emerald-500 text-slate-950"
                          : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      Circuit: {st}
                    </button>
                  ))}
                </div>

                <p className="mt-3 font-mono text-xs text-slate-400">
                  Active Sliding-Window Rate Limit:{" "}
                  <strong className="text-white">
                    {settings?.rateLimitRps ??
                      250}{" "}
                    req/sec per tenant
                  </strong>
                </p>
              </section>
            </div>

            {/* Autonomous Specialist Agents Marketplace (wshobson/agents) */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-bold uppercase text-amber-400">
                    Autonomous Agent Integration (wshobson/agents)
                  </span>
                  <h2 className="mt-1 text-lg font-black text-white">
                    Active Specialist Engineering & FinOps Agents
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 font-mono text-xs font-bold text-emerald-300">
                  200+ Specialist Skills Ready
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {AUTONOMOUS_AGENTS.map((agt) => (
                  <div
                    key={agt.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-sky-400 font-bold">
                        {agt.name}
                      </span>
                      <span className="text-emerald-400">
                        ● {agt.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-white">
                      {agt.domain}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-400">
                      {agt.task}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Performance Hotspots */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h2 className="text-lg font-black text-white mb-4">
                Runtime Performance Hotspots & Scaling Roadmap
              </h2>
              <div className="grid gap-4 lg:grid-cols-3">
                {PERFORMANCE_HOTSPOTS.map(
                  (issue) => (
                    <div
                      key={issue.title}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-white">
                          {issue.title}
                        </h3>
                        <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                          {issue.severity}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">
                        {issue.detail}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        <strong className="text-sky-300">
                          Fix:
                        </strong>{" "}
                        {issue.fix}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
