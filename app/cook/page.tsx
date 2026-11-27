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
import KotPrintTicketModal from "@/components/KotPrintTicketModal";
import RealtimeSyncBadge from "@/components/RealtimeSyncBadge";
import { useKitchenAudioAlerts } from "@/hooks/useKitchenAudioAlerts";
import { useRealtimeKitchenSync } from "@/hooks/useRealtimeKitchenSync";
import {
  BRANDS_DB,
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
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOrderAgeMins(value?: string): number {
  if (!value) return 0;
  const created = new Date(value).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 60000));
}

function groupItemsByStation(order: Order): Array<[string, Order["items"]]> {
  const map = new Map<string, Order["items"]>();
  for (const item of order.items) {
    const station = item.station || "Assembly";
    const list = map.get(station) ?? [];
    list.push(item);
    map.set(station, list);
  }
  return Array.from(map.entries());
}

export default function CookPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [depletionNotice, setDepletionNotice] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const [kitchenFilter, setKitchenFilter] = useState<string>("ALL");
  const [brandFilter, setBrandFilter] = useState<string>("ALL");
  const [stationFilter, setStationFilter] = useState<string>("ALL");
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [prepSlaMinutes, setPrepSlaMinutes] = useState<number>(12);
  const [kotOrder, setKotOrder] = useState<Order | null>(null);
  const [autoPrintKotOnPrep, setAutoPrintKotOnPrep] = useState<boolean>(false);

  const audio = useKitchenAudioAlerts();
  const seenPendingIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    try {
      if (
        window.localStorage.getItem("darkit:auto-print-kot-on-prep") === "true"
      ) {
        setAutoPrintKotOnPrep(true);
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  function toggleAutoPrintKot() {
    setAutoPrintKotOnPrep((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(
          "darkit:auto-print-kot-on-prep",
          String(next),
        );
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }

  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (data.employee) {
          const emp = data.employee as Employee;
          setCurrentEmployee(emp);
          if (emp.role !== "OWNER" && emp.kitchenId) {
            setKitchenFilter(emp.kitchenId);
          }
        }
        if (typeof data.settings?.prepSlaMinutes === "number") {
          setPrepSlaMinutes(data.settings.prepSlaMinutes);
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
        throw new Error(data.error ?? "Unable to load kitchen orders.");
      }
      setOrders(Array.isArray(data.orders) ? data.orders : []);
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
      if (kitchenFilter !== "ALL" && order.kitchenId !== kitchenFilter) {
        return false;
      }
      if (brandFilter !== "ALL" && order.brandId !== brandFilter) {
        return false;
      }
      if (
        stationFilter !== "ALL" &&
        !order.items.some((i) => i.station === stationFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [orders, kitchenFilter, brandFilter, stationFilter]);

  const pendingOrders = activeOrders.filter((o) => o.status === "PENDING");
  const preparingOrders = activeOrders.filter((o) => o.status === "PREPARING");
  const readyOrders = activeOrders.filter(
    (o) => o.status === "READY_FOR_PICKUP",
  );

  // Deduplicated New Ticket Chime when brand-new PENDING order arrives
  useEffect(() => {
    if (loading) return;
    const currentPendingIds = new Set(pendingOrders.map((o) => o.id));
    if (seenPendingIdsRef.current === null) {
      seenPendingIdsRef.current = currentPendingIds;
      return;
    }
    for (const id of currentPendingIds) {
      if (!seenPendingIdsRef.current.has(id)) {
        audio.playNewOrderChime(id);
      }
    }
    seenPendingIdsRef.current = currentPendingIds;
  }, [loading, pendingOrders, audio]);

  async function updateOrder(
    orderId: string,
    action: "PREPARING" | "READY_FOR_PICKUP",
  ) {
    setUpdatingOrderId(orderId);
    setError("");
    setDepletionNotice("");

    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to update order.");
      }

      if (action === "PREPARING") {
        const depleted = Array.isArray(data.depletedItems)
          ? data.depletedItems.join(", ")
          : "Recipe items";
        const alerts = Array.isArray(data.lowStockAlerts)
          ? data.lowStockAlerts
          : [];
        let autoPrintNote = "";
        if (autoPrintKotOnPrep) {
          try {
            const kotRes = await fetch("/api/hardware/kot/print", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId }),
            });
            const kotData = await kotRes.json();
            if (kotRes.ok && kotData?.printJobId) {
              autoPrintNote = ` · Auto-printed 80mm KOT [${kotData.printJobId}]`;
            }
          } catch {
            // Non-blocking hardware bridge failure
          }
        }
        setDepletionNotice(
          `Prep started for ${orderId}: Depleted [${depleted}]${
            alerts.length > 0 ? ` · Low stock: ${alerts.join(", ")}` : ""
          }${autoPrintNote}.`,
        );
      } else {
        setDepletionNotice(
          `${orderId} bumped to READY_FOR_PICKUP -> routed to Dispatch.`,
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

  function renderTicket(order: Order) {
    const isUpdating = updatingOrderId === order.id;
    const hasWarnings = Boolean(order.inventoryWarnings?.length);
    const isUnavailable = Boolean(order.inventoryUnavailable?.length);
    const ageMins = getOrderAgeMins(order.receivedAt ?? order.createdAt);
    const isUrgent =
      order.priority === "RUSH" ||
      order.priority === "VIP" ||
      ageMins >= prepSlaMinutes;
    const groupedStations = groupItemsByStation(order);

    return (
      <article
        key={order.id}
        className={`flex flex-col overflow-hidden rounded-lg border bg-[#151519] ${
          isUrgent ? "border-amber-500/50" : "border-white/[0.08]"
        }`}
      >
        {/* High-Contrast Ticket Header */}
        <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] bg-[#1d1d22]/60 px-3.5 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold tracking-tight text-zinc-100 tabular-nums">
                #{order.id}
              </span>
              {order.priority && order.priority !== "NORMAL" && (
                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-rose-300">
                  {order.priority}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-zinc-400">
              <span className="font-medium text-zinc-200">{order.brandId}</span>{" "}
              · {order.kitchenId} · {order.channel} ·{" "}
              <span className="font-mono tabular-nums">
                {formatTime(order.receivedAt ?? order.createdAt)}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <KitchenSlaBadge
              orderId={order.id}
              anchorIso={
                order.prepStartedAt ?? order.receivedAt ?? order.createdAt
              }
              slaMinutes={prepSlaMinutes}
              labelPrefix="Prep SLA"
              onBreach={audio.playSlaBreachAlert}
            />
            <button
              type="button"
              onClick={() => setKotOrder(order)}
              title="Print 80mm KOT"
              className="inline-flex h-6 items-center rounded-md border border-white/[0.1] bg-[#151519] px-2 font-mono text-[10px] font-medium text-zinc-300 transition-colors hover:border-white/[0.2] hover:text-zinc-100"
            >
              KOT
            </button>
          </div>
        </div>

        {/* Station-Grouped Items */}
        <div className="divide-y divide-white/[0.06] px-3.5 py-2">
          {groupedStations.map(([station, items]) => (
            <div key={station} className="py-1.5 first:pt-0.5 last:pb-0.5">
              <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {station}
              </p>
              <div className="space-y-1">
                {items.map((item, idx) => (
                  <div
                    key={item.id ?? item.menuItemId ?? `${order.id}-${idx}`}
                    className="flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-zinc-100">
                        {item.name}
                      </span>
                      {item.notes && (
                        <p className="mt-0.5 font-mono text-[11px] text-amber-300">
                          Note: {item.notes}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-sm font-bold text-zinc-100 tabular-nums">
                      ×{item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Stock Warnings / Blocks */}
        {(hasWarnings || isUnavailable) && (
          <div className="space-y-1.5 border-t border-white/[0.06] px-3.5 py-2 text-[11px]">
            {hasWarnings && (
              <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-amber-200">
                Low stock: {order.inventoryWarnings?.join(", ")}
              </div>
            )}
            {isUnavailable && (
              <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-rose-200">
                Stock-out block: {order.inventoryUnavailable?.join(", ")}
              </div>
            )}
          </div>
        )}

        {/* 48px Full-Width Tactile Bottom Action */}
        <div className="border-t border-white/[0.06] p-2">
          {order.status === "PENDING" && (
            <button
              type="button"
              disabled={isUpdating || isUnavailable}
              onClick={() => void updateOrder(order.id, "PREPARING")}
              className="h-12 w-full rounded-md bg-zinc-100 font-mono text-xs font-bold uppercase tracking-wider text-zinc-950 transition-colors hover:bg-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUpdating
                ? "Depleting stock..."
                : isUnavailable
                  ? "Stock Unavailable"
                  : "Start Prep"}
            </button>
          )}

          {order.status === "PREPARING" && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => void updateOrder(order.id, "READY_FOR_PICKUP")}
              className="h-12 w-full rounded-md bg-emerald-500 font-mono text-xs font-bold uppercase tracking-wider text-zinc-950 transition-colors hover:bg-emerald-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUpdating ? "Bumping..." : "Bump Ready"}
            </button>
          )}

          {order.status === "READY_FOR_PICKUP" && (
            <Link
              href="/dispatch"
              className="flex h-12 w-full items-center justify-between rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3.5 font-mono text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
            >
              <span>Staged at Pass</span>
              <span>Dispatch →</span>
            </Link>
          )}
        </div>
      </article>
    );
  }

  return (
    <AppShell
      title="Cook KDS"
      subtitle={`${activeOrders.length} active tickets`}
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
          <button
            type="button"
            onClick={toggleAutoPrintKot}
            className={`inline-flex h-7 items-center rounded-md border px-2.5 font-mono text-[11px] font-medium transition-colors ${
              autoPrintKotOnPrep
                ? "border-sky-500/40 bg-sky-500/15 text-sky-300"
                : "border-white/[0.08] bg-[#151519] text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Auto-KOT: {autoPrintKotOnPrep ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="inline-flex h-7 items-center rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-white/[0.16] hover:text-zinc-100"
          >
            Sync
          </button>
        </>
      }
    >
      {/* Compact Station & Brand Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-[#09090b]/50 px-4 py-2">
        <div
          role="group"
          aria-label="Prep station filter"
          className="flex flex-wrap items-center rounded-md border border-white/[0.06] bg-[#151519] p-0.5"
        >
          {(["ALL", ...STATIONS] as const).map((station) => {
            const active = stationFilter === station;
            return (
              <button
                key={station}
                type="button"
                onClick={() => setStationFilter(station)}
                className={`rounded-[5px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? "bg-[#27272e] text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {station === "ALL" ? "All Stations" : station}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Filter brand"
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="h-7 rounded-md border border-white/[0.08] bg-[#151519] px-2 text-[11px] text-zinc-200 outline-none focus:border-white/[0.2]"
          >
            <option value="ALL">All Brands</option>
            {BRANDS_DB.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span className="hidden font-mono text-[11px] text-zinc-500 tabular-nums sm:inline">
            SLA ≤ {prepSlaMinutes}m
          </span>
        </div>
      </div>

      {error && (
        <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      {depletionNotice && (
        <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200">
          {depletionNotice}
        </div>
      )}

      {/* Full-Viewport 3-Lane Hairline KDS Board */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center p-12 text-xs text-zinc-500">
          Loading KDS tickets...
        </div>
      ) : (
        <div className="grid flex-1 divide-y divide-white/[0.06] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {/* Lane 1: PENDING */}
          <section className="flex min-h-[300px] flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#09090b]/40 px-4 py-2.5">
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                PENDING
              </span>
              <span className="rounded bg-amber-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-300 tabular-nums">
                {pendingOrders.length}
              </span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-3.5">
              {pendingOrders.length === 0 ? (
                <p className="py-10 text-center text-xs text-zinc-600">
                  No pending tickets
                </p>
              ) : (
                pendingOrders.map(renderTicket)
              )}
            </div>
          </section>

          {/* Lane 2: PREPARING */}
          <section className="flex min-h-[300px] flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#09090b]/40 px-4 py-2.5">
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                PREPARING
              </span>
              <span className="rounded bg-sky-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-300 tabular-nums">
                {preparingOrders.length}
              </span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-3.5">
              {preparingOrders.length === 0 ? (
                <p className="py-10 text-center text-xs text-zinc-600">
                  No orders on line
                </p>
              ) : (
                preparingOrders.map(renderTicket)
              )}
            </div>
          </section>

          {/* Lane 3: READY_FOR_PICKUP */}
          <section className="flex min-h-[300px] flex-col">
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#09090b]/40 px-4 py-2.5">
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                READY FOR PICKUP
              </span>
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-300 tabular-nums">
                {readyOrders.length}
              </span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-3.5">
              {readyOrders.length === 0 ? (
                <p className="py-10 text-center text-xs text-zinc-600">
                  No staged orders
                </p>
              ) : (
                readyOrders.map(renderTicket)
              )}
            </div>
          </section>
        </div>
      )}

      <KotPrintTicketModal
        order={kotOrder}
        onClose={() => setKotOrder(null)}
        onPrinted={({ orderId, printJobId, mode }) =>
          setDepletionNotice(
            `80mm KOT printed for ${orderId} via ${mode} [${printJobId}].`,
          )
        }
      />
    </AppShell>
  );
}
