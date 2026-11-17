"use client";

import { useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import OrderSimulationPanel from "@/components/OrderSimulationPanel";
import type { Order } from "@/lib/db";

export default function OrderInjectionPage() {
  const [lastInjectedOrder, setLastInjectedOrder] =
    useState<Order | null>(null);

  return (
    <AppShell
      title="Order Injection & Webhook Idempotency Simulator"
      subtitle="Inject canonical multi-brand orders, validate BrandKitchen constraints, and test two-phase atomic webhook deduplication."
      actions={
        <>
          <Link
            href="/live-orders"
            className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 font-mono text-xs font-bold text-slate-200 hover:border-sky-500/40 hover:text-sky-300"
          >
            View Live Orders →
          </Link>
          <Link
            href="/kds"
            className="rounded-xl bg-sky-500 px-3.5 py-2 font-mono text-xs font-bold text-slate-950 hover:bg-sky-400"
          >
            Open Cook KDS →
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <OrderSimulationPanel
          onInject={setLastInjectedOrder}
        />

        {lastInjectedOrder && (
          <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Last Injected Canonical Order
                </span>
                <h3 className="mt-1 font-mono text-lg font-bold text-white">
                  {lastInjectedOrder.id} •{" "}
                  {lastInjectedOrder.brandId} @{" "}
                  {lastInjectedOrder.kitchenId}
                </h3>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/kds"
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 font-mono text-xs font-bold text-slate-950"
                >
                  Process on Cook KDS →
                </Link>
                <Link
                  href="/live-orders"
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-xs font-bold text-slate-200"
                >
                  Inspect Timeline
                </Link>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 font-mono text-xs md:grid-cols-6">
              <div>
                <span className="text-slate-400">
                  Order ID
                </span>
                <div className="mt-1 font-bold text-white">
                  {lastInjectedOrder.id}
                </div>
              </div>
              <div>
                <span className="text-slate-400">
                  Brand
                </span>
                <div className="mt-1 font-bold text-white">
                  {lastInjectedOrder.brandId}
                </div>
              </div>
              <div>
                <span className="text-slate-400">
                  Kitchen
                </span>
                <div className="mt-1 font-bold text-white">
                  {lastInjectedOrder.kitchenId}
                </div>
              </div>
              <div>
                <span className="text-slate-400">
                  Channel
                </span>
                <div className="mt-1 font-bold text-white">
                  {lastInjectedOrder.channel}
                </div>
              </div>
              <div>
                <span className="text-slate-400">
                  Status
                </span>
                <div className="mt-1 font-bold text-amber-300">
                  {lastInjectedOrder.status}
                </div>
              </div>
              <div>
                <span className="text-slate-400">
                  Inventory Check
                </span>
                <div className="mt-1 font-bold text-emerald-300">
                  {lastInjectedOrder.inventoryDecision ??
                    "AVAILABLE"}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
