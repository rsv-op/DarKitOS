import Link from "next/link";
import GuideIcon from "@/components/GuideIcon";
import WelcomeHeader from "@/components/WelcomeHeader";
import { DEMO_ROLES, ORDER_WALKTHROUGH } from "@/lib/getting-started";

function OrderPreview() {
  return (
    <div className="relative rounded-[2rem] border border-cyan-200/10 bg-[#0d1825] p-4 shadow-2xl shadow-black/30 sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[linear-gradient(to_right,rgba(125,211,252,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(125,211,252,0.06)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <figure className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0a101a]">
        <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3.5 sm:px-5">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <GuideIcon name="list" className="h-4 w-4 text-cyan-300" />
            An order in DarKitOS
          </span>
          <span className="rounded-full bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-300">Illustration</span>
        </figcaption>
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/80 bg-slate-900/70 p-3.5">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan-300/10 text-cyan-200">
                <GuideIcon name="ticket" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Order #1042</p>
                <p className="mt-0.5 text-xs text-slate-300">1 × Chicken rice bowl</p>
              </div>
            </div>
            <span className="rounded-md bg-amber-400/10 px-2 py-1 text-xs font-medium text-amber-200">Preparing</span>
          </div>
          <ol aria-label="Example order stages" className="relative mt-4 space-y-1 before:absolute before:bottom-5 before:left-[1.125rem] before:top-5 before:w-px before:bg-slate-700">
            <li className="relative flex items-center justify-between gap-2 py-1">
              <span className="flex items-center gap-2.5 text-sm font-medium text-slate-200">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-300/30 bg-[#102720] text-emerald-300">
                  <GuideIcon name="check" className="h-4 w-4" />
                </span>
                Order received
              </span>
              <span className="text-right text-xs text-slate-400">Live Orders</span>
            </li>
            <li className="relative flex items-center justify-between gap-2 py-1">
              <span className="flex items-center gap-2.5 text-sm font-semibold text-cyan-100">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-cyan-300/40 bg-[#132633] text-cyan-200">
                  <GuideIcon name="cook" className="h-4 w-4" />
                </span>
                Cooking
              </span>
              <span className="text-right text-xs text-cyan-200">Kitchen Board</span>
            </li>
            <li className="relative flex items-center justify-between gap-2 py-1">
              <span className="flex items-center gap-2.5 text-sm font-medium text-slate-300">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-700 bg-[#101924] text-slate-400">
                  <GuideIcon name="truck" className="h-4 w-4" />
                </span>
                Courier pickup
              </span>
              <span className="text-right text-xs text-slate-400">Dispatch</span>
            </li>
          </ol>
        </div>
        <p className="border-t border-slate-800 bg-slate-900/[0.45] px-4 py-3 text-xs leading-5 text-slate-300 sm:px-5">
          The same ticket follows the order from screen to screen.
        </p>
      </figure>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 selection:bg-cyan-300/30 selection:text-white">
      <WelcomeHeader home />

      <main id="main-content" tabIndex={-1}>
        <section aria-labelledby="welcome-title" className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-14 pt-12 sm:px-8 sm:pb-16 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1.5 text-xs font-semibold tracking-wide text-cyan-200">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
              Cloud kitchen workspace
            </p>
            <h1 id="welcome-title" className="mt-5 max-w-2xl text-balance text-[clamp(2.45rem,5.7vw,4.4rem)] font-bold leading-[1.02] tracking-[-0.055em] text-white">
              From order to <span className="text-cyan-200">courier pickup.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              DarKitOS is a workspace for delivery-only kitchens. Your team can track orders, prepare meals, hand them to couriers, and monitor stock across food brands and kitchen locations.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/workspace" prefetch={false} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-cyan-200 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">
                Open demo workspace
                <GuideIcon name="arrow" className="h-4 w-4" />
              </Link>
              <a href="#how-it-works" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">
                See how it works
                <GuideIcon name="down" className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-3.5 text-sm leading-6 text-slate-400">Uses sample data. No real food orders are placed.</p>
          </div>
          <OrderPreview />
        </section>

        <section id="how-it-works" aria-labelledby="workflow-title" className="scroll-mt-5 border-y border-white/[0.08] bg-[#0c121d]">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-14">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">How it works</p>
            <h2 id="workflow-title" className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Follow one order through the kitchen</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Try these four steps in the demo. The screen names below match what you’ll see in the workspace.</p>
            <ol className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ORDER_WALKTHROUGH.map((step, index) => (
                <li key={step.href} className="rounded-2xl border border-slate-700/80 bg-[#0d1623] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2 text-cyan-200">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-300/10"><GuideIcon name={step.icon} /></span>
                    <span aria-hidden="true" className="font-mono text-xs font-medium text-slate-400">0{index + 1}</span>
                  </div>
                  <p className="mt-4 text-xs font-medium text-cyan-200">{step.screen}</p>
                  <h3 className="mt-1 text-base font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{step.detail}</p>
                </li>
              ))}
            </ol>
            <p className="mt-4 flex items-start gap-3 rounded-xl border border-slate-700/80 px-4 py-3.5 text-sm leading-6 text-slate-300">
              <GuideIcon name="box" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
              <span>Check ingredients used in <strong className="text-white">Inventory</strong>, then see how orders and prep times add up in <strong className="text-white">Analytics</strong>.</span>
            </p>
          </div>
        </section>

        <section id="demo-roles" aria-labelledby="roles-title" className="mx-auto max-w-6xl scroll-mt-5 px-5 py-12 sm:px-8 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Who it’s for</p>
              <h2 id="roles-title" className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">See the shift from any role</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">Choose a sample account to see what each team member does. Start as Owner to try all four steps.</p>
            </div>
            <Link href="/login#demo-roles" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/[0.07] px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">
              Choose a demo role
              <GuideIcon name="arrow" className="h-4 w-4" />
            </Link>
          </div>
          <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DEMO_ROLES.map((role) => (
              <li key={role.role} className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
                <h3 className="flex items-center gap-2.5 font-semibold text-white"><GuideIcon name={role.icon} className="h-5 w-5 text-cyan-200" />{role.label}</h3>
                <p className="mb-4 mt-2 text-sm leading-6 text-slate-300">{role.description}</p>
                <p className="mt-auto border-t border-slate-800 pt-3 text-xs text-slate-400">Starts in <span className="font-medium text-slate-200">{role.startsAt}</span></p>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm leading-6 text-slate-400">The demo is shared and may reset. Please don’t enter real customer or business information.</p>
        </section>
      </main>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-sm text-slate-400 sm:px-8">
          <span className="font-semibold text-slate-200">DarKitOS</span>
          <span>Operations software for delivery kitchens.</span>
        </div>
      </footer>
    </div>
  );
}
