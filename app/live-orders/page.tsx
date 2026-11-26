"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import RealtimeSyncBadge from "@/components/RealtimeSyncBadge";
import { useRealtimeKitchenSync } from "@/hooks/useRealtimeKitchenSync";
import { formatCurrency, type SupportedCurrency } from "@/lib/currency";
import {
  BRANDS_DB,
  KITCHENS_DB,
  type CancellationSource,
  type Employee,
  type Order,
  type OrderChannel,
  type OrderPaymentStatus,
  type OrderStatus,
  type SystemSettings,
} from "@/lib/db";

const PAYMENT_STATUS_BADGE: Record<OrderPaymentStatus, string> = {
  CAPTURED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  AGGREGATOR_SETTLED: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  PENDING: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  UNPAID: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  REFUNDED: "border-purple-500/40 bg-purple-500/10 text-purple-300",
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

const STATUS_BADGE: Record<
  OrderStatus,
  string
> = {
  PENDING:
    "border-amber-500/40 bg-amber-500/10 text-amber-300",
  PREPARING:
    "border-sky-500/40 bg-sky-500/10 text-sky-300",
  READY_FOR_PICKUP:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  DRIVER_ASSIGNED:
    "border-purple-500/40 bg-purple-500/10 text-purple-300",
  PICKED_UP:
    "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
  DISPATCHED:
    "border-teal-500/40 bg-teal-500/10 text-teal-300",
  CANCELLED:
    "border-red-500/40 bg-red-500/10 text-red-300",
};

function formatTime(value?: string): string {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function OpenLinkedOrder({ onSelect }: { onSelect: (id: string | null) => void }) {
  const orderId = useSearchParams().get("order");
  useEffect(() => onSelect(orderId), [orderId, onSelect]);
  return null;
}

export default function LiveOrdersPage() {
  const [orders, setOrders] = useState<Order[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [currency, setCurrency] =
    useState<SupportedCurrency>("INR");
  const [currentEmployee, setCurrentEmployee] =
    useState<Employee | null>(null);

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
        if (data.employee) setCurrentEmployee(data.employee as Employee);
      })
      .catch(() => {
        // ignore transient error
      });
    const onSettingsUpdated = (event: Event) => {
      const custom = event as CustomEvent<SystemSettings>;
      if (custom.detail?.currency) setCurrency(custom.detail.currency);
    };
    window.addEventListener("darkit:settings-updated", onSettingsUpdated);
    return () => {
      active = false;
      window.removeEventListener("darkit:settings-updated", onSettingsUpdated);
    };
  }, []);

  const [statusFilter, setStatusFilter] =
    useState<string>("ALL");
  const [brandFilter, setBrandFilter] =
    useState<string>("ALL");
  const [kitchenFilter, setKitchenFilter] =
    useState<string>("ALL");
  const [channelFilter, setChannelFilter] =
    useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] =
    useState<string | null>(null);
  const openLinkedOrder = useCallback((id: string | null) => {
    setSearch(id ?? "");
    setSelectedOrderId(id);
  }, []);

  const [cancelReason, setCancelReason] =
    useState(
      "Customer requested cancellation via aggregator support",
    );
  const [cancelSource, setCancelSource] =
    useState<CancellationSource>("CUSTOMER");
  const [restorePrePrep, setRestorePrePrep] =
    useState(true);
  const [submittingId, setSubmittingId] =
    useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            "Unable to load canonical orders.",
        );
      }
      const list = Array.isArray(data.orders)
        ? (data.orders as Order[])
        : [];
      setOrders(list);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load orders.",
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

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (
        statusFilter !== "ALL" &&
        o.status !== statusFilter
      )
        return false;
      if (
        brandFilter !== "ALL" &&
        o.brandId !== brandFilter
      )
        return false;
      if (
        kitchenFilter !== "ALL" &&
        o.kitchenId !== kitchenFilter
      )
        return false;
      if (
        channelFilter !== "ALL" &&
        o.channel !== channelFilter
      )
        return false;
      if (q) {
        const match =
          o.id.toLowerCase().includes(q) ||
          (o.customerName || "")
            .toLowerCase()
            .includes(q) ||
          (o.externalOrderId || "")
            .toLowerCase()
            .includes(q) ||
          o.items.some((i) =>
            i.name.toLowerCase().includes(q),
          );
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

  const selectedOrder = useMemo(
    () =>
      orders.find(
        (o) => o.id === selectedOrderId,
      ) || null,
    [orders, selectedOrderId],
  );

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          action: nextStatus,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            "Status transition rejected.",
        );
      }

      if (data.idempotentReplay) {
        setFeedback(
          `Idempotency Verified: Order ${orderId} is already in ${nextStatus} state. No duplicate restoration, loss, or claim was recorded.`,
        );
      } else if (nextStatus === "CANCELLED") {
        const rec = data.cancellationRecord;
        const cnNote = data.creditNoteInvoice
          ? ` • GST Invoice ${data.creditNoteInvoice.invoiceNumber} -> CREDIT_NOTE`
          : "";
        const refundNote = data.refundTransaction
          ? ` • Auto-Refund ${data.refundTransaction.providerRefundId} (${fmt(data.refundTransaction.refundedAmount)})`
          : "";
        setFeedback(
          `Order ${orderId} cancelled (${rec?.stage || "STAGE"}) → Resolution: ${rec?.resolution || "PROCESSED"} • Loss: ${fmt(rec?.financialLoss ?? 0)} • Claim: ${fmt(rec?.claimAmount ?? 0)}${cnNote}${refundNote}.`,
        );
      } else {
        setFeedback(
          `Order ${orderId} transitioned to ${nextStatus}.`,
        );
      }
      await loadOrders();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Transition failed.",
      );
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
        `Sandbox UPI Payment Captured for ${orderId} (${data.transaction?.providerPaymentId || "pay_sbx"}) — Razorpay HMAC verified.`,
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
      subtitle="Find orders by number, see where each one is in the kitchen, and review changes or cancellations."
      actions={
        <>
          <RealtimeSyncBadge
            connectionMode={realtimeSync.connectionMode}
            lastEventAt={realtimeSync.lastEventAt}
            topic={realtimeSync.topic}
          />
          <Link
            href="/order-injection"
            className="rounded-xl bg-sky-500 px-3.5 py-2 font-mono text-xs font-bold text-slate-950 hover:bg-sky-400"
          >
            Add sample order
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
      <Suspense fallback={null}>
        <OpenLinkedOrder onSelect={openLinkedOrder} />
      </Suspense>
      <div className="space-y-6">
        {/* Order filters */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block">
              <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
                Search by order number, meal, or customer
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="ORD-901, Smash, Aarav..."
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-sky-400"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
                Lifecycle Status
              </span>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value)
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-sky-400"
              >
                <option value="ALL">
                  All Statuses ({orders.length})
                </option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
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
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-sky-400"
              >
                <option value="ALL">
                  All Brands
                </option>
                {BRANDS_DB.map((b) => (
                  <option
                    key={b.id}
                    value={b.id}
                  >
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
                Physical Kitchen
              </span>
              <select
                value={kitchenFilter}
                onChange={(e) =>
                  setKitchenFilter(
                    e.target.value,
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-sky-400"
              >
                <option value="ALL">
                  All Kitchens
                </option>
                {KITCHENS_DB.map((k) => (
                  <option
                    key={k.id}
                    value={k.id}
                  >
                    {k.id} • {k.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
                Channel
              </span>
              <select
                value={channelFilter}
                onChange={(e) =>
                  setChannelFilter(
                    e.target.value,
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-sky-400"
              >
                <option value="ALL">
                  All Channels
                </option>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-300">
            ⚠ {error}
          </div>
        )}

        {feedback && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-mono text-xs text-emerald-300">
            ✓ {feedback}
          </div>
        )}

        {/* Main Split: Order Cards Grid & Detailed Inspector Drawer */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className="space-y-3">
            {loading && orders.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center font-mono text-sm text-slate-400">
                Loading canonical orders...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center">
                <p className="text-lg font-bold text-white">
                  No active orders match current filters
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Add a sample order or adjust your filters to see more orders.
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isSelected =
                  selectedOrder?.id === order.id;
                return (
                  <article
                    key={order.id}
                    onClick={() =>
                      setSelectedOrderId(
                        order.id,
                      )
                    }
                    className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                      isSelected
                        ? "border-sky-500 bg-slate-900 shadow-[0_0_25px_rgba(14,165,233,0.15)]"
                        : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-black text-white">
                            {order.id}
                          </span>
                          {order.priority &&
                            order.priority !==
                              "NORMAL" && (
                              <span className="rounded bg-red-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-red-300">
                                {order.priority}
                              </span>
                            )}
                          <span className="font-mono text-xs text-sky-400">
                            {order.brandId}
                          </span>
                          <span className="font-mono text-xs text-slate-400">
                            • {order.kitchenId} •{" "}
                            {order.channel}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          Guest:{" "}
                          <strong className="text-slate-200">
                            {order.customerName ||
                              "Walk-In"}
                          </strong>{" "}
                          • Ext:{" "}
                          {order.externalOrderId ||
                            "--"}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${STATUS_BADGE[order.status]}`}
                          >
                            {order.status.replaceAll(
                              "_",
                              " ",
                            )}
                          </span>
                          <span
                            className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${
                              PAYMENT_STATUS_BADGE[
                                order.paymentStatus ?? "AGGREGATOR_SETTLED"
                              ]
                            }`}
                          >
                            {(
                              order.paymentStatus ?? "AGGREGATOR_SETTLED"
                            ).replaceAll("_", " ")}
                          </span>
                          {order.aggregatorSyncStatus && (
                            <span
                              className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${
                                order.aggregatorSyncStatus === "SYNC_FAILED"
                                  ? "border-red-500/40 bg-red-500/10 text-red-300"
                                  : order.aggregatorSyncStatus ===
                                      "OUTBOX_QUEUED"
                                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              }`}
                            >
                              {order.aggregatorSyncStatus === "SYNC_FAILED"
                                ? "SYNC FAILED"
                                : order.aggregatorSyncStatus === "OUTBOX_QUEUED"
                                  ? "OUTBOX QUEUED"
                                  : "AGGREGATOR SYNCED"}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-mono text-sm font-bold text-emerald-400">
                          {fmt(order.totalAmount ?? 0)}
                          {typeof order.taxAmount === "number" &&
                            order.taxAmount > 0 && (
                              <span className="ml-1.5 text-[10px] font-normal text-slate-400">
                                (incl. GST {fmt(order.taxAmount)})
                              </span>
                            )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {order.items.map(
                        (item, idx) => (
                          <span
                            key={
                              item.id ||
                              `${order.id}-${idx}`
                            }
                            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs text-slate-200"
                          >
                            <strong>
                              {item.quantity}×
                            </strong>{" "}
                            {item.name}{" "}
                            <span className="font-mono text-[10px] text-slate-400">
                              ({item.station})
                            </span>
                          </span>
                        ),
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5 font-mono text-[11px] text-slate-400">
                      <span>
                        Received:{" "}
                        {formatTime(
                          order.receivedAt ||
                            order.createdAt,
                        )}
                      </span>
                      <span>
                        Events:{" "}
                        {order.events.length}
                      </span>
                      <button type="button" aria-label={`View details for ${order.id}`} aria-controls="order-details" className="rounded font-bold text-sky-300 hover:underline focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-sky-400">
                        View order details →
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>

          {/* Right: Order Event Timeline & Stage-Aware Cancellation Inspector */}
          <aside id="order-details" aria-label="Order details" className="h-fit rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 lg:sticky lg:top-20">
            {!selectedOrder ? (
              <div className="py-16 text-center">
                <p className="font-mono text-sm font-bold text-slate-300">
                  Select an order to see its details
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  You’ll see what’s happened so far, ingredients used, and pickup details.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="font-mono text-xs font-bold uppercase text-sky-400">
                      Order details
                    </span>
                    <h2 className="mt-0.5 font-mono text-2xl font-black text-white">
                      {selectedOrder.id}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {selectedOrder.brandId} •{" "}
                      {selectedOrder.kitchenId} •{" "}
                      {selectedOrder.channel}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 font-mono text-xs font-bold ${STATUS_BADGE[selectedOrder.status]}`}
                  >
                    {selectedOrder.status.replaceAll(
                      "_",
                      " ",
                    )}
                  </span>
                </div>

                {(selectedOrder.status === "PENDING" || selectedOrder.status === "PREPARING") && (
                  <Link href="/kds" className="inline-flex rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400">
                    Continue on the Kitchen Board →
                  </Link>
                )}

                {/* Inventory & Dispatch Metadata */}
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-mono text-xs">
                  <div>
                    <span className="text-slate-500">
                      Inventory Status
                    </span>
                    <p className="mt-0.5 font-bold text-emerald-300">
                      {selectedOrder.inventoryDecision ||
                        "AVAILABLE"}{" "}
                      (
                      {selectedOrder.inventoryConsumed
                        ? "Depleted"
                        : "Not Yet Depleted"}
                      )
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">
                      Courier / Driver
                    </span>
                    <p className="mt-0.5 font-bold text-white">
                      {selectedOrder.driverName ||
                        "Unassigned"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">
                      Idempotency Key
                    </span>
                    <p className="mt-0.5 text-sky-300 truncate">
                      {selectedOrder.idempotencyKey ||
                        "--"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">
                      Loss / Claim
                    </span>
                    <p className="mt-0.5 text-amber-300">
                      Loss: {fmt(selectedOrder.lossAmount ?? 0)} • Claim:{" "}
                      {fmt(selectedOrder.claimAmount ?? 0)}
                    </p>
                  </div>
                </div>

                {/* Indian GST Tax Breakup & Razorpay Payment Status */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 font-mono text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold uppercase text-emerald-300">
                      Indian GST &amp; Payment Ledger
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
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
                  <div className="mt-2.5 space-y-1 text-[11px] text-slate-300">
                    <div className="flex justify-between">
                      <span>Taxable Subtotal</span>
                      <span>
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
                    <div className="flex justify-between border-t border-slate-800 pt-1.5 font-bold text-white">
                      <span>Grand Total (INR)</span>
                      <span>{fmt(selectedOrder.totalAmount ?? 0)}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/invoices?order=${encodeURIComponent(selectedOrder.id)}`}
                      className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-[11px] font-bold text-sky-300 hover:bg-sky-500/20"
                    >
                      View GST Tax Invoice →
                    </Link>
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
                          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                        >
                          {submittingId === selectedOrder.id
                            ? "Capturing UPI…"
                            : "⚡ Simulate Sandbox UPI Capture"}
                        </button>
                      )}
                  </div>
                </div>

                {/* Stage-Aware Cancellation Engine */}
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                  <p className="font-mono text-xs font-bold uppercase text-red-300">
                    Cancel order
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    {selectedOrder.status ===
                    "PENDING"
                      ? "Current Stage: BEFORE PREP → Cancelling now restores allocated stock (or logs unavoidable loss if already prepped)."
                      : selectedOrder.status ===
                            "PREPARING" ||
                          selectedOrder.status ===
                            "READY_FOR_PICKUP" ||
                          selectedOrder.status ===
                            "DRIVER_ASSIGNED"
                        ? "Current Stage: MID/POST PREP → Cancelling now records irreversible Food & Labor Loss (cooked food will NOT return to usable inventory)."
                        : selectedOrder.status ===
                              "PICKED_UP" ||
                            selectedOrder.status ===
                              "DISPATCHED"
                          ? "Current Stage: POST-PICKUP → Cancelling now logs an Aggregator / Accounting Claim with preserved courier handoff evidence."
                          : `Order already CANCELLED (${selectedOrder.cancellationStage} → ${selectedOrder.cancellationResolution}).`}
                  </p>

                  {selectedOrder.status !==
                  "CANCELLED" ? (
                    <div className="mt-3 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={cancelSource}
                          onChange={(e) =>
                            setCancelSource(
                              e.target
                                .value as CancellationSource,
                            )
                          }
                          className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white"
                        >
                          <option value="CUSTOMER">
                            Source: CUSTOMER
                          </option>
                          <option value="AGGREGATOR">
                            Source: AGGREGATOR
                          </option>
                          <option value="KITCHEN">
                            Source: KITCHEN
                          </option>
                          <option value="MANUAL">
                            Source: MANUAL
                          </option>
                        </select>

                        {selectedOrder.status ===
                          "PENDING" && (
                          <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={
                                restorePrePrep
                              }
                              onChange={(e) =>
                                setRestorePrePrep(
                                  e.target
                                    .checked,
                                )
                              }
                            />
                            Restore Usable Stock
                          </label>
                        )}
                      </div>

                      <input
                        type="text"
                        value={cancelReason}
                        onChange={(e) =>
                          setCancelReason(
                            e.target.value,
                          )
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                        placeholder="Cancellation reason..."
                      />

                      <button
                        type="button"
                        disabled={
                          submittingId ===
                          selectedOrder.id
                        }
                        onClick={() =>
                          void handleTransition(
                            selectedOrder.id,
                            "CANCELLED",
                            {
                              cancellationSource:
                                cancelSource,
                              cancellationReason:
                                cancelReason,
                              restoreInventoryOnPrePrepCancel:
                                restorePrePrep,
                            },
                          )
                        }
                        className="w-full rounded-xl bg-red-600 py-2.5 font-mono text-xs font-bold uppercase text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        {submittingId ===
                        selectedOrder.id
                          ? "Processing Cancellation..."
                          : `Cancel Order (${selectedOrder.status})`}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        submittingId ===
                        selectedOrder.id
                      }
                      onClick={() =>
                        void handleTransition(
                          selectedOrder.id,
                          "CANCELLED",
                        )
                      }
                      className="mt-3 w-full rounded-xl border border-amber-500/40 bg-amber-500/10 py-2 font-mono text-xs font-bold text-amber-300 hover:bg-amber-500/20"
                    >
                      ↺ Test Idempotent Repeat Cancellation
                    </button>
                  )}
                </div>

                {/* Immutable Event Timeline */}
                <div>
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                    Order history (
                    {selectedOrder.events.length})
                  </h3>
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {selectedOrder.events.map(
                      (ev) => (
                        <div
                          key={ev.id}
                          className="rounded-xl border border-slate-800 bg-slate-950 p-3"
                        >
                          <div className="flex items-center justify-between font-mono text-[11px]">
                            <span className="font-bold text-sky-400">
                              {ev.type}
                            </span>
                            <span className="text-slate-500">
                              {formatTime(
                                ev.timestamp,
                              )}
                            </span>
                          </div>
                          {ev.details && (
                            <p className="mt-1 text-xs text-slate-300">
                              {ev.details}
                            </p>
                          )}
                          <p className="mt-1 font-mono text-[10px] text-slate-500">
                            Actor: {ev.actor}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
