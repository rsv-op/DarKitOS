"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import OrderSimulationPanel from "@/components/OrderSimulationPanel";
import type { InventoryItem, Order } from "@/lib/db";

type OrdersApiResponse = {
  success: boolean;
  orders: Order[];
  inventory: InventoryItem[];
  error?: string;
};

const STATUS_LABELS: Record<Order["status"], string> = {
  PENDING: "Pending",
  PREPARING: "Preparing",
  READY_FOR_PICKUP: "Ready",
  DRIVER_ASSIGNED: "Driver Assigned",
  PICKED_UP: "Picked Up",
  DISPATCHED: "Dispatched",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<Order["status"], string> = {
  PENDING: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  PREPARING: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  READY_FOR_PICKUP: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  DRIVER_ASSIGNED: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  PICKED_UP: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  DISPATCHED: "bg-green-500/15 text-green-300 border-green-500/30",
  CANCELLED: "bg-red-500/15 text-red-300 border-red-500/30",
};

function formatTime(value?: string) {
  if (!value) return "—";

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function HomePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshSystem = useCallback(async () => {
    try {
      const response = await fetch("/api/orders", {
        cache: "no-store",
      });

      const data = (await response.json()) as OrdersApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load system state");
      }

      setOrders(data.orders || []);
      setInventory(data.inventory || []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load system state"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSystem();

    const interval = window.setInterval(() => {
      void refreshSystem();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [refreshSystem]);

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status !== "DISPATCHED" && order.status !== "CANCELLED"
      ),
    [orders]
  );

  const lowStockItems = useMemo(
    () =>
      inventory.filter(
        (item) => item.currentStock <= item.reorderThreshold
      ),
    [inventory]
  );

  const criticalStockItems = useMemo(
    () => inventory.filter((item) => item.currentStock <= 0),
    [inventory]
  );

  const latestOrders = useMemo(() => orders.slice(0, 8), [orders]);

  function handleInjectedOrder(order: Order) {
    setOrders((current) => [
      order,
      ...current.filter((existing) => existing.id !== order.id),
    ]);

    void refreshSystem();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-green-300">
                  Dark Cloud Kitchen OS
                </span>
              </div>

              <h1 className="text-2xl font-bold sm:text-3xl">
                System Control Console
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Controlled development console for testing the complete kitchen
                workflow from order ingestion through dispatch.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/cook"
                className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20"
              >
                Cook KDS
              </Link>

              <Link
                href="/dispatch"
                className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-300 transition hover:bg-purple-500/20"
              >
                Dispatch
              </Link>

              <Link
                href="/owner"
                className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
              >
                Owner Analytics
              </Link>
            </div>
          </div>
        </header>

        {/* System state */}
        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              System
            </p>
            <p className="mt-2 text-lg font-bold text-green-300">LIVE</p>
            <p className="mt-1 text-xs text-slate-500">
              Shared application store
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Active Orders
            </p>
            <p className="mt-2 text-2xl font-bold">{activeOrders.length}</p>
            <p className="mt-1 text-xs text-slate-500">
              Awaiting completion
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Total Orders
            </p>
            <p className="mt-2 text-2xl font-bold">{orders.length}</p>
            <p className="mt-1 text-xs text-slate-500">
              Current runtime state
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Low Stock
            </p>
            <p className="mt-2 text-2xl font-bold text-yellow-300">
              {lowStockItems.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              At or below threshold
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Critical Stock
            </p>
            <p className="mt-2 text-2xl font-bold text-red-300">
              {criticalStockItems.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Zero or negative stock
            </p>
          </div>
        </section>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            <strong>System error:</strong> {error}
          </div>
        )}

        {/* Manual order simulator */}
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
          <div className="mb-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  Manual Order Injection
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Simulate an order arriving from an external channel without
                  connecting a live aggregator.
                </p>
              </div>

              <span className="w-fit rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">
                TEST SOURCE
              </span>
            </div>
          </div>

          <OrderSimulationPanel onInject={handleInjectedOrder} />
        </section>

        {/* Operational workflow */}
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-5">
            <h2 className="text-lg font-bold">Closed-Loop Workflow</h2>
            <p className="mt-1 text-sm text-slate-400">
              The intended MVP path through the operational system.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              ["01", "Inject Order", "System Console"],
              ["02", "Inventory Check", "Orders API"],
              ["03", "Prepare", "Cook KDS"],
              ["04", "Ready", "Cook KDS"],
              ["05", "Driver / Pickup", "Dispatch"],
              ["06", "Dispatch", "Dispatch"],
            ].map(([number, title, owner]) => (
              <div
                key={number}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4"
              >
                <p className="text-xs font-bold text-slate-600">{number}</p>
                <p className="mt-2 font-semibold">{title}</p>
                <p className="mt-1 text-xs text-slate-500">{owner}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Live order monitor */}
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Live Order Monitor</h2>
              <p className="mt-1 text-sm text-slate-400">
                Read-only view of the canonical order state.
              </p>
            </div>

            <span className="text-xs text-slate-500">
              Auto-refresh: 3 seconds
            </span>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-500">
              Loading system state...
            </div>
          ) : latestOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center">
              <p className="font-medium text-slate-300">
                No orders in the runtime store.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Use Manual Order Injection above to start the workflow.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {latestOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-white">
                          {order.id}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            STATUS_STYLES[order.status]
                          }`}
                        >
                          {STATUS_LABELS[order.status]}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>Brand: {order.brandId}</span>
                        <span>Kitchen: {order.kitchenId}</span>
                        <span>Channel: {order.channel}</span>
                        <span>Items: {order.items.length}</span>
                        <span>Events: {order.events.length}</span>
                      </div>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-xs uppercase tracking-wider text-slate-600">
                        Received
                      </p>
                      <p className="mt-1 font-mono text-sm text-slate-300">
                        {formatTime(order.receivedAt || order.createdAt)}
                      </p>
                    </div>
                  </div>

                  {order.inventoryWarnings &&
                    order.inventoryWarnings.length > 0 && (
                      <div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-300">
                        <span className="font-semibold">
                          Inventory warning:
                        </span>{" "}
                        {order.inventoryWarnings.join(", ")}
                      </div>
                    )}

                  {order.inventoryUnavailable &&
                    order.inventoryUnavailable.length > 0 && (
                      <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">
                        <span className="font-semibold">
                          Inventory unavailable:
                        </span>{" "}
                        {order.inventoryUnavailable.join(", ")}
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Inventory monitor */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-5">
            <h2 className="text-lg font-bold">Inventory Snapshot</h2>
            <p className="mt-1 text-sm text-slate-400">
              Current shared inventory state used by the order engine.
            </p>
          </div>

          {inventory.length === 0 ? (
            <p className="text-sm text-slate-500">
              Inventory is unavailable.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {inventory.map((item) => {
                const isCritical = item.currentStock <= 0;
                const isLow = item.currentStock <= item.reorderThreshold;

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {item.name}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-slate-600">
                          {item.sku}
                        </p>
                      </div>

                      {isCritical ? (
                        <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-300">
                          CRITICAL
                        </span>
                      ) : isLow ? (
                        <span className="rounded-full bg-yellow-500/10 px-2 py-1 text-[10px] font-bold text-yellow-300">
                          LOW
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-500/10 px-2 py-1 text-[10px] font-bold text-green-300">
                          OK
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-slate-600">Current</p>
                        <p className="mt-1 text-xl font-bold">
                          {item.currentStock}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-slate-600">Threshold</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {item.reorderThreshold}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <footer className="mt-6 border-t border-slate-900 pt-4 text-center text-xs text-slate-600">
          Dark Cloud Kitchen OS · MVP Control Console · K1 · In-memory
          persistence
        </footer>
      </div>
    </main>
  );
}
