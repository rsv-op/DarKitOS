"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import RealtimeSyncBadge from "@/components/RealtimeSyncBadge";
import { useRealtimeKitchenSync } from "@/hooks/useRealtimeKitchenSync";
import {
  BRANDS_DB,
  KITCHENS_DB,
  type Employee,
  type KitchenStation,
  type Order,
} from "@/lib/db";

const STATIONS: KitchenStation[] = [
  "Grill",
  "Fryer",
  "Assembly",
  "Cold Prep",
];

function formatTime(value?: string): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOrderAgeMins(value?: string): number {
  if (!value) return 0;
  const created = new Date(value).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - created) / 60000),
  );
}

export default function CookPage() {
  const [orders, setOrders] = useState<Order[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [depletionNotice, setDepletionNotice] =
    useState("");
  const [updatingOrderId, setUpdatingOrderId] =
    useState<string | null>(null);

  const [kitchenFilter, setKitchenFilter] =
    useState<string>("ALL");
  const [brandFilter, setBrandFilter] =
    useState<string>("ALL");
  const [stationFilter, setStationFilter] =
    useState<string>("ALL");
  const [currentEmployee, setCurrentEmployee] =
    useState<Employee | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.employee) return;
        setCurrentEmployee(data.employee as Employee);
      })
      .catch(() => {
        // ignore transient error
      });
    return () => {
      active = false;
    };
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/orders",
        {
          cache: "no-store",
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to load kitchen orders.",
        );
      }

      setOrders(
        Array.isArray(data.orders)
          ? data.orders
          : [],
      );
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load kitchen orders.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const realtimeSync = useRealtimeKitchenSync({
    organizationId: currentEmployee?.organizationId,
    kitchenId:
      currentEmployee?.role !== "OWNER" && currentEmployee?.kitchenId
        ? currentEmployee.kitchenId
        : kitchenFilter !== "ALL"
          ? kitchenFilter
          : null,
    onSync: loadOrders,
  });

  const activeOrders = useMemo(() => {
    return orders.filter((order) => {
      const statusOk =
        order.status === "PENDING" ||
        order.status === "PREPARING" ||
        order.status === "READY_FOR_PICKUP";
      if (!statusOk) return false;
      if (
        kitchenFilter !== "ALL" &&
        order.kitchenId !== kitchenFilter
      )
        return false;
      if (
        brandFilter !== "ALL" &&
        order.brandId !== brandFilter
      )
        return false;
      if (
        stationFilter !== "ALL" &&
        !order.items.some(
          (i) => i.station === stationFilter,
        )
      )
        return false;
      return true;
    });
  }, [
    orders,
    kitchenFilter,
    brandFilter,
    stationFilter,
  ]);

  const pendingOrders = activeOrders.filter(
    (o) => o.status === "PENDING",
  );
  const preparingOrders = activeOrders.filter(
    (o) => o.status === "PREPARING",
  );
  const readyOrders = activeOrders.filter(
    (o) => o.status === "READY_FOR_PICKUP",
  );

  async function updateOrder(
    orderId: string,
    action: "PREPARING" | "READY_FOR_PICKUP",
  ) {
    setUpdatingOrderId(orderId);
    setError("");
    setDepletionNotice("");

    try {
      const response = await fetch(
        "/api/orders",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            orderId,
            action,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to update order.",
        );
      }

      if (action === "PREPARING") {
        const depleted = Array.isArray(
          data.depletedItems,
        )
          ? data.depletedItems.join(", ")
          : "Recipe items";
        const alerts = Array.isArray(
          data.lowStockAlerts,
        )
          ? data.lowStockAlerts
          : [];
        setDepletionNotice(
          `Atomic Inventory Consumption Executed for ${orderId}: Depleted [${depleted}]${
            alerts.length > 0
              ? ` • Low-Stock Threshold Triggered: ${alerts.join(", ")}`
              : ""
          }.`,
        );
      } else {
        setDepletionNotice(
          `Order ${orderId} marked READY_FOR_PICKUP → routed to Dispatch Pass.`,
        );
      }

      await loadOrders();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update order.",
      );
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function renderOrderCard(order: Order) {
    const isUpdating =
      updatingOrderId === order.id;
    const hasWarnings = Boolean(
      order.inventoryWarnings?.length,
    );
    const isUnavailable = Boolean(
      order.inventoryUnavailable?.length,
    );
    const ageMins = getOrderAgeMins(
      order.receivedAt ?? order.createdAt,
    );
    const isUrgent =
      order.priority === "RUSH" ||
      order.priority === "VIP" ||
      ageMins >= 12;

    return (
      <article
        key={order.id}
        className={`rounded-2xl border p-4 shadow-lg transition-all ${
          isUrgent
            ? "border-amber-500/60 bg-slate-900/95 shadow-[0_0_20px_rgba(245,158,11,0.12)]"
            : "border-slate-800 bg-slate-900/80"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-mono text-lg font-black text-white">
                {order.id}
              </p>
              {order.priority &&
                order.priority !== "NORMAL" && (
                  <span className="rounded bg-red-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-red-300">
                    {order.priority}
                  </span>
                )}
            </div>
            <p className="text-xs font-semibold text-sky-400">
              {order.brandId} •{" "}
              <span className="text-slate-400">
                {order.kitchenId} •{" "}
                {order.channel}
              </span>
            </p>
          </div>

          <div className="text-right font-mono text-xs">
            <span
              className={`inline-block rounded-lg px-2 py-0.5 font-bold ${
                ageMins >= 15
                  ? "bg-red-500/20 text-red-300"
                  : ageMins >= 10
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-slate-800 text-slate-300"
              }`}
            >
              ⏱ {ageMins} min
            </span>
            <p className="mt-1 text-[10px] text-slate-500">
              In{" "}
              {formatTime(
                order.receivedAt ??
                  order.createdAt,
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {order.items.map((item, index) => (
            <div
              key={
                item.id ??
                item.menuItemId ??
                `${order.id}-${index}`
              }
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-white">
                  {item.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-sky-300">
                    {item.station}
                  </span>
                  <span className="font-mono text-base font-black text-emerald-400">
                    ×{item.quantity}
                  </span>
                </div>
              </div>
              {item.notes && (
                <p className="mt-1 font-mono text-[11px] text-amber-300">
                  Note: {item.notes}
                </p>
              )}
            </div>
          ))}
        </div>

        {hasWarnings && (
          <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
            <p className="font-mono font-bold uppercase">
              ⚠ Low Stock Alert on Station
            </p>
            <p className="mt-0.5">
              {order.inventoryWarnings?.join(
                ", ",
              )}
            </p>
          </div>
        )}

        {isUnavailable && (
          <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
            <p className="font-mono font-bold uppercase">
              ✕ Stock-Out Block
            </p>
            <p className="mt-0.5">
              Missing:{" "}
              {order.inventoryUnavailable?.join(
                ", ",
              )}
            </p>
          </div>
        )}

        <div className="mt-4">
          {order.status === "PENDING" && (
            <button
              type="button"
              disabled={
                isUpdating || isUnavailable
              }
              onClick={() =>
                void updateOrder(
                  order.id,
                  "PREPARING",
                )
              }
              className="w-full rounded-xl bg-sky-500 px-4 py-3.5 font-mono text-sm font-black uppercase tracking-wider text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUpdating
                ? "Starting prep…"
                : isUnavailable
                  ? "Inventory Unavailable"
                  : "Start preparing"}
            </button>
          )}

          {order.status === "PREPARING" && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() =>
                void updateOrder(
                  order.id,
                  "READY_FOR_PICKUP",
                )
              }
              className="w-full rounded-xl bg-emerald-500 px-4 py-3.5 font-mono text-sm font-black uppercase tracking-wider text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUpdating
                ? "Updating..."
                : "Mark ready for pickup"}
            </button>
          )}

          {order.status ===
            "READY_FOR_PICKUP" && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-mono text-xs font-bold text-emerald-300">
              <span>Waiting for courier pickup</span>
              <Link
                href="/dispatch"
                className="underline hover:text-white"
              >
                Handoff →
              </Link>
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <AppShell
      title="Kitchen Board"
      subtitle="See which meals need cooking, start preparing an order, and mark it ready for pickup."
      actions={
        <>
          <RealtimeSyncBadge
            connectionMode={realtimeSync.connectionMode}
            lastEventAt={realtimeSync.lastEventAt}
            topic={realtimeSync.topic}
          />

          <Link
            href="/dispatch"
            className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 font-mono text-xs font-bold text-emerald-300 hover:border-emerald-500/40"
          >
            Open Dispatch →
          </Link>

          <button
            type="button"
            onClick={() => void loadOrders()}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 font-mono text-xs font-bold text-white hover:bg-slate-700"
          >
            ↻ Sync Now
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* KDS Station & Kitchen Filter Bar */}
        <section className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-3">
          <label className="block">
            <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
              Kitchen Facility
            </span>
            <select
              value={kitchenFilter}
              onChange={(e) =>
                setKitchenFilter(e.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="ALL">
                All Kitchen Hubs
              </option>
              {KITCHENS_DB.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.id} • {k.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
              Virtual Brand
            </span>
            <select
              value={brandFilter}
              onChange={(e) =>
                setBrandFilter(e.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="ALL">
                All Virtual Brands
              </option>
              {BRANDS_DB.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
              Prep Station Filter
            </span>
            <select
              value={stationFilter}
              onChange={(e) =>
                setStationFilter(e.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="ALL">
                All Stations (Grill / Fryer /
                Assembly / Cold Prep)
              </option>
              {STATIONS.map((s) => (
                <option key={s} value={s}>
                  {s} Station
                </option>
              ))}
            </select>
          </label>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-300">
            ⚠ {error}
          </div>
        )}

        {depletionNotice && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-mono text-xs text-emerald-300">
            ✓ {depletionNotice}
          </div>
        )}

        {/* Queue Summary Counters */}
        <section className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="font-mono text-xs font-bold uppercase text-amber-300">
              1. Pending Queue
            </p>
            <p className="mt-1 text-3xl font-black text-white">
              {pendingOrders.length}
            </p>
            <p className="text-[11px] text-slate-400">
              Awaiting cook acceptance & stock depletion
            </p>
          </div>

          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4">
            <p className="font-mono text-xs font-bold uppercase text-sky-300">
              2. Preparing on Line
            </p>
            <p className="mt-1 text-3xl font-black text-white">
              {preparingOrders.length}
            </p>
            <p className="text-[11px] text-slate-400">
              Ingredients deducted from active ledger
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="font-mono text-xs font-bold uppercase text-emerald-300">
              3. Staged Ready
            </p>
            <p className="mt-1 text-3xl font-black text-white">
              {readyOrders.length}
            </p>
            <p className="text-[11px] text-slate-400">
              Ready for courier handoff at Dispatch
            </p>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center font-mono text-sm text-slate-400">
            Loading KDS tickets...
          </div>
        ) : activeOrders.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center">
            <p className="text-lg font-bold text-white">
              No active kitchen orders waiting for preparation
            </p>
            <p className="mt-1 text-xs text-slate-400">
              New tickets injected via webhooks or Order Injection will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <section>
              <div className="mb-3 flex items-center justify-between border-b border-amber-500/30 pb-2">
                <h2 className="font-mono text-sm font-black uppercase text-amber-300">
                  Pending Tickets
                </h2>
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-300">
                  {pendingOrders.length}
                </span>
              </div>
              <div className="space-y-4">
                {pendingOrders.map(
                  renderOrderCard,
                )}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between border-b border-sky-500/30 pb-2">
                <h2 className="font-mono text-sm font-black uppercase text-sky-300">
                  On Station (Preparing)
                </h2>
                <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-sky-300">
                  {preparingOrders.length}
                </span>
              </div>
              <div className="space-y-4">
                {preparingOrders.map(
                  renderOrderCard,
                )}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between border-b border-emerald-500/30 pb-2">
                <h2 className="font-mono text-sm font-black uppercase text-emerald-300">
                  Ready for Pickup
                </h2>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300">
                  {readyOrders.length}
                </span>
              </div>
              <div className="space-y-4">
                {readyOrders.map(renderOrderCard)}
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
