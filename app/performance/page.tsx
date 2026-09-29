"use client";

import Link from "next/link";

const issues = [
  {
    title: "Linear lookups on every request",
    severity: "High",
    location: "app/api/orders/route.ts, app/api/inventory/route.ts, lib/db.ts",
    impact: "O(n) scans on employee and permission checks are repeated for every request, which scales poorly as data grows.",
    fix: "Replace arrays with Maps keyed by employeeCode / permissionId / inventory item ID to reduce lookups to O(1).",
  },
  {
    title: "Full array cloning on every state read and update",
    severity: "Medium",
    location: "lib/store.ts",
    impact: "Every getOrders(), getInventory(), and updateOrder() call clones the entire list instead of only the changed object.",
    fix: "Use structural sharing or clone only the item being updated; avoid full list duplication during each request.",
  },
  {
    title: "Redundant inventory evaluation",
    severity: "Medium",
    location: "app/api/orders/route.ts",
    impact: "The same inventory check is run twice before and inside order preparation, creating unnecessary CPU cycles.",
    fix: "Evaluate once and reuse the result in the preparation branch to avoid duplicate work.",
  },
  {
    title: "No pagination on orders",
    severity: "High",
    location: "app/api/orders/route.ts",
    impact: "GET /api/orders loads the full order list and filters in memory, which will become slow with large datasets.",
    fix: "Add limit/offset or cursor-based pagination for order queries and only fetch the relevant page.",
  },
  {
    title: "Full-state transaction snapshots",
    severity: "Medium",
    location: "lib/store.ts",
    impact: "transaction() clones the entire state every time a transactional change is attempted, even when only one order changes.",
    fix: "Keep immutable snapshots per order or track a minimal diff rather than duplicating the whole kitchen state.",
  },
  {
    title: "Repeated permission and route checks",
    severity: "Low",
    location: "app/api/inventory/route.ts, app/api/orders/route.ts",
    impact: "Permission results are recomputed multiple times for the same employee and route during request processing.",
    fix: "Memoize or precompute permission maps for a request to avoid redundant checks and string generation.",
  },
];

const recommendations = [
  "Replace array searches with Maps keyed by id or code.",
  "Move static transition metadata outside functions to avoid reallocation.",
  "Use pagination for order list APIs and avoid returning all records at once.",
  "Cache permission lookups and reuse computed inventory evaluations.",
  "Clone only changed objects instead of re-copying the entire store state.",
];

function SeverityBadge({ level }: { level: string }) {
  const tone =
    level === "High"
      ? "bg-red-100 text-red-700 ring-red-200"
      : level === "Medium"
        ? "bg-amber-100 text-amber-700 ring-amber-200"
        : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${tone}`}
    >
      {level}
    </span>
  );
}

export default function PerformancePage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                DarKitOS
              </p>
              <h1 className="mt-2 text-3xl font-black text-slate-900">
                Performance Review
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                A focused review of the main scalability and runtime bottlenecks in the current implementation.
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/owner"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
              >
                Owner Dashboard
              </Link>
              <Link
                href="/cook"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
              >
                Cook View
              </Link>
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Highest risk
            </p>
            <p className="mt-3 text-3xl font-black text-red-600">5</p>
            <p className="mt-2 text-sm text-slate-600">Issues with direct runtime cost or scaling risk.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Main bottleneck
            </p>
            <p className="mt-3 text-2xl font-black text-slate-900">Repeated scans</p>
            <p className="mt-2 text-sm text-slate-600">Array finds and filters are executed repeatedly across requests.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Recommended action
            </p>
            <p className="mt-3 text-2xl font-black text-slate-900">Map + paginate</p>
            <p className="mt-2 text-sm text-slate-600">Use indexed lookups and limit returned order payloads.</p>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-black text-slate-900">Priority findings</h2>
          <div className="space-y-4">
            {issues.map((issue) => (
              <article
                key={issue.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{issue.title}</h3>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                      {issue.location}
                    </p>
                  </div>
                  <SeverityBadge level={issue.severity} />
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-700">{issue.impact}</p>

                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Fix strategy
                  </p>
                  <p className="mt-2 text-sm text-slate-700">{issue.fix}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-black text-slate-900">Recommended optimization plan</h2>
            <ol className="space-y-3">
              {recommendations.map((item, index) => (
                <li key={item} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6 text-slate-700">{item}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-black text-slate-900">Performance summary</h2>
            <div className="space-y-3 text-sm text-slate-700">
              <div className="rounded-xl bg-red-50 p-3 ring-1 ring-red-100">
                <p className="font-bold text-red-700">Biggest issue</p>
                <p className="mt-1">Repeated linear search patterns across employee, permission, and inventory logic.</p>
              </div>

              <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-100">
                <p className="font-bold text-amber-700">Scaling concern</p>
                <p className="mt-1">Order APIs return full state and operate on all rows without pagination or indexed access.</p>
              </div>

              <div className="rounded-xl bg-slate-100 p-3 ring-1 ring-slate-200">
                <p className="font-bold text-slate-700">Best immediate win</p>
                <p className="mt-1">Introduce Maps for lookup-heavy paths and limit the payload size in list endpoints.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
