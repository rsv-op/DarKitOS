"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import {
  BRANDS_DB,
  KITCHENS_DB,
  type CancellationSource,
  type Order,
  type OrderChannel,
  type OrderStatus,
} from "@/lib/db";

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

export default function LiveOrdersPage() {
  const [orders, setOrders] = useState<Order[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

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
    const timer = window.setInterval(() => {
      void loadOrders();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadOrders]);

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
        setFeedback(
          `Order ${orderId} cancelled (${rec?.stage || "STAGE"}) → Resolution: ${rec?.resolution || "PROCESSED"} • Loss: $${(rec?.financialLoss ?? 0).toFixed(2)} • Claim: $${(rec?.claimAmount ?? 0).toFixed(2)}.`,
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

  return (
    <AppShell
      title="Global Order Monitor & Lifecycle Inspector"
      subtitle="Consume the canonical order store, filter across brands/kitchens/channels, inspect immutable event timelines, and execute stage-aware cancellations."
      actions={
        <>
          <Link
            href="/order-injection"
            className="rounded-xl bg-sky-500 px-3.5 py-2 font-mono text-xs font-bold text-slate-950 hover:bg-sky-400"
          >
            + Inject Order
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
        {/* Advanced Filtering Grid */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block">
              <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
                Search Order / Item / Guest
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
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
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
                  Inject a new order or clear your filter selection to view the pipeline.
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
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${STATUS_BADGE[order.status]}`}
                        >
                          {order.status.replaceAll(
                            "_",
                            " ",
                          )}
                        </span>
                        <p className="mt-1 font-mono text-sm font-bold text-emerald-400">
                          $
                          {(
                            order.totalAmount ??
                            0
                          ).toFixed(2)}
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
                      <span className="text-sky-400 font-bold">
                        Click to Inspect Timeline &
                        Actions →
                      </span>
                    </div>
                  </article>
                );
              })
            )}
          </section>

          {/* Right: Order Event Timeline & Stage-Aware Cancellation Inspector */}
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 h-fit sticky top-20">
            {!selectedOrder ? (
              <div className="py-16 text-center">
                <p className="font-mono text-sm font-bold text-slate-300">
                  Select any order card on the left
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Inspect its full immutable event timeline, recipe consumption ledger, dispatch evidence, and stage-aware cancellation controls.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="font-mono text-xs font-bold uppercase text-sky-400">
                      Canonical Order Aggregate
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
                      Loss: $
                      {(
                        selectedOrder.lossAmount ??
                        0
                      ).toFixed(2)}{" "}
                      • Claim: $
                      {(
                        selectedOrder.claimAmount ??
                        0
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Stage-Aware Cancellation Engine */}
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                  <p className="font-mono text-xs font-bold uppercase text-red-300">
                    Stage-Dependent Cancellation Engine
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
                    Immutable Order Event Timeline (
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
