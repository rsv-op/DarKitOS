"use client";

import Link from "next/link";

const metrics = [
  { label: "Total Orders", value: 128, tone: "slate" },
  { label: "Avg Prep", value: "18.4m", tone: "blue" },
  { label: "Low Stock", value: 9, tone: "amber" },
  { label: "Unavailable", value: 3, tone: "red" },
  { label: "Throughput", value: "91%", tone: "emerald" },
  { label: "Risk Index", value: "7.4/10", tone: "violet" },
];

const issueCards = [
  {
    title: "Array scans on every request",
    severity: "High",
    detail: "Employee lookups, permission checks, and inventory matching all use repeated array scans across the request lifecycle.",
    impact: "As order volumes increase, request latency grows with each O(n) lookup.",
    fix: "Use Maps keyed by id / code to make these lookups constant-time.",
    color: "red",
  },
  {
    title: "Store clones are too broad",
    severity: "Medium",
    detail: "The store clones entire arrays and nested structures on reads and updates instead of only the changed object.",
    impact: "This causes unnecessary allocation churn and extra GC pressure.",
    fix: "Adopt shallow clone-on-write or mutate only the changed order/inventory item.",
    color: "amber",
  },
  {
    title: "Orders API returns everything",
    severity: "High",
    detail: "GET /api/orders sends the full dataset and filters it client-side in memory.",
    impact: "This creates long network payloads and slower UI rendering as the store grows.",
    fix: "Add cursor-based pagination and apply filtering on the server before returning results.",
    color: "red",
  },
  {
    title: "Inventory checks are duplicated",
    severity: "Medium",
    detail: "The same order inventory validation is performed before and during preparation transitions.",
    impact: "This multiplies CPU work without adding correctness gains.",
    fix: "Compute the evaluation once and pass it through the transition pipeline.",
    color: "amber",
  },
  {
    title: "Static transition tables are rebuilt",
    severity: "Low",
    detail: "The valid status transition table is recreated for every call instead of existing once at module scope.",
    impact: "This is a small overhead, but it adds unnecessary allocation in hot paths.",
    fix: "Move the transitions map to a top-level constant.",
    color: "slate",
  },
];

const roadmap = [
  "Replace array-based lookups with Maps for employees, permissions, and inventory IDs.",
  "Introduce pagination and server-side filters for order queries.",
  "Cache inventory evaluation results within a single request lifecycle.",
  "Limit store cloning to the updated item instead of wholesale array duplication.",
  "Keep transition metadata at module scope to remove repeated object creation.",
];

function ToneBadge({ tone }: { tone: string }) {
  const palette: Record<string, string> = {
    red: "bg-red-100 text-red-700 ring-red-200",
    amber: "bg-amber-100 text-amber-700 ring-amber-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    blue: "bg-blue-100 text-blue-700 ring-blue-200",
    emerald: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    violet: "bg-violet-100 text-violet-700 ring-violet-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ring-1 ${palette[tone] ?? palette.slate}`}
    >
      {tone}
    </span>
  );
}

export default function PerformanceDashboardPage() {
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
                Performance Dashboard
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                A practical view of where the app is likely to slow down as live kitchen traffic increases.
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/owner"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
              >
                Owner
              </Link>
              <Link
                href="/performance"
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm"
              >
                Review
              </Link>
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  {metric.label}
                </p>
                <ToneBadge tone={metric.tone} />
              </div>
              <p className="mt-3 text-2xl font-black text-slate-900">{metric.value}</p>
            </div>
          ))}
        </section>

        <section className="mb-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black text-slate-900">Hotspots</h2>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">
                Live risk
              </span>
            </div>

            <div className="space-y-4">
              {issueCards.map((issue) => (
                <div
                  key={issue.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-slate-900">{issue.title}</h3>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${
                        issue.severity === "High"
                          ? "bg-red-100 text-red-700"
                          : issue.severity === "Medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {issue.severity}
                    </span>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-700">{issue.detail}</p>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                      Why it matters
                    </p>
                    <p className="mt-2 text-sm text-slate-700">{issue.impact}</p>
                  </div>

                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                      Fix
                    </p>
                    <p className="mt-2 text-sm text-slate-700">{issue.fix}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">Priority order</h2>
              <ol className="mt-4 space-y-3">
                {[
                  "Indexed lookups",
                  "Server-side pagination",
                  "Single-pass inventory evaluation",
                  "Limited store cloning",
                  "Hot-path constant reuse",
                ].map((step, index) => (
                  <li key={step} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-700">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">Execution plan</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                {roadmap.map((item) => (
                  <li key={item} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                    <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-slate-900" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
