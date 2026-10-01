"use client";

import { useState } from "react";

import OrderSimulationPanel from "@/components/OrderSimulationPanel";

import type { Order } from "@/lib/db";

export default function DeveloperPage() {
  const [
    lastInjectedOrder,
    setLastInjectedOrder,
  ] = useState<Order | null>(null);

  return (
    <main className="min-h-screen bg-gray-950 p-4 text-white md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">

        <header className="rounded-2xl border border-amber-900/60 bg-gray-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">

            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-amber-400">
                Developer Access
              </p>

              <h1 className="mt-2 font-mono text-2xl font-bold">
                DarKitOS Development Console
              </h1>

              <p className="mt-2 text-sm text-gray-400">
                Development tools for testing the
                canonical kitchen operations pipeline.
              </p>
            </div>

            <span className="rounded-full border border-amber-700/50 bg-amber-950/30 px-3 py-1 font-mono text-[10px] text-amber-300">
              DEV ONLY
            </span>
          </div>
        </header>

        <OrderSimulationPanel
          onInject={setLastInjectedOrder}
        />

        {lastInjectedOrder && (
          <section className="rounded-xl border border-emerald-900/60 bg-gray-900 p-5">

            <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-emerald-300">
              Last Injected Order
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-4 text-xs font-mono md:grid-cols-5">

              <div>
                <span className="text-gray-500">
                  ID
                </span>

                <div className="mt-1">
                  {lastInjectedOrder.id}
                </div>
              </div>

              <div>
                <span className="text-gray-500">
                  Brand
                </span>

                <div className="mt-1">
                  {lastInjectedOrder.brandId}
                </div>
              </div>

              <div>
                <span className="text-gray-500">
                  Kitchen
                </span>

                <div className="mt-1">
                  {lastInjectedOrder.kitchenId}
                </div>
              </div>

              <div>
                <span className="text-gray-500">
                  Status
                </span>

                <div className="mt-1">
                  {lastInjectedOrder.status}
                </div>
              </div>

              <div>
                <span className="text-gray-500">
                  Inventory
                </span>

                <div className="mt-1">
                  {lastInjectedOrder.inventoryDecision ??
                    "PENDING"}
                </div>
              </div>

            </div>
          </section>
        )}
      </div>
    </main>
  );
}
