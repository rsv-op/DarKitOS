"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import KitchenSlaBadge from "@/components/KitchenSlaBadge";
import KotPrintTicketModal from "@/components/KotPrintTicketModal";
import OrderSimulationPanel from "@/components/OrderSimulationPanel";
import RealtimeSyncBadge from "@/components/RealtimeSyncBadge";
import { SplitInspector } from "@/components/SplitInspector";
import { useRealtimeKitchenSync } from "@/hooks/useRealtimeKitchenSync";
import { formatCurrency, type SupportedCurrency } from "@/lib/currency";
import {
  BRANDS_DB,
  type CancellationSource,
  type Employee,
  type Order,
  type OrderChannel,
  type OrderPaymentStatus,
  type OrderStatus,
  type SystemSettings,
} from "@/lib/db";

const PAYMENT_STATUS_BADGE: Record<OrderPaymentStatus, string> = {
  CAPTURED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  AGGREGATOR_SETTLED: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  UNPAID: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  REFUNDED: "border-violet-500/30 bg-violet-500/10 text-violet-300",
};

const STATUSES: OrderStatus[] = [
  "PENDING",
  "PREPARING",
  "READY_FOR_PICKUP",
  "DRIVER_ASSIGNED",
  "PICKED_UP",
  "DISPATCHED",
  "CANCELLED",
];

const CHANNELS: OrderChannel[] = [
  "Swiggy",
  "Zomato",
  "DoorDash",
  "UberEats",
  "GrubHub",
  "Direct Web",
];

const STATUS_DOT: Record<OrderStatus, string> = {
  PENDING: "bg-amber-400",
  PREPARING: "bg-sky-400",
  READY_FOR_PICKUP: "bg-emerald-400",
  DRIVER_ASSIGNED: "bg-violet-400",
  PICKED_UP: "bg-indigo-400",
  DISPATCHED: "bg-teal-400",
  CANCELLED: "bg-rose-400",
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  PENDING: "border-amber-500/35 bg-amber-500/10 text-amber-300",
  PREPARING: "border-sky-500/35 bg-sky-500/10 text-sky-300",
  READY_FOR_PICKUP: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
  DRIVER_ASSIGNED: "border-violet-500/35 bg-violet-500/10 text-violet-300",
  PICKED_UP: "border-indigo-500/35 bg-indigo-500/10 text-indigo-300",
  DISPATCHED: "border-teal-500/35 bg-teal-500/10 text-teal-300",
  CANCELLED: "border-rose-500/35 bg-rose-500/10 text-rose-300",
};

function formatTime(value?: string): string {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "PREPARING", label: "Cooking" },
  { value: "READY_FOR_PICKUP", label: "Ready" },
  { value: "DISPATCHED", label: "Dispatched" },
  { value: "CANCELLED", label: "Cancelled" },
];

function SearchParamCoordinator({
  onSelectOrder,
  onOpenInject,
  onSelectStatus,
}: {
  onSelectOrder: (id: string | null) => void;
  onOpenInject: () => void;
  onSelectStatus: (status: string) => void;
}) {
  const params = useSearchParams();
  const orderId = params.get("order");
  const action = params.get("action");
  const status = params.get("status");

  useEffect(() => {
    if (orderId) onSelectOrder(orderId);
  }, [orderId, onSelectOrder]);

  useEffect(() => {
    if (action === "inject") onOpenInject();
  }, [action, onOpenInject]);

  useEffect(() => {
    if (status) {
      const normalized = status.trim().toUpperCase();
      if (normalized === "ALL" || STATUSES.includes(normalized as OrderStatus)) {
        onSelectStatus(normalized);
      }
    }
  }, [status, onSelectStatus]);

  return null;
}

export default function LiveOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [currency, setCurrency] = useState<SupportedCurrency>("INR");
  const [prepSlaMinutes, setPrepSlaMinutes] = useState<number>(12);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [brandFilter, setBrandFilter] = useState<string>("ALL");
  const [kitchenFilter, setKitchenFilter] = useState<string>("ALL");
  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [injectOpen, setInjectOpen] = useState(false);

  const [cancelReason, setCancelReason] = useState(
    "Customer requested cancellation via aggregator support",
  );
  const [cancelSource, setCancelSource] =
    useState<CancellationSource>("CUSTOMER");
  const [restorePrePrep, setRestorePrePrep] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [kotOrder, setKotOrder] = useState<Order | null>(null);

  // Subtle 600ms Realtime row flash tracker
  const prevSnapshotsRef = useRef<Map<string, string>>(new Map());
  const [flashedIds, setFlashedIds] = useState<Set<string>>(new Set());

  const openLinkedOrder = useCallback((id: string | null) => {
    if (id) {
      setSearch(id);
      setSelectedOrderId(id);
    }
  }, []);

  const openInjectDrawer = useCallback(() => setInjectOpen(true), []);

  const applyStatusFilter = useCallback((status: string) => {
    setStatusFilter(status);
    setSelectedOrderId(null);
  }, []);

  const fmt = useCallback(
    (amount: number) => formatCurrency(amount, currency),
    [currency],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (data.settings?.currency) setCurrency(data.settings.currency);
        if (typeof data.settings?.prepSlaMinutes === "number") {
          setPrepSlaMinutes(data.settings.prepSlaMinutes);
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

    const onSettingsUpdated = (event: Event) => {
      const custom = event as CustomEvent<SystemSettings>;
      if (custom.detail?.currency) setCurrency(custom.detail.currency);
      if (typeof custom.detail?.prepSlaMinutes === "number") {
        setPrepSlaMinutes(custom.detail.prepSlaMinutes);
      }
    };
    const onHubChanged = (event: Event) => {
      const custom = event as CustomEvent<{ kitchenId?: string }>;
      if (custom.detail?.kitchenId) setKitchenFilter(custom.detail.kitchenId);
    };

    window.addEventListener("darkit:settings-updated", onSettingsUpdated);
    window.addEventListener("darkit:hub-changed", onHubChanged);
    return () => {
      active = false;
      window.removeEventListener("darkit:settings-updated", onSettingsUpdated);
      window.removeEventListener("darkit:hub-changed", onHubChanged);
    };
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to load canonical orders.");
      }
      const list = Array.isArray(data.orders) ? (data.orders as Order[]) : [];

      const nextSnapshots = new Map<string, string>();
      const changed = new Set<string>();
      const hadPrev = prevSnapshotsRef.current.size > 0;
      for (const ord of list) {
        const sig = `${ord.status}|${ord.paymentStatus ?? ""}|${ord.events.length}`;
        nextSnapshots.set(ord.id, sig);
        if (hadPrev && prevSnapshotsRef.current.get(ord.id) !== sig) {
          changed.add(ord.id);
        }
      }
      prevSnapshotsRef.current = nextSnapshots;

      if (changed.size > 0) {
        setFlashedIds(changed);
        window.setTimeout(() => setFlashedIds(new Set()), 650);
      }

      setOrders(list);
      setSelectedOrderId((prev) => prev ?? list[0]?.id ?? null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load orders.");
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

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (brandFilter !== "ALL" && o.brandId !== brandFilter) return false;
      if (kitchenFilter !== "ALL" && o.kitchenId !== kitchenFilter) return false;
      if (channelFilter !== "ALL" && o.channel !== channelFilter) return false;
      if (q) {
        const match =
          o.id.toLowerCase().includes(q) ||
          (o.customerName || "").toLowerCase().includes(q) ||
          (o.externalOrderId || "").toLowerCase().includes(q) ||
          o.items.some((i) => i.name.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [
    orders,
    statusFilter,
    brandFilter,
    kitchenFilter,
    channelFilter,
    search,
  ]);

  // Keyboard navigation (ArrowUp / ArrowDown) across inbox rows
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (injectOpen || kotOrder) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (filteredOrders.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = filteredOrders.findIndex((o) => o.id === selectedOrderId);
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const nextIdx =
          idx < 0
            ? 0
            : (idx + delta + filteredOrders.length) % filteredOrders.length;
        setSelectedOrderId(filteredOrders[nextIdx].id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filteredOrders, selectedOrderId, injectOpen, kotOrder]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId],
  );

  // Auto-select first matching order when status filter changes (e.g. ?status=CANCELLED)
  useEffect(() => {
    if (loading || filteredOrders.length === 0) return;
    if (
      !selectedOrderId ||
      !filteredOrders.some((o) => o.id === selectedOrderId)
    ) {
      setSelectedOrderId(filteredOrders[0].id);
    }
  }, [loading, filteredOrders, selectedOrderId]);

  async function handleTransition(
    orderId: string,
    nextStatus: OrderStatus,
    extra?: Record<string, unknown>,
  ) {
    setSubmittingId(orderId);
    setError("");
    setFeedback("");
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action: nextStatus, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Status transition rejected.");
      }

      if (data.idempotentReplay) {
        setFeedback(
          `Idempotency verified: ${orderId} already in ${nextStatus}. No duplicate ledger changes.`,
        );
      } else if (nextStatus === "CANCELLED") {
        const rec = data.cancellationRecord;
        const cnNote = data.creditNoteInvoice
          ? ` · GST ${data.creditNoteInvoice.invoiceNumber} -> CREDIT_NOTE`
          : "";
        const refundNote = data.refundTransaction
          ? ` · Refund ${data.refundTransaction.providerRefundId} (${fmt(data.refundTransaction.refundedAmount)})`
          : "";
        setFeedback(
          `Order ${orderId} cancelled (${rec?.stage || "STAGE"}) -> ${rec?.resolution || "PROCESSED"} · Loss ${fmt(rec?.financialLoss ?? 0)} · Claim ${fmt(rec?.claimAmount ?? 0)}${cnNote}${refundNote}.`,
        );
      } else {
        setFeedback(`Order ${orderId} transitioned to ${nextStatus}.`);
      }
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transition failed.");
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleSimulateSandboxUpi(orderId: string) {
    setSubmittingId(orderId);
    setError("");
    setFeedback("");
    try {
      const res = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          simulateSandboxCapture: true,
          method: "upi",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to capture Sandbox UPI payment.");
      }
      setFeedback(
        `Sandbox UPI captured for ${orderId} (${data.transaction?.providerPaymentId || "pay_sbx"}).`,
      );
      await loadOrders();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Sandbox UPI capture failed.",
      );
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <AppShell
      title="Live Orders"
      subtitle={`${filteredOrders.length} of ${orders.length} tickets`}
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
            onClick={() => setInjectOpen(true)}
            className="inline-flex h-7 items-center rounded-md bg-zinc-100 px-2.5 text-[11px] font-semibold text-zinc-950 transition-colors hover:bg-white"
          >
            + Test Order
          </button>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="inline-flex h-7 items-center rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-white/[0.16] hover:text-zinc-100"
          >
            Refresh
          </button>
        </>
      }
    >
      <Suspense fallback={null}>
        <SearchParamCoordinator
          onSelectOrder={openLinkedOrder}
          onOpenInject={openInjectDrawer}
          onSelectStatus={applyStatusFilter}
        />
      </Suspense>

      {/* Master-Detail Full-Bleed Split Workspace */}
      <div className="flex min-h-[calc(100vh-44px)] flex-1">
        {/* LEFT: Filterable, Keyboard-Navigable Hairline Order List (~58%) */}
        <section
          aria-label="Orders inbox"
          className="flex min-w-0 flex-1 flex-col bg-[#0e0e11]"
        >
          {/* Plain-English Status Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-[#09090b]/60 px-4 py-2">
            <div
              role="tablist"
              aria-label="Order status filter"
              className="flex flex-wrap items-center rounded-md border border-white/[0.06] bg-[#151519] p-0.5"
            >
              {STATUS_TABS.map((tab) => {
                const active = statusFilter === tab.value;
                const count =
                  tab.value === "ALL"
                    ? orders.length
                    : orders.filter((o) => o.status === tab.value).length;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => applyStatusFilter(tab.value)}
                    className={`inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? "bg-[#27272e] text-zinc-100"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="font-mono text-[10px] text-zinc-500 tabular-nums">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <span className="hidden font-mono text-[10px] text-zinc-500 xl:inline">
              ↑/↓ navigate
            </span>
          </div>

          {/* Compact Inline Search & Secondary Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-[#09090b]/40 px-4 py-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search #ORD, customer, external ID, item..."
              className="h-7 min-w-[200px] flex-1 rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-white/[0.2]"
            />

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

            <select
              aria-label="Filter channel"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="h-7 rounded-md border border-white/[0.08] bg-[#151519] px-2 text-[11px] text-zinc-200 outline-none focus:border-white/[0.2]"
            >
              <option value="ALL">All Channels</option>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}

          {feedback && (
            <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200">
              {feedback}
            </div>
          )}

          {/* Hairline Inbox Rows */}
          <div className="flex-1 divide-y divide-white/[0.06] overflow-y-auto">
            {loading && orders.length === 0 ? (
              <div className="px-4 py-12 text-center text-xs text-zinc-500">
                Loading orders...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-sm font-medium text-zinc-300">
                  No orders match current filters
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Use &ldquo;+ Test Order&rdquo; or clear active filters.
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                const isFlashed = flashedIds.has(order.id);
                const isActiveStage =
                  order.status === "PENDING" ||
                  order.status === "PREPARING" ||
                  order.status === "READY_FOR_PICKUP";

                return (
                  <div
                    key={order.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedOrderId(order.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedOrderId(order.id);
                      }
                    }}
                    className={`group flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-xs transition-colors ${
                      isFlashed ? "animate-row-flash" : ""
                    } ${
                      isSelected
                        ? "bg-[#151519] text-zinc-100"
                        : "hover:bg-[#151519]/60"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[order.status]}`}
                        />
                        <span className="font-mono text-xs font-semibold text-zinc-100 tabular-nums">
                          {order.id}
                        </span>
                        {order.priority && order.priority !== "NORMAL" && (
                          <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-rose-300">
                            {order.priority}
                          </span>
                        )}
                        <span className="rounded bg-[#1d1d22] px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                          {order.kitchenId}
                        </span>
                        <span className="text-[11px] font-medium text-zinc-300">
                          {order.channel}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {order.brandId} · {order.customerName || "Walk-In"}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-400">
                        <span className="truncate">
                          {order.items
                            .map((i) => `${i.quantity}x ${i.name}`)
                            .join(", ")}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                      {isActiveStage && (
                        <div className="hidden sm:block">
                          <KitchenSlaBadge
                            orderId={order.id}
                            anchorIso={
                              order.prepStartedAt ??
                              order.receivedAt ??
                              order.createdAt
                            }
                            slaMinutes={prepSlaMinutes}
                          />
                        </div>
                      )}

                      <span
                        className={`hidden rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium md:inline-block ${STATUS_BADGE[order.status]}`}
                      >
                        {order.status.replaceAll("_", " ")}
                      </span>

                      <div className="w-20 text-right font-mono tabular-nums">
                        <p className="text-xs font-semibold text-zinc-100">
                          {fmt(order.totalAmount ?? 0)}
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          {formatTime(order.receivedAt || order.createdAt)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setKotOrder(order);
                        }}
                        className="h-7 rounded-md border border-white/[0.08] bg-[#1d1d22] px-2 font-mono text-[10px] font-medium text-zinc-300 opacity-80 transition-colors hover:border-white/[0.2] hover:text-zinc-100 group-hover:opacity-100"
                        title="Print 80mm KOT"
                      >
                        KOT
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* RIGHT: Docked 440px SplitInspector (Mobile Slide-Over Sheet) */}
        <SplitInspector
          open={Boolean(selectedOrder)}
          mode="docked"
          widthClassName="lg:w-[440px]"
          title={selectedOrder ? selectedOrder.id : "Order Inspector"}
          subtitle={
            selectedOrder
              ? `${selectedOrder.brandId} · ${selectedOrder.kitchenId} · ${selectedOrder.channel}`
              : undefined
          }
          badge={
            selectedOrder ? (
              <span
                className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium ${STATUS_BADGE[selectedOrder.status]}`}
              >
                {selectedOrder.status.replaceAll("_", " ")}
              </span>
            ) : undefined
          }
          onClose={() => setSelectedOrderId(null)}
          footer={
            selectedOrder ? (
              <div className="flex flex-wrap items-center gap-2">
                {selectedOrder.status === "PENDING" && (
                  <button
                    type="button"
                    disabled={submittingId === selectedOrder.id}
                    onClick={() =>
                      void handleTransition(selectedOrder.id, "PREPARING")
                    }
                    className="h-8 flex-1 rounded-md bg-zinc-100 px-3 text-xs font-semibold text-zinc-950 transition-colors hover:bg-white disabled:opacity-50"
                  >
                    Start Prep
                  </button>
                )}
                {selectedOrder.status === "PREPARING" && (
                  <button
                    type="button"
                    disabled={submittingId === selectedOrder.id}
                    onClick={() =>
                      void handleTransition(
                        selectedOrder.id,
                        "READY_FOR_PICKUP",
                      )
                    }
                    className="h-8 flex-1 rounded-md bg-emerald-500 px-3 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
                  >
                    Mark Ready
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setKotOrder(selectedOrder)}
                  className="h-8 rounded-md border border-white/[0.1] bg-[#151519] px-3 text-xs font-medium text-zinc-200 transition-colors hover:border-white/[0.2] hover:text-white"
                >
                  Print 80mm KOT
                </button>
                <Link
                  href={`/invoices?order=${encodeURIComponent(selectedOrder.id)}`}
                  className="inline-flex h-8 items-center rounded-md border border-white/[0.1] bg-[#151519] px-3 text-xs font-medium text-zinc-300 transition-colors hover:border-white/[0.2] hover:text-white"
                >
                  GST Bill
                </Link>
              </div>
            ) : undefined
          }
        >
          {selectedOrder && (
            <div className="space-y-4">
              {/* Item BOM */}
              <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2 text-[11px] font-medium text-zinc-400">
                  <span>Order Items ({selectedOrder.items.length})</span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {selectedOrder.externalOrderId || "Internal"}
                  </span>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {selectedOrder.items.map((item, idx) => (
                    <div
                      key={item.id || `${selectedOrder.id}-${idx}`}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-100">
                          <span className="mr-1.5 font-mono text-zinc-400 tabular-nums">
                            {item.quantity}x
                          </span>
                          {item.name}
                        </p>
                        {item.notes && (
                          <p className="mt-0.5 text-[11px] text-amber-300">
                            {item.notes}
                          </p>
                        )}
                      </div>
                      <span className="ml-2 shrink-0 rounded bg-[#1d1d22] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                        {item.station}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.06] text-xs">
                <div className="bg-[#151519] p-2.5">
                  <p className="text-[10px] font-medium text-zinc-500">
                    Inventory
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-emerald-300">
                    {selectedOrder.inventoryDecision || "AVAILABLE"} (
                    {selectedOrder.inventoryConsumed ? "Depleted" : "Pending"})
                  </p>
                </div>
                <div className="bg-[#151519] p-2.5">
                  <p className="text-[10px] font-medium text-zinc-500">
                    Courier / Rider
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-zinc-200">
                    {selectedOrder.driverName || "Unassigned"}
                  </p>
                </div>
                <div className="bg-[#151519] p-2.5">
                  <p className="text-[10px] font-medium text-zinc-500">
                    Aggregator Sync
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-zinc-300">
                    {selectedOrder.aggregatorSyncStatus || "LOCAL_ONLY"}
                  </p>
                </div>
                <div className="bg-[#151519] p-2.5">
                  <p className="text-[10px] font-medium text-zinc-500">
                    Loss / Claim
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-amber-300 tabular-nums">
                    {fmt(selectedOrder.lossAmount ?? 0)} /{" "}
                    {fmt(selectedOrder.claimAmount ?? 0)}
                  </p>
                </div>
              </div>

              {/* Indian GST Breakup & Razorpay Payment */}
              <div className="rounded-lg border border-white/[0.06] bg-[#151519] p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-200">
                    GST &amp; Razorpay Payment
                  </span>
                  <span
                    className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium ${
                      PAYMENT_STATUS_BADGE[
                        selectedOrder.paymentStatus ?? "AGGREGATOR_SETTLED"
                      ]
                    }`}
                  >
                    {(
                      selectedOrder.paymentStatus ?? "AGGREGATOR_SETTLED"
                    ).replaceAll("_", " ")}
                  </span>
                </div>

                <div className="mt-2.5 space-y-1 font-mono text-[11px] text-zinc-400 tabular-nums">
                  <div className="flex justify-between">
                    <span>Taxable Subtotal</span>
                    <span className="text-zinc-200">
                      {fmt(
                        selectedOrder.subtotalAmount ??
                          selectedOrder.totalAmount ??
                          0,
                      )}
                    </span>
                  </div>
                  {(selectedOrder.igstAmount ?? 0) > 0 ? (
                    <div className="flex justify-between text-cyan-300">
                      <span>IGST (5%)</span>
                      <span>{fmt(selectedOrder.igstAmount ?? 0)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-emerald-300">
                      <span>CGST (2.5%) + SGST (2.5%)</span>
                      <span>
                        {fmt(selectedOrder.cgstAmount ?? 0)} +{" "}
                        {fmt(selectedOrder.sgstAmount ?? 0)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-white/[0.06] pt-1.5 text-xs font-semibold text-zinc-100">
                    <span>Grand Total (INR)</span>
                    <span>{fmt(selectedOrder.totalAmount ?? 0)}</span>
                  </div>
                </div>

                {(selectedOrder.source === "DIRECT_WEB" ||
                  selectedOrder.channel === "Direct Web") &&
                  selectedOrder.status !== "CANCELLED" &&
                  (selectedOrder.paymentStatus === "UNPAID" ||
                    selectedOrder.paymentStatus === "PENDING") && (
                    <button
                      type="button"
                      disabled={submittingId === selectedOrder.id}
                      onClick={() =>
                        void handleSimulateSandboxUpi(selectedOrder.id)
                      }
                      className="mt-3 h-8 w-full rounded-md bg-emerald-500 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {submittingId === selectedOrder.id
                        ? "Capturing UPI..."
                        : "Simulate Sandbox UPI Capture"}
                    </button>
                  )}
              </div>

              {/* Stage-Aware Cancellation Panel */}
              <div className="rounded-lg border border-rose-500/25 bg-rose-500/[0.04] p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-rose-300">
                    Stage-Aware Cancellation
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400">
                    {selectedOrder.status === "PENDING"
                      ? "BEFORE_PREP"
                      : selectedOrder.status === "PREPARING" ||
                          selectedOrder.status === "READY_FOR_PICKUP" ||
                          selectedOrder.status === "DRIVER_ASSIGNED"
                        ? "DURING_OR_AFTER_PREP"
                        : selectedOrder.status === "PICKED_UP" ||
                            selectedOrder.status === "DISPATCHED"
                          ? "AFTER_PICKUP"
                          : selectedOrder.cancellationStage || "CANCELLED"}
                  </span>
                </div>

                <p className="mt-1 text-[11px] text-zinc-400">
                  {selectedOrder.status === "PENDING"
                    ? "Cancelling before prep restores stock and issues a GST credit note."
                    : selectedOrder.status === "PREPARING" ||
                        selectedOrder.status === "READY_FOR_PICKUP" ||
                        selectedOrder.status === "DRIVER_ASSIGNED"
                      ? "Cancelling mid/post-prep logs irreversible food and labor loss."
                      : selectedOrder.status === "PICKED_UP" ||
                          selectedOrder.status === "DISPATCHED"
                        ? "Post-pickup cancellation files an aggregator claim with handoff proof."
                        : `Resolved: ${selectedOrder.cancellationResolution ?? "CANCELLED"}`}
                </p>

                {selectedOrder.status !== "CANCELLED" ? (
                  <div className="mt-2.5 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={cancelSource}
                        onChange={(e) =>
                          setCancelSource(e.target.value as CancellationSource)
                        }
                        className="h-7 rounded-md border border-white/[0.08] bg-[#151519] px-2 text-[11px] text-zinc-200"
                      >
                        <option value="CUSTOMER">CUSTOMER</option>
                        <option value="AGGREGATOR">AGGREGATOR</option>
                        <option value="KITCHEN">KITCHEN</option>
                        <option value="MANUAL">MANUAL</option>
                      </select>

                      {selectedOrder.status === "PENDING" && (
                        <label className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                          <input
                            type="checkbox"
                            checked={restorePrePrep}
                            onChange={(e) =>
                              setRestorePrePrep(e.target.checked)
                            }
                          />
                          Restore Stock
                        </label>
                      )}
                    </div>

                    <input
                      type="text"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Cancellation reason..."
                      className="h-7 w-full rounded-md border border-white/[0.08] bg-[#151519] px-2.5 text-[11px] text-zinc-200"
                    />

                    <button
                      type="button"
                      disabled={submittingId === selectedOrder.id}
                      onClick={() =>
                        void handleTransition(selectedOrder.id, "CANCELLED", {
                          cancellationSource: cancelSource,
                          cancellationReason: cancelReason,
                          restoreInventoryOnPrePrepCancel: restorePrePrep,
                        })
                      }
                      className="h-8 w-full rounded-md border border-rose-500/40 bg-rose-500/20 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-500/30 disabled:opacity-50"
                    >
                      {submittingId === selectedOrder.id
                        ? "Cancelling..."
                        : `Cancel Order (${selectedOrder.status})`}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={submittingId === selectedOrder.id}
                    onClick={() =>
                      void handleTransition(selectedOrder.id, "CANCELLED")
                    }
                    className="mt-2.5 h-7 w-full rounded-md border border-amber-500/35 bg-amber-500/10 text-[11px] font-medium text-amber-200 hover:bg-amber-500/20"
                  >
                    Verify Idempotent Repeat Cancellation
                  </button>
                )}
              </div>

              {/* Immutable Event Timeline */}
              <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#151519]">
                <div className="border-b border-white/[0.06] px-3 py-2 text-[11px] font-medium text-zinc-400">
                  Order History ({selectedOrder.events.length})
                </div>
                <div className="max-h-56 divide-y divide-white/[0.06] overflow-y-auto">
                  {selectedOrder.events.map((ev) => (
                    <div key={ev.id} className="px-3 py-2 text-xs">
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="font-semibold text-zinc-200">
                          {ev.type}
                        </span>
                        <span className="text-zinc-500 tabular-nums">
                          {formatTime(ev.timestamp)}
                        </span>
                      </div>
                      {ev.details && (
                        <p className="mt-0.5 text-[11px] text-zinc-400">
                          {ev.details}
                        </p>
                      )}
                      <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                        {ev.actor}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SplitInspector>
      </div>

      {/* Slide-Over Order Injection Drawer */}
      <SplitInspector
        open={injectOpen}
        mode="overlay"
        widthClassName="max-w-[740px]"
        title="Simulate Incoming Order"
        subtitle="Swiggy, Zomato, Direct Web UPI & UrbanPiper webhook simulator"
        onClose={() => {
          setInjectOpen(false);
          void loadOrders();
        }}
      >
        <OrderSimulationPanel />
      </SplitInspector>

      <KotPrintTicketModal
        order={kotOrder}
        onClose={() => setKotOrder(null)}
        onPrinted={({ orderId, printJobId, mode }) =>
          setFeedback(
            `80mm KOT printed for ${orderId} via ${mode} (Job ${printJobId}).`,
          )
        }
      />
    </AppShell>
  );
}
