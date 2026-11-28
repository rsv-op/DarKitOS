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
import { SplitInspector } from "@/components/SplitInspector";
import { useKitchenAudioAlerts } from "@/hooks/useKitchenAudioAlerts";
import { useRealtimeKitchenSync } from "@/hooks/useRealtimeKitchenSync";
import { formatCurrency, type SupportedCurrency } from "@/lib/currency";
import type { Employee, Order, PermissionCode } from "@/lib/db";

const COURIER_CHIPS = [
  "Shadowfax",
  "Porter",
  "Swiggy Fleet",
  "Zomato Rider",
];

const ETA_CHIPS = [5, 8, 12, 15];

function formatTime(value?: string): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOrderAge(value?: string): string {
  if (!value) return "--";
  const created = new Date(value).getTime();
  if (Number.isNaN(created)) return "--";
  return `${Math.max(0, Math.floor((Date.now() - created) / 60000))}m`;
}

export default function DispatchPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [kitchenFilter, setKitchenFilter] = useState<string>("ALL");
  const [canCancelOrders, setCanCancelOrders] = useState<boolean>(false);
  const [currency, setCurrency] = useState<SupportedCurrency>("INR");
  const [dispatchSlaMinutes, setDispatchSlaMinutes] = useState<number>(8);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

  const [driverInputs, setDriverInputs] = useState<Record<string, string>>({});
  const [etaInputs, setEtaInputs] = useState<Record<string, number>>({});

  // Post-pickup claim cancellation SplitInspector
  const [claimOrder, setClaimOrder] = useState<Order | null>(null);
  const [claimReason, setClaimReason] = useState(
    "Post-pickup aggregator cancellation — logged for accounting claim reconciliation",
  );

  const audio = useKitchenAudioAlerts();
  const seenReadyIdsRef = useRef<Set<string> | null>(null);

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
        if (data.settings?.currency) setCurrency(data.settings.currency);
        if (typeof data.settings?.dispatchSlaMinutes === "number") {
          setDispatchSlaMinutes(data.settings.dispatchSlaMinutes);
        }
        if (data.employee) {
          const emp = data.employee as Employee;
          setCurrentEmployee(emp);
          if (emp.role !== "OWNER" && emp.kitchenId) {
            setKitchenFilter(emp.kitchenId);
          }
        }
      })
      .catch(() => {});

    const onHubChanged = (event: Event) => {
      const custom = event as CustomEvent<{ kitchenId?: string }>;
      if (custom.detail?.kitchenId) setKitchenFilter(custom.detail.kitchenId);
    };
    window.addEventListener("darkit:hub-changed", onHubChanged);
    return () => {
      active = false;
      window.removeEventListener("darkit:hub-changed", onHubChanged);
    };
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load dispatch orders.");
      }
      setOrders(Array.isArray(data.orders) ? data.orders : []);
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

  const scopedOrders = useMemo(
    () =>
      orders.filter(
        (o) => kitchenFilter === "ALL" || o.kitchenId === kitchenFilter,
      ),
    [orders, kitchenFilter],
  );

  const readyOrders = useMemo(
    () =>
      scopedOrders.filter(
        (order) =>
          order.status === "READY_FOR_PICKUP" ||
          order.status === "DRIVER_ASSIGNED" ||
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
  const pickedUp = readyOrders.filter((o) => o.status === "PICKED_UP");

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
    () => scopedOrders.filter((o) => o.status === "DISPATCHED").slice(0, 8),
    [scopedOrders],
  );

  async function updateOrder(
    orderId: string,
    action: "DRIVER_ASSIGNED" | "PICKED_UP" | "DISPATCHED" | "CANCELLED",
    driverName?: string,
    courierEtaMins?: number,
    cancellationReason?: string,
  ) {
    setUpdatingOrderId(orderId);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          action,
          ...(driverName ? { driverName } : {}),
          ...(typeof courierEtaMins === "number" ? { courierEtaMins } : {}),
          ...(cancellationReason
            ? {
                cancellationSource: "AGGREGATOR",
                cancellationReason,
              }
            : {}),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to update order.");
      }

      if (action === "CANCELLED") {
        setNotice(
          `Post-pickup claim logged for ${orderId}: ${formatCurrency(
            data.cancellationRecord?.claimAmount ?? 0,
            currency,
          )} claim created with courier evidence.`,
        );
        setClaimOrder(null);
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

  function renderHandoffCard(order: Order) {
    const isUpdating = updatingOrderId === order.id;
    const selectedDriver = driverInputs[order.id] ?? COURIER_CHIPS[0];
    const selectedEta = etaInputs[order.id] ?? 8;

    return (
      <article
        key={order.id}
        className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#151519]"
      >
        <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] bg-[#1d1d22]/50 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="font-mono text-sm font-bold text-zinc-100 tabular-nums">
              #{order.id}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-zinc-400">
              {order.brandId} · {order.kitchenId} · {order.channel} ·{" "}
              {order.customerName || "Guest"}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <KitchenSlaBadge
              orderId={order.id}
              anchorIso={order.readyAt ?? order.createdAt}
              slaMinutes={dispatchSlaMinutes}
              labelPrefix="Dispatch SLA"
              onBreach={audio.playSlaBreachAlert}
            />
            <p className="mt-1 font-mono text-[10px] text-zinc-500 tabular-nums">
              Ready {formatTime(order.readyAt)} · Age{" "}
              {getOrderAge(order.receivedAt ?? order.createdAt)}
            </p>
          </div>
        </div>

        <div className="divide-y divide-white/[0.06] px-3.5 py-1.5 text-xs">
          {order.items.map((item, idx) => (
            <div
              key={item.id ?? item.menuItemId ?? `${order.id}-${idx}`}
              className="flex items-center justify-between py-1"
            >
              <span className="truncate text-zinc-200">{item.name}</span>
              <span className="ml-2 shrink-0 font-mono font-semibold text-zinc-100 tabular-nums">
                ×{item.quantity}
              </span>
            </div>
          ))}
        </div>

        {/* Stage Controls */}
        {order.status === "READY_FOR_PICKUP" && (
          <div className="space-y-2.5 border-t border-white/[0.06] p-3">
            {/* 1-Tap Courier Chips */}
            <div className="flex flex-wrap gap-1">
              {COURIER_CHIPS.map((fleet) => {
                const active = selectedDriver === fleet;
                return (
                  <button
                    key={fleet}
                    type="button"
                    onClick={() =>
                      setDriverInputs((prev) => ({ ...prev, [order.id]: fleet }))
                    }
                    className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? "border-white/[0.25] bg-[#27272e] text-zinc-100"
                        : "border-white/[0.07] bg-[#0e0e11] text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {fleet}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                type="text"
                value={selectedDriver}
                onChange={(e) =>
                  setDriverInputs((prev) => ({
                    ...prev,
                    [order.id]: e.target.value,
                  }))
                }
                placeholder="Courier or rider name"
                className="h-8 rounded-md border border-white/[0.08] bg-[#0e0e11] px-2.5 text-xs text-zinc-100 outline-none focus:border-white/[0.2]"
              />
              <div className="flex items-center rounded-md border border-white/[0.08] bg-[#0e0e11] p-0.5">
                {ETA_CHIPS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() =>
                      setEtaInputs((prev) => ({ ...prev, [order.id]: mins }))
                    }
                    className={`rounded px-1.5 py-1 font-mono text-[10px] tabular-nums ${
                      selectedEta === mins
                        ? "bg-[#27272e] text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={isUpdating || !selectedDriver.trim()}
              onClick={() =>
                void updateOrder(
                  order.id,
                  "DRIVER_ASSIGNED",
                  selectedDriver.trim(),
                  selectedEta,
                )
              }
              className="h-10 w-full rounded-md bg-zinc-100 font-mono text-xs font-bold uppercase tracking-wider text-zinc-950 transition-colors hover:bg-white disabled:opacity-40"
            >
              {isUpdating ? "Assigning..." : "Assign Rider"}
            </button>
          </div>
        )}

        {order.status === "DRIVER_ASSIGNED" && (
          <div className="space-y-2.5 border-t border-white/[0.06] p-3">
            <div className="flex items-center justify-between rounded-md border border-violet-500/25 bg-violet-500/10 px-2.5 py-2 text-xs">
              <span className="font-medium text-violet-200">
                {order.driverName ?? "--"}
              </span>
              <span className="font-mono text-[11px] text-violet-300 tabular-nums">
                ETA{" "}
                {typeof order.courierEtaMins === "number"
                  ? `${order.courierEtaMins}m`
                  : "--"}
              </span>
            </div>
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => void updateOrder(order.id, "PICKED_UP")}
              className="h-10 w-full rounded-md bg-amber-400 font-mono text-xs font-bold uppercase tracking-wider text-zinc-950 transition-colors hover:bg-amber-300 disabled:opacity-40"
            >
              {isUpdating ? "Confirming..." : "Confirm Pickup"}
            </button>
          </div>
        )}

        {order.status === "PICKED_UP" && (
          <div className="space-y-2 border-t border-white/[0.06] p-3">
            <div className="flex items-center justify-between rounded-md border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-2 text-xs">
              <span className="font-medium text-indigo-200">
                {order.driverName ?? "--"}
              </span>
              <span className="font-mono text-[10px] text-indigo-300 tabular-nums">
                Picked {formatTime(order.pickedUpAt)}
              </span>
            </div>

            <button
              type="button"
              disabled={isUpdating}
              onClick={() => void updateOrder(order.id, "DISPATCHED")}
              className="h-10 w-full rounded-md bg-emerald-500 font-mono text-xs font-bold uppercase tracking-wider text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-40"
            >
              {isUpdating ? "Finalizing..." : "Mark Dispatched"}
            </button>

            {canCancelOrders && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => setClaimOrder(order)}
                className="h-8 w-full rounded-md border border-rose-500/35 bg-rose-500/10 font-mono text-[11px] font-medium text-rose-300 transition-colors hover:bg-rose-500/20"
              >
                Post-Pickup Cancel (Claim)
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
      subtitle={`${readyOrders.length} active handoffs`}
      activeHub={kitchenFilter}
      onHubChange={setKitchenFilter}
      fullBleed
      rightActions={
        <>
          <RealtimeSyncBadge
            connectionMode={realtimeSync.connectionMode}
            lastEventAt={realtimeSync.lastEventAt}
            topic={realtimeSync.topic}
          />
          <button
            type="button"
            onClick={audio.toggleAudio}
            className={`inline-flex h-7 items-center rounded-md border px-2.5 font-mono text-[11px] font-medium transition-colors ${
              audio.audioEnabled
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-white/[0.08] bg-[#151519] text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Chimes: {audio.audioEnabled ? "ON" : "OFF"}
          </button>
          <Link
            href="/cook"
            className="inline-flex h-7 items-center rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-[11px] font-medium text-zinc-300 hover:border-white/[0.16] hover:text-zinc-100"
          >
            Kitchen Screen
          </Link>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="inline-flex h-7 items-center rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-[11px] font-medium text-zinc-300 hover:border-white/[0.16] hover:text-zinc-100"
          >
            Refresh
          </button>
        </>
      }
    >
      {error && (
        <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      {notice && (
        <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200">
          {notice}
        </div>
      )}

      {/* 3-Lane Hairline Handoff Queue */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center p-12 text-xs text-zinc-500">
          Loading dispatch queues...
        </div>
      ) : (
        <div className="grid flex-1 divide-y divide-white/[0.06] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <section className="flex min-h-[280px] flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#09090b]/40 px-4 py-2.5">
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Ready for Pickup
              </span>
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-300 tabular-nums">
                {readyForPickup.length}
              </span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-3.5">
              {readyForPickup.length === 0 ? (
                <p className="py-10 text-center text-xs text-zinc-600">
                  No orders ready at pass
                </p>
              ) : (
                readyForPickup.map(renderHandoffCard)
              )}
            </div>
          </section>

          <section className="flex min-h-[280px] flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#09090b]/40 px-4 py-2.5">
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <span className="h-2 w-2 rounded-full bg-violet-400" />
                Rider Assigned
              </span>
              <span className="rounded bg-violet-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-violet-300 tabular-nums">
                {driverAssigned.length}
              </span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-3.5">
              {driverAssigned.length === 0 ? (
                <p className="py-10 text-center text-xs text-zinc-600">
                  No assigned riders en route
                </p>
              ) : (
                driverAssigned.map(renderHandoffCard)
              )}
            </div>
          </section>

          <section className="flex min-h-[280px] flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#09090b]/40 px-4 py-2.5">
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <span className="h-2 w-2 rounded-full bg-indigo-400" />
                Picked Up
              </span>
              <span className="rounded bg-indigo-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-300 tabular-nums">
                {pickedUp.length}
              </span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-3.5">
              {pickedUp.length === 0 ? (
                <p className="py-10 text-center text-xs text-zinc-600">
                  No orders in rider custody
                </p>
              ) : (
                pickedUp.map(renderHandoffCard)
              )}
            </div>
          </section>
        </div>
      )}

      {/* Completed Dispatch Evidence Ledger */}
      <section className="border-t border-white/[0.06] bg-[#09090b]/50">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
          <h2 className="text-xs font-semibold text-zinc-300">
            Completed Dispatch Evidence Ledger
          </h2>
          <span className="font-mono text-[10px] text-zinc-500 tabular-nums">
            {recentlyDispatched.length} recent handoffs
          </span>
        </div>
        {recentlyDispatched.length === 0 ? (
          <p className="px-4 py-4 text-xs text-zinc-500">
            No completed dispatches recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] font-medium text-zinc-500">
                  <th className="px-4 py-2">Order</th>
                  <th className="px-4 py-2">Hub / Channel</th>
                  <th className="px-4 py-2">Courier</th>
                  <th className="px-4 py-2 text-right">Picked Up</th>
                  <th className="px-4 py-2 text-right">Dispatched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {recentlyDispatched.map((o) => (
                  <tr key={o.id} className="hover:bg-[#151519]/60">
                    <td className="px-4 py-2 font-mono font-medium text-zinc-100 tabular-nums">
                      {o.id}{" "}
                      <span className="text-zinc-500">({o.brandId})</span>
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px] text-zinc-400">
                      {o.kitchenId} · {o.channel}
                    </td>
                    <td className="px-4 py-2 text-zinc-200">
                      {o.driverName || "Verified"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[11px] text-zinc-400 tabular-nums">
                      {formatTime(o.pickedUpAt)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[11px] text-emerald-300 tabular-nums">
                      {formatTime(o.dispatchedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* RBAC-Gated Post-Pickup Claim Cancellation SplitInspector */}
      <SplitInspector
        open={Boolean(claimOrder)}
        mode="overlay"
        title={
          claimOrder ? `Post-Pickup Claim · ${claimOrder.id}` : "Post-Pickup Claim"
        }
        subtitle="Preserves courier handoff proof and logs aggregator reimbursement claim"
        onClose={() => setClaimOrder(null)}
        footer={
          claimOrder ? (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setClaimOrder(null)}
                className="h-8 rounded-md border border-white/[0.08] bg-[#151519] px-3 text-xs font-medium text-zinc-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingOrderId === claimOrder.id}
                onClick={() =>
                  void updateOrder(
                    claimOrder.id,
                    "CANCELLED",
                    undefined,
                    undefined,
                    claimReason.trim() ||
                      "Post-pickup aggregator cancellation claim",
                  )
                }
                className="h-8 rounded-md border border-rose-500/40 bg-rose-500/20 px-3 text-xs font-semibold text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
              >
                {updatingOrderId === claimOrder.id
                  ? "Filing Claim..."
                  : "Confirm Post-Pickup Cancellation"}
              </button>
            </div>
          ) : undefined
        }
      >
        {claimOrder && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.06]">
              <div className="bg-[#151519] p-3">
                <p className="text-[10px] text-zinc-500">Courier in Custody</p>
                <p className="mt-0.5 font-medium text-zinc-100">
                  {claimOrder.driverName || "Unassigned"}
                </p>
              </div>
              <div className="bg-[#151519] p-3">
                <p className="text-[10px] text-zinc-500">Picked Up At</p>
                <p className="mt-0.5 font-mono text-zinc-100 tabular-nums">
                  {formatTime(claimOrder.pickedUpAt)}
                </p>
              </div>
              <div className="bg-[#151519] p-3">
                <p className="text-[10px] text-zinc-500">Channel</p>
                <p className="mt-0.5 text-zinc-100">{claimOrder.channel}</p>
              </div>
              <div className="bg-[#151519] p-3">
                <p className="text-[10px] text-zinc-500">Order Total</p>
                <p className="mt-0.5 font-mono font-semibold text-amber-300 tabular-nums">
                  {formatCurrency(claimOrder.totalAmount ?? 0, currency)}
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-zinc-400">
                Aggregator Claim Reason
              </label>
              <textarea
                rows={3}
                value={claimReason}
                onChange={(e) => setClaimReason(e.target.value)}
                className="w-full rounded-md border border-white/[0.08] bg-[#151519] px-3 py-2 text-xs text-zinc-100 outline-none focus:border-white/[0.2]"
              />
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">
              Stage <code className="font-mono">AFTER_PICKUP</code>: Cooked
              inventory will NOT return to usable stock; full order value is
              logged for aggregator payout dispute reconciliation.
            </div>
          </div>
        )}
      </SplitInspector>
    </AppShell>
  );
}
