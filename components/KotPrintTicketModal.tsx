"use client";

import { useMemo, useState } from "react";
import { BRANDS_DB, KITCHENS_DB, type Order } from "@/lib/db";
import {
  buildKotTicketData,
  renderEscPosTextPayload,
} from "@/lib/kot-format";

interface KotPrintTicketModalProps {
  order: Order | null;
  onClose: () => void;
  onPrinted?: (info: {
    orderId: string;
    printJobId: string;
    mode: string;
  }) => void;
}

export default function KotPrintTicketModal({
  order,
  onClose,
  onPrinted,
}: KotPrintTicketModalProps) {
  const [sendingBridge, setSendingBridge] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRawEscPos, setShowRawEscPos] = useState(false);

  const { ticket, escPosPayload } = useMemo(() => {
    if (!order) {
      return { ticket: null, escPosPayload: "" };
    }
    const kitchen = KITCHENS_DB.find((k) => k.id === order.kitchenId) ?? null;
    const brand = BRANDS_DB.find((b) => b.id === order.brandId) ?? null;
    const built = buildKotTicketData({ order, kitchen, brand });
    return {
      ticket: built,
      escPosPayload: renderEscPosTextPayload(built),
    };
  }, [order]);

  if (!order || !ticket) return null;

  function handleBrowserPrint() {
    setErrorMessage(null);
    document.body.classList.add("kot-printing");
    const cleanup = () => {
      document.body.classList.remove("kot-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 1500);
    setStatusMessage("Browser 80mm thermal print dialog opened.");
  }

  async function handleSendToLanBridge() {
    if (!order) return;
    setSendingBridge(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/hardware/kot/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to dispatch KOT print job.");
      }
      setStatusMessage(
        `Sent to ${data.mode} • Job ID: ${data.printJobId} (logged to Hardware Audit Feed).`,
      );
      onPrinted?.({
        orderId: order.id,
        printJobId: data.printJobId,
        mode: data.mode,
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "LAN print dispatch failed.",
      );
    } finally {
      setSendingBridge(false);
    }
  }

  async function handleCopyEscPos() {
    try {
      await navigator.clipboard.writeText(escPosPayload);
      setStatusMessage("42-column ESC/POS payload copied to clipboard.");
      setErrorMessage(null);
    } catch {
      setErrorMessage("Clipboard access unavailable in this browser.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="80mm Thermal KOT Preview"
    >
      <div className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-sky-400">
              80mm Thermal KOT • ESC/POS Bridge
            </span>
            <h2 className="mt-0.5 text-lg font-black text-white">
              Print Kitchen Order Ticket — {ticket.orderId}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 font-mono text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            ✕ Close
          </button>
        </div>

        {statusMessage && (
          <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-200">
            {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2 text-xs font-medium text-red-200">
            {errorMessage}
          </div>
        )}

        <div className="mt-4 grid gap-5 md:grid-cols-[316px_1fr]">
          {/* 80mm Thermal Receipt Preview */}
          <div className="flex justify-center">
            <div
              id="kot-thermal-print-area"
              className="w-[302px] rounded-xl border border-slate-300 bg-white p-4 font-mono text-[11px] leading-snug text-slate-950 shadow-lg"
            >
              <div className="text-center border-b-2 border-dashed border-slate-900 pb-2">
                <p className="text-xs font-black tracking-wide">
                  DARKITOS 80MM KOT
                </p>
                <p className="font-bold">
                  {ticket.brandName.toUpperCase()} ({ticket.kitchenCode})
                </p>
                <p className="text-[10px] text-slate-700">
                  {ticket.kitchenName}
                </p>
              </div>

              <div className="mt-2 space-y-0.5 border-b border-dashed border-slate-900 pb-2 text-[10px]">
                <div className="flex justify-between font-bold text-[11px]">
                  <span>ORDER: {ticket.orderId}</span>
                  <span>[{ticket.channel.toUpperCase()}]</span>
                </div>
                {ticket.externalOrderId && (
                  <div className="flex justify-between">
                    <span>EXT REF:</span>
                    <span className="font-bold">{ticket.externalOrderId}</span>
                  </div>
                )}
                {ticket.priority !== "NORMAL" && (
                  <div className="mt-1 bg-slate-900 px-2 py-0.5 text-center font-black text-white">
                    *** PRIORITY: {ticket.priority} ***
                  </div>
                )}
                <div className="flex justify-between">
                  <span>GUEST:</span>
                  <span>{ticket.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>TIME:</span>
                  <span>{ticket.istTimestamp}</span>
                </div>
              </div>

              <div className="mt-2 space-y-2 border-b border-dashed border-slate-900 pb-2">
                {ticket.stations.map((group) => (
                  <div key={group.station}>
                    <p className="bg-slate-200 px-1.5 py-0.5 text-[10px] font-black uppercase">
                      STATION: {group.station}
                    </p>
                    <div className="mt-1 space-y-1">
                      {group.items.map((item, idx) => (
                        <div key={`${group.station}-${idx}`}>
                          <div className="flex justify-between font-bold">
                            <span>
                              {item.quantity}x {item.name}
                            </span>
                            <span>₹{item.lineTotal.toFixed(0)}</span>
                          </div>
                          {item.notes && (
                            <p className="pl-3 text-[10px] italic text-slate-700">
                              * {item.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {ticket.orderNotes && (
                <div className="mt-2 border-b border-dashed border-slate-900 pb-2 text-[10px]">
                  <span className="font-bold">ORDER NOTE: </span>
                  {ticket.orderNotes}
                </div>
              )}

              <div className="mt-2 space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>SUBTOTAL ({ticket.itemCount} items)</span>
                  <span>{ticket.formattedSubtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST (5%)</span>
                  <span>{ticket.formattedGst}</span>
                </div>
                <div className="flex justify-between border-t border-slate-900 pt-1 text-xs font-black">
                  <span>TOTAL</span>
                  <span>{ticket.formattedTotal}</span>
                </div>
              </div>

              <p className="mt-3 text-center text-[9px] font-bold tracking-wider text-slate-600">
                --- CHECK TAMPER SEAL &amp; DISPATCH ---
              </p>
            </div>
          </div>

          {/* Print Actions & ESC/POS Inspector */}
          <div className="flex flex-col justify-between gap-3">
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleBrowserPrint}
                className="w-full rounded-xl bg-sky-500 px-4 py-3 font-mono text-xs font-black text-slate-950 hover:bg-sky-400"
              >
                🖨 Print 80mm Thermal (Browser)
              </button>

              <button
                type="button"
                disabled={sendingBridge}
                onClick={() => void handleSendToLanBridge()}
                className="w-full rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-4 py-3 font-mono text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
              >
                {sendingBridge
                  ? "Dispatching to LAN Bridge..."
                  : "⚡ Send to LAN ESC-POS Bridge"}
              </button>

              <button
                type="button"
                onClick={() => void handleCopyEscPos()}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 font-mono text-xs font-bold text-slate-200 hover:bg-slate-700"
              >
                📋 Copy 42-Col ESC-POS Payload
              </button>

              <button
                type="button"
                onClick={() => setShowRawEscPos((prev) => !prev)}
                className="w-full text-left font-mono text-[11px] text-slate-400 underline underline-offset-2 hover:text-sky-300"
              >
                {showRawEscPos
                  ? "Hide raw ESC/POS command stream"
                  : "Inspect raw 42-col ESC/POS stream"}
              </button>

              {showRawEscPos && (
                <pre className="max-h-56 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[10px] leading-relaxed text-emerald-300">
                  {escPosPayload}
                </pre>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-[11px] text-slate-400">
              Browser print uses dedicated{" "}
              <code className="text-slate-200">@media print</code> 80mm thermal
              CSS rules. Configure{" "}
              <code className="text-sky-300">KOT_BRIDGE_URL</code> for zero-click
              LAN printer relays.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
