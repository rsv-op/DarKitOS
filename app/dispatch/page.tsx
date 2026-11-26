"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import KitchenSlaBadge from "@/components/KitchenSlaBadge";
import RealtimeSyncBadge from "@/components/RealtimeSyncBadge";
import { useKitchenAudioAlerts } from "@/hooks/useKitchenAudioAlerts";
import { useRealtimeKitchenSync } from "@/hooks/useRealtimeKitchenSync";
import { formatCurrency, type SupportedCurrency } from "@/lib/currency";
import {
  KITCHENS_DB,
  type Employee,
  type Order,
  type PermissionCode,
} from "@/lib/db";

const COURIER_PRESETS = [
  "Deepak Yadav",
  "Suresh Solanki",
  "Manoj Tiwari",
  "Rahul Deshmukh",
  "Imran Qureshi",
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

function getOrderAge(value?: string): string {
  if (!value) return "--";
  const created = new Date(value).getTime();
  if (Number.isNaN(created)) return "--";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - created) / 60000),
  );
  return `${minutes} min`;
}

export default function DispatchPage() {
  const [orders, setOrders] = useState<Order[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingOrderId, setUpdatingOrderId] =
    useState<string | null>(null);
  const [kitchenFilter, setKitchenFilter] =
    useState<string>("ALL");
  const [canCancelOrders, setCanCancelOrders] =
    useState<boolean>(false);
  const [currency, setCurrency] =
    useState<SupportedCurrency>("INR");
  const [dispatchSlaMinutes, setDispatchSlaMinutes] =
    useState<number>(8);
  const [currentEmployee, setCurrentEmployee] =
    useState<Employee | null>(null);

  const audio = useKitchenAudioAlerts();
  const seenReadyIdsRef = useRef<Set<string> | null>(null);

  // Inline driver assignment state per order
  const [driverInputs, setDriverInputs] =
    useState<Record<string, string>>({});
  const [etaInputs, setEtaInputs] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const perms = (data.permissions || []) as PermissionCode[];
        setCanCancelOrders(
          perms.includes("ORDER_CANCEL") || perms.includes("OWNER_VIEW"),
        );
        if (data.settings?.currency) {
          setCurrency(data.settings.currency);
        }
        if (typeof data.settings?.dispatchSlaMinutes === "number") {
          setDispatchSlaMinutes(data.settings.dispatchSlaMinutes);
        }
        if (data.employee) {
          setCurrentEmployee(data.employee as Employee);
        }
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
            "Unable to load dispatch orders.",
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
          : "Unable to load dispatch orders.",
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

  const scopedOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        kitchenFilter === "ALL" ||
        o.kitchenId === kitchenFilter,
    );
  }, [orders, kitchenFilter]);

  const readyOrders = useMemo(
    () =>
      scopedOrders.filter(
        (order) =>
          order.status ===
            "READY_FOR_PICKUP" ||
          order.status ===
            "DRIVER_ASSIGNED" ||
          order.status === "PICKED_UP",
      ),
    [scopedOrders],
  );

  const readyForPickup = readyOrders.filter(
    (o) => o.status === "READY_FOR_PICKUP",
  );
  const driverAssigned = readyOrders.filter(
    (o) => o.status === "DRIVER_ASSIGNED",
  );
  const pickedUp = readyOrders.filter(
    (o) => o.status === "PICKED_UP",
  );

  useEffect(() => {
    if (loading) return;
    const currentIds = new Set(readyForPickup.map((o) => o.id));
    if (seenReadyIdsRef.current === null) {
      seenReadyIdsRef.current = currentIds;
      return;
    }
    for (const id of currentIds) {
      if (!seenReadyIdsRef.current.has(id)) {
        audio.playNewOrderChime(id);
      }
    }
    seenReadyIdsRef.current = currentIds;
  }, [loading, readyForPickup, audio]);
  const recentlyDispatched = useMemo(
    () =>
      scopedOrders
        .filter(
          (o) => o.status === "DISPATCHED",
        )
        .slice(0, 6),
    [scopedOrders],
  );

  async function updateOrder(
    orderId: string,
    action:
      | "DRIVER_ASSIGNED"
      | "PICKED_UP"
      | "DISPATCHED"
      | "CANCELLED",
    driverName?: string,
    courierEtaMins?: number,
    cancellationReason?: string,
  ) {
    setUpdatingOrderId(orderId);
    setError("");
    setNotice("");

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
            ...(driverName
              ? { driverName }
              : {}),
            ...(typeof courierEtaMins ===
            "number"
              ? { courierEtaMins }
              : {}),
            ...(cancellationReason
              ? {
                  cancellationSource:
                    "AGGREGATOR",
                  cancellationReason,
                }
              : {}),
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

      if (action === "CANCELLED") {
        setNotice(
          `Post-Pickup Cancellation Logged for ${orderId}: Aggregator Accounting Claim (${formatCurrency(data.cancellationRecord?.claimAmount ?? 0, currency)}) created with preserved courier evidence.`,
        );
      } else {
        setNotice(
          `Order ${orderId} transitioned to ${action.replaceAll("_", " ")}.`,
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
    const selectedDriver =
      driverInputs[order.id] ??
      COURIER_PRESETS[0];
    const selectedEta =
      etaInputs[order.id] ?? 8;

    return (
      <article
        key={order.id}
        className="rounded-2xl border border-slate-800 bg-slate-900/85 p-4 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-lg font-black text-white">
              {order.id}
            </p>
            <p className="text-xs font-semibold text-sky-400">
              {order.brandId} •{" "}
              <span className="text-slate-400">
                {order.kitchenId} •{" "}
                {order.channel}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Customer:{" "}
              {order.customerName || "Guest"}
            </p>
          </div>

          <div className="text-right font-mono text-xs text-slate-400">
            <div className="mb-1 flex justify-end">
              <KitchenSlaBadge
                orderId={order.id}
                anchorIso={order.readyAt ?? order.createdAt}
                slaMinutes={dispatchSlaMinutes}
                labelPrefix="Dispatch SLA"
                onBreach={audio.playSlaBreachAlert}
              />
            </div>
            <p>
              Ready{" "}
              <strong className="text-emerald-400">
                {formatTime(order.readyAt)}
              </strong>
            </p>
            <p>
              Age{" "}
              {getOrderAge(
                order.receivedAt ??
                  order.createdAt,
              )}
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          {order.items.map((item, index) => (
            <div
              key={
                item.id ??
                item.menuItemId ??
                `${order.id}-${index}`
              }
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs"
            >
              <span className="font-medium text-slate-200">
                {item.name}
              </span>
              <span className="font-mono font-bold text-emerald-400">
                ×{item.quantity}
              </span>
            </div>
          ))}
        </div>

        {order.status ===
          "READY_FOR_PICKUP" && (
          <div className="mt-4 space-y-2.5 border-t border-slate-800 pt-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block font-mono text-[10px] uppercase text-slate-400">
                  Assign Courier
                </label>
                <input
                  type="text"
                  value={selectedDriver}
                  onChange={(e) =>
                    setDriverInputs((prev) => ({
                      ...prev,
                      [order.id]:
                        e.target.value,
                    }))
                  }
                  list={`couriers-${order.id}`}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white"
                />
                <datalist
                  id={`couriers-${order.id}`}
                >
                  {COURIER_PRESETS.map((c) => (
                    <option
                      key={c}
                      value={c}
                    />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-400">
                  ETA (min)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={selectedEta}
                  onChange={(e) =>
                    setEtaInputs((prev) => ({
                      ...prev,
                      [order.id]: Math.max(
                        0,
                        Number(e.target.value) ||
                          0,
                      ),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 font-mono text-xs text-white"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={
                isUpdating ||
                !selectedDriver.trim()
              }
              onClick={() =>
                void updateOrder(
                  order.id,
                  "DRIVER_ASSIGNED",
                  selectedDriver.trim(),
                  selectedEta,
                )
              }
              className="w-full rounded-xl bg-sky-500 px-4 py-3 font-mono text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-sky-400 disabled:opacity-40"
            >
              {isUpdating
                ? "Assigning..."
                : "✦ ASSIGN DRIVER"}
            </button>
          </div>
        )}

        {order.status ===
          "DRIVER_ASSIGNED" && (
          <div className="mt-4 space-y-3 border-t border-slate-800 pt-3">
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-xs">
              <p className="font-mono text-[10px] uppercase text-purple-300">
                Assigned Courier
              </p>
              <p className="mt-0.5 font-bold text-white">
                {order.driverName ?? "--"} • ETA:{" "}
                {typeof order.courierEtaMins ===
                "number"
                  ? `${order.courierEtaMins} min`
                  : "--"}
              </p>
            </div>

            <button
              type="button"
              disabled={isUpdating}
              onClick={() =>
                void updateOrder(
                  order.id,
                  "PICKED_UP",
                )
              }
              className="w-full rounded-xl bg-amber-500 px-4 py-3 font-mono text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-amber-400 disabled:opacity-40"
            >
              {isUpdating
                ? "Updating..."
                : "📦 MARK PICKED UP BY COURIER"}
            </button>
          </div>
        )}

        {order.status === "PICKED_UP" && (
          <div className="mt-4 space-y-2.5 border-t border-slate-800 pt-3">
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-200">
              <p className="font-bold">
                In Courier Custody:{" "}
                {order.driverName ?? "--"}
              </p>
              <p className="mt-0.5 font-mono text-[10px]">
                Picked up at{" "}
                {formatTime(order.pickedUpAt)}
              </p>
            </div>

            <button
              type="button"
              disabled={isUpdating}
              onClick={() =>
                void updateOrder(
                  order.id,
                  "DISPATCHED",
                )
              }
              className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-mono text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
            >
              {isUpdating
                ? "Finalizing..."
                : "✓ MARK DISPATCHED (COMPLETE)"}
            </button>

            {canCancelOrders && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() =>
                  void updateOrder(
                    order.id,
                    "CANCELLED",
                    undefined,
                    undefined,
                    "Post-pickup aggregator cancellation -> logged for accounting claim reconciliation",
                  )
                }
                className="w-full rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 font-mono text-[10px] font-bold uppercase text-red-300 hover:bg-red-500/20"
              >
                ⚠ Post-Pickup Cancel (Aggregator Claim)
              </button>
            )}
          </div>
        )}
      </article>
    );
  }

  return (
    <AppShell
      title="Dispatch"
      subtitle="Assign a driver to a ready order, confirm pickup, and record the handoff."
      actions={
        <>
          <RealtimeSyncBadge
            connectionMode={realtimeSync.connectionMode}
            lastEventAt={realtimeSync.lastEventAt}
            topic={realtimeSync.topic}
          />

          <button
            type="button"
            onClick={audio.toggleAudio}
            className={`rounded-xl border px-3 py-2 font-mono text-xs font-bold transition ${
              audio.audioEnabled
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                : "border-slate-700 bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            {audio.audioEnabled ? "🔔 Audio Chimes: ON" : "🔕 Audio Chimes: OFF"}
          </button>

          <select
            value={kitchenFilter}
            onChange={(e) =>
              setKitchenFilter(e.target.value)
            }
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white"
          >
            <option value="ALL">
              All Kitchens
            </option>
            {KITCHENS_DB.map((k) => (
              <option key={k.id} value={k.id}>
                {k.id} • {k.name}
              </option>
            ))}
          </select>

          <Link
            href="/kds"
            className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 font-mono text-xs font-bold text-sky-300"
          >
            ← Cook KDS
          </Link>

          <button
            type="button"
            onClick={() => void loadOrders()}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 font-mono text-xs font-bold text-white hover:bg-slate-700"
          >
            ↻ Refresh
          </button>
        </>
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

        <section className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="font-mono text-xs font-bold uppercase text-emerald-300">
              1. Ready for Pickup
            </p>
            <p className="mt-1 text-3xl font-black text-white">
              {readyForPickup.length}
            </p>
          </div>
          <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4">
            <p className="font-mono text-xs font-bold uppercase text-purple-300">
              2. Driver Assigned
            </p>
            <p className="mt-1 text-3xl font-black text-white">
              {driverAssigned.length}
            </p>
          </div>
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4">
            <p className="font-mono text-xs font-bold uppercase text-indigo-300">
              3. Picked Up
            </p>
            <p className="mt-1 text-3xl font-black text-white">
              {pickedUp.length}
            </p>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center font-mono text-sm text-slate-400">
            Loading dispatch queues...
          </div>
        ) : readyOrders.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center">
            <p className="text-lg font-bold text-white">
              No active orders waiting at Dispatch Pass
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Orders marked READY_FOR_PICKUP on the Cook KDS will appear here immediately.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <section>
              <div className="mb-3 flex items-center justify-between border-b border-emerald-500/30 pb-2">
                <h2 className="font-mono text-sm font-black uppercase text-emerald-300">
                  Ready for Pickup
                </h2>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300">
                  {readyForPickup.length}
                </span>
              </div>
              <div className="space-y-4">
                {readyForPickup.map(
                  renderOrderCard,
                )}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between border-b border-purple-500/30 pb-2">
                <h2 className="font-mono text-sm font-black uppercase text-purple-300">
                  Driver Assigned
                </h2>
                <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-purple-300">
                  {driverAssigned.length}
                </span>
              </div>
              <div className="space-y-4">
                {driverAssigned.map(
                  renderOrderCard,
                )}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between border-b border-indigo-500/30 pb-2">
                <h2 className="font-mono text-sm font-black uppercase text-indigo-300">
                  Picked Up
                </h2>
                <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-300">
                  {pickedUp.length}
                </span>
              </div>
              <div className="space-y-4">
                {pickedUp.map(renderOrderCard)}
              </div>
            </section>
          </div>
        )}

        {/* Recently Dispatched Evidence Ledger */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-teal-400 mb-3">
            Completed Dispatch Evidence Ledger (Post-Pickup Reconciliation Proof)
          </h2>
          {recentlyDispatched.length === 0 ? (
            <p className="text-xs text-slate-500">
              No completed dispatches recorded yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentlyDispatched.map((o) => (
                <div
                  key={o.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white">
                      {o.id} ({o.brandId})
                    </span>
                    <span className="rounded bg-teal-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-teal-300">
                      DISPATCHED
                    </span>
                  </div>
                  <p className="mt-1 text-slate-400">
                    Courier:{" "}
                    <strong className="text-slate-200">
                      {o.driverName || "Verified"}
                    </strong>{" "}
                    • {o.channel}
                  </p>
                  <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-500">
                    <span>
                      Picked:{" "}
                      {formatTime(o.pickedUpAt)}
                    </span>
                    <span>
                      Dispatched:{" "}
                      {formatTime(
                        o.dispatchedAt,
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
