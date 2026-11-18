import Link from "next/link";
import GuideIcon from "@/components/GuideIcon";
import { ORDER_WALKTHROUGH } from "@/lib/getting-started";

export default function WorkspaceQuickStart() {
  return (
    <section aria-labelledby="quick-start-title" className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.06] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Quick start · Sample data</p>
          <h2 id="quick-start-title" className="mt-1 text-xl font-bold tracking-tight text-white">Try one order from start to pickup</h2>
          <p className="mt-1 text-sm leading-6 text-slate-300">Create a sample order, then use the same order number at each step.</p>
        </div>
        <Link href="/" className="rounded text-sm font-semibold text-cyan-200 hover:underline focus-visible:outline focus-visible:outline-offset-4 focus-visible:outline-cyan-300">Product guide</Link>
      </div>
      <ol className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {ORDER_WALKTHROUGH.map((step, index) => (
          <li key={step.href}>
            <Link
              href={step.href}
              className="group flex h-full items-start gap-2.5 rounded-xl border border-slate-700 bg-slate-950/70 p-3 transition hover:border-cyan-300/45 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-cyan-300/10 font-mono text-xs font-bold text-cyan-200">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-1.5 text-sm font-semibold leading-6 text-white">
                  {step.title}
                  <GuideIcon name="arrow" className="h-4 w-4 shrink-0 text-cyan-200 transition group-hover:translate-x-0.5" />
                </span>
                <span className="block text-xs leading-5 text-slate-300">{step.screen} · {step.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs leading-5 text-slate-300">
        After prep, check <Link href="/inventory" className="rounded font-semibold text-cyan-200 underline underline-offset-2 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Inventory</Link> for ingredients used and <Link href="/analytics" className="rounded font-semibold text-cyan-200 underline underline-offset-2 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Analytics</Link> for order summaries.
      </p>
    </section>
  );
}
