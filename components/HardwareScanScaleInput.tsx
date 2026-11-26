"use client";

import { useMemo, useRef, useState } from "react";
import type { InventoryItem } from "@/lib/db";
import {
  parseScaleWeightReading,
  resolveScannedIngredient,
} from "@/lib/hardware-input";

interface HardwareScanScaleInputProps {
  kitchenId: string;
  inventory: InventoryItem[];
  disabled?: boolean;
  onCommitted: (message: string) => Promise<void> | void;
}

export default function HardwareScanScaleInput({
  kitchenId,
  inventory,
  disabled = false,
  onCommitted,
}: HardwareScanScaleInputProps) {
  const [mode, setMode] = useState<"RESTOCK" | "WASTE">("RESTOCK");
  const [scanInput, setScanInput] = useState("");
  const [scaleInput, setScaleInput] = useState("");
  const [reason, setReason] = useState("");
  const [matchedItem, setMatchedItem] = useState<InventoryItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const lastKeystrokeMs = useRef<number>(0);
  const burstChars = useRef<number>(0);
  const scaleFieldRef = useRef<HTMLInputElement | null>(null);

  const kitchenItems = useMemo(
    () =>
      inventory.filter((i) => !i.kitchenId || i.kitchenId === kitchenId),
    [inventory, kitchenId],
  );

  const parsedWeight = useMemo(() => {
    if (!scaleInput.trim()) return null;
    return parseScaleWeightReading(
      scaleInput,
      matchedItem?.unit ?? "kg",
    );
  }, [scaleInput, matchedItem]);

  function handleResolveScan(code: string) {
    const found = resolveScannedIngredient(code, kitchenItems);
    if (!found) {
      setMatchedItem(null);
      setFeedback({
        type: "error",
        text: `No SKU/ingredient matched "${code.trim()}" in ${kitchenId}. Try e.g. BEEF-01, CHIX-01, or GHOST-01.`,
      });
      return;
    }
    setMatchedItem(found);
    setFeedback({
      type: "info",
      text: `Scanned ${found.name} [${found.sku}] • Current: ${found.currentStock} ${found.unit} (Reorder: ${found.reorderThreshold} ${found.unit}).`,
    });
    scaleFieldRef.current?.focus();
  }

  function handleBarcodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const now = performance.now();
    const delta = now - lastKeystrokeMs.current;
    lastKeystrokeMs.current = now;

    if (delta > 0 && delta < 50) {
      burstChars.current += 1;
    } else if (e.key !== "Enter") {
      burstChars.current = 0;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      handleResolveScan(scanInput);
    }
  }

  function handleBarcodeChange(nextVal: string) {
    setScanInput(nextVal);
    // Auto-resolve rapid USB keyboard-wedge bursts (<50ms keystrokes) once exact SKU matches
    if (burstChars.current >= 4) {
      const quickMatch = resolveScannedIngredient(nextVal, kitchenItems);
      if (quickMatch) {
        setMatchedItem(quickMatch);
        setFeedback({
          type: "info",
          text: `Hardware barcode burst matched ${quickMatch.name} [${quickMatch.sku}]. Ready for scale weight.`,
        });
      }
    }
  }

  async function handleCommit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;

    const activeItem =
      matchedItem ?? resolveScannedIngredient(scanInput, kitchenItems);
    if (!activeItem) {
      setFeedback({
        type: "error",
        text: "Scan or enter a valid ingredient SKU before committing.",
      });
      return;
    }

    const reading = parseScaleWeightReading(scaleInput, activeItem.unit);
    if (!reading.valid) {
      setFeedback({
        type: "error",
        text: reading.error || "Enter a valid USB scale reading (e.g. ST,GS,+001.450kg or 750 g).",
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: activeItem.ingredientId ?? activeItem.id,
          kitchenId,
          action: mode,
          quantity: reading.quantity,
          reason:
            reason.trim() ||
            (mode === "RESTOCK"
              ? `Barcode & Scale receiving (${reading.rawText} -> ${reading.quantity} ${reading.normalizedUnit})`
              : `Barcode & Scale prep wastage (${reading.rawText} -> ${reading.quantity} ${reading.normalizedUnit})`),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to commit station stock update.");
      }

      const summary = `${mode === "RESTOCK" ? "Received" : "Logged waste for"} ${reading.quantity} ${reading.normalizedUnit} of ${activeItem.name} [${activeItem.sku}] at ${kitchenId} (raw scale: ${reading.rawText}).`;
      setFeedback({ type: "success", text: summary });
      setScaleInput("");
      setReason("");
      await onCommitted(summary);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Commit failed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-sky-500/30 bg-slate-900/75 p-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-sky-400">
            Sprint 4 • Hardware Receiving &amp; Prep Station ({kitchenId})
          </span>
          <h2 className="text-sm font-black text-white">
            Barcode Scanner &amp; USB HID Weighing Scale Station
          </h2>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 p-1">
          <button
            type="button"
            onClick={() => setMode("RESTOCK")}
            className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-bold transition ${
              mode === "RESTOCK"
                ? "bg-emerald-500 text-slate-950"
                : "text-slate-400 hover:text-white"
            }`}
          >
            + Stock Receiving (RESTOCK)
          </button>
          <button
            type="button"
            onClick={() => setMode("WASTE")}
            className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-bold transition ${
              mode === "WASTE"
                ? "bg-red-500 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            - Prep Wastage (WASTE)
          </button>
        </div>
      </div>

      <form
        onSubmit={handleCommit}
        className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end"
      >
        <label className="block lg:col-span-3">
          <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
            1. Barcode / SKU Scan (Enter)
          </span>
          <input
            type="text"
            value={scanInput}
            disabled={disabled || submitting}
            onKeyDown={handleBarcodeKeyDown}
            onChange={(e) => handleBarcodeChange(e.target.value)}
            placeholder="Scan barcode or type e.g. CHIX-01"
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:border-sky-500 outline-none"
          />
        </label>

        <label className="block lg:col-span-4">
          <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
            2. Digital Scale Readout{" "}
            {matchedItem ? `(Target: ${matchedItem.unit})` : "(kg / g / ml / units)"}
          </span>
          <div className="mt-1 flex gap-1.5">
            <input
              ref={scaleFieldRef}
              type="text"
              value={scaleInput}
              disabled={disabled || submitting}
              onChange={(e) => setScaleInput(e.target.value)}
              placeholder="ST,GS,+001.450kg  or  750 g"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:border-sky-500 outline-none"
            />
            <button
              type="button"
              disabled={disabled || submitting}
              onClick={() =>
                setScaleInput(
                  matchedItem?.unit === "ml"
                    ? "500 ml"
                    : matchedItem?.unit === "units"
                      ? "12"
                      : "ST,GS,+001.450kg",
                )
              }
              title="Simulate a live USB HID scale burst"
              className="shrink-0 rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-2 font-mono text-[10px] font-bold text-sky-300 hover:bg-slate-700"
            >
              Sim Scale
            </button>
          </div>
        </label>

        <label className="block lg:col-span-3">
          <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
            3. Station Note (Optional)
          </span>
          <input
            type="text"
            value={reason}
            disabled={disabled || submitting}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              mode === "RESTOCK" ? "Vendor challan / batch" : "Trim / drop waste"
            }
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-500 outline-none"
          />
        </label>

        <div className="lg:col-span-2">
          <button
            type="submit"
            disabled={disabled || submitting}
            className={`w-full rounded-xl px-3.5 py-2 font-mono text-xs font-black transition disabled:opacity-50 ${
              mode === "RESTOCK"
                ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                : "bg-red-500 text-white hover:bg-red-400"
            }`}
          >
            {submitting
              ? "Saving..."
              : mode === "RESTOCK"
                ? "Commit Restock"
                : "Commit Waste"}
          </button>
        </div>
      </form>

      {/* Live parsed scale preview & matched SKU chip */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          {matchedItem ? (
            <span className="rounded-lg border border-sky-500/35 bg-sky-500/10 px-2.5 py-0.5 font-mono text-sky-200">
              SKU: <strong>{matchedItem.sku}</strong> ({matchedItem.name}) • Stock:{" "}
              {matchedItem.currentStock} {matchedItem.unit}
            </span>
          ) : (
            <span className="text-slate-400">
              Scan barcode &amp; press Enter (or type SKU like{" "}
              <code className="font-mono text-slate-300">CHIX-01</code>).
            </span>
          )}

          {parsedWeight && (
            <span
              className={`rounded-lg border px-2.5 py-0.5 font-mono ${
                parsedWeight.valid
                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/40 bg-red-500/10 text-red-300"
              }`}
            >
              {parsedWeight.valid
                ? `Normalized: ${parsedWeight.quantity} ${parsedWeight.normalizedUnit}`
                : parsedWeight.error}
            </span>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`mt-2.5 rounded-xl border px-3 py-2 text-xs font-medium ${
            feedback.type === "success"
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
              : feedback.type === "error"
                ? "border-red-500/35 bg-red-500/10 text-red-200"
                : "border-sky-500/35 bg-sky-500/10 text-sky-200"
          }`}
        >
          {feedback.text}
        </div>
      )}
    </section>
  );
}
