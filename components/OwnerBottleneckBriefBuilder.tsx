"use client";

import React, { useMemo, useState } from "react";
import {
  BOTTLENECK_CATALOG,
  generateOwnerBottleneckBrief,
  type OwnerBriefTelemetry,
  type OwnerBottleneckInput,
} from "@/lib/bottleneck-brief";

interface OwnerBottleneckBriefBuilderProps {
  ownerName: string;
  kitchenScope: string;
  telemetry: OwnerBriefTelemetry;
  onSavedToExplorer?: (fileName: string) => void;
}

export default function OwnerBottleneckBriefBuilder({
  ownerName,
  kitchenScope,
  telemetry,
  onSavedToExplorer,
}: OwnerBottleneckBriefBuilderProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([
    "multi-kitchen-inventory",
    "gst-invoicing-upi",
    "aggregator-reconciliation",
  ]);
  const [dailyOrderVolume, setDailyOrderVolume] = useState(
    "200–400 orders/day",
  );
  const [monthlyRevenueBand, setMonthlyRevenueBand] = useState(
    "₹15L – ₹35L / month",
  );
  const [urgency, setUrgency] =
    useState<OwnerBottleneckInput["urgency"]>("THIS_MONTH");
  const [customNotes, setCustomNotes] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const brief = useMemo(
    () =>
      generateOwnerBottleneckBrief({
        ownerName,
        kitchenScope,
        selectedBottleneckIds: selectedIds,
        dailyOrderVolume,
        monthlyRevenueBand,
        urgency,
        customNotes,
        telemetry,
      }),
    [
      ownerName,
      kitchenScope,
      selectedIds,
      dailyOrderVolume,
      monthlyRevenueBand,
      urgency,
      customNotes,
      telemetry,
    ],
  );

  function toggleBottleneck(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function handleDownloadMarkdown() {
    const blob = new Blob([brief.markdown], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = brief.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleCopyMarkdown() {
    try {
      await navigator.clipboard.writeText(brief.markdown);
      setCopyStatus("Copied to clipboard — ready to paste into Gemini / Dev AI");
      setTimeout(() => setCopyStatus(null), 3500);
    } catch {
      setCopyStatus("Clipboard unavailable — use Download .md instead");
      setTimeout(() => setCopyStatus(null), 3500);
    }
  }

  async function handleSaveToExplorer() {
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/system", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT_FILE",
          file: {
            name: brief.fileName,
            category: "Owner Brief",
            mimeType: "text/markdown",
            kitchenId: kitchenScope.startsWith("K")
              ? kitchenScope.split(" ")[0]
              : "GLOBAL",
            status: "VERIFIED",
            content: brief.markdown,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveStatus({
          type: "error",
          text: data.error || "Unable to save brief to File Explorer.",
        });
      } else {
        setSaveStatus({
          type: "success",
          text: `Saved "${brief.fileName}" to File Explorer under Owner Brief.`,
        });
        onSavedToExplorer?.(brief.fileName);
      }
    } catch {
      setSaveStatus({
        type: "error",
        text: "Network error while saving brief to File Explorer.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      id="owner-bottleneck-brief"
      className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-emerald-950/20 p-5 sm:p-6 shadow-xl"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            Owner Action Brief • Ready for Gemini / Dev AI
          </span>
          <h2 className="mt-2 text-lg sm:text-xl font-bold text-white">
            Capture Your Kitchen Bottlenecks &amp; Export a Dev Brief (.md)
          </h2>
          <p className="mt-1 text-sm text-slate-300 max-w-3xl">
            Pick the operational headaches slowing your kitchens down today.
            DarKIT OS bundles your selections with live INR revenue, stockout,
            and cancellation telemetry into a clean Markdown brief you can hand
            directly to an AI engineer or tech team.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-950/40"
          >
            ⬇ Download .md Brief
          </button>
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition-colors"
          >
            Copy for Gemini
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveToExplorer}
            className="rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-3.5 py-2.5 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/25 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save to Explorer"}
          </button>
        </div>
      </div>

      {copyStatus && (
        <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-200">
          {copyStatus}
        </div>
      )}

      {saveStatus && (
        <div
          className={`mt-3 rounded-xl border px-3.5 py-2 text-xs font-medium ${
            saveStatus.type === "success"
              ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200"
              : "border-rose-500/40 bg-rose-500/10 text-rose-200"
          }`}
        >
          {saveStatus.text}
        </div>
      )}

      {/* Step 1: Bottleneck selector chips */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            1. Select Operational Bottlenecks ({selectedIds.length} selected)
          </p>
          <button
            type="button"
            onClick={() =>
              setSelectedIds(
                selectedIds.length === BOTTLENECK_CATALOG.length
                  ? []
                  : BOTTLENECK_CATALOG.map((b) => b.id),
              )
            }
            className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300"
          >
            {selectedIds.length === BOTTLENECK_CATALOG.length
              ? "Clear all"
              : "Select all"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {BOTTLENECK_CATALOG.map((item) => {
            const active = selectedIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleBottleneck(item.id)}
                className={`text-left rounded-2xl border p-3 transition-all ${
                  active
                    ? "border-emerald-500/70 bg-emerald-500/10 text-white shadow-sm"
                    : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    {item.category}
                  </span>
                  <span className="rounded-md bg-slate-900 border border-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                    {item.sprint}
                  </span>
                </div>
                <p className="mt-1.5 text-xs font-bold leading-snug">
                  {active ? "✓ " : "+ "}
                  {item.label}
                </p>
                <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                  {item.ownerSummary}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Business context & owner notes */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Daily Order Volume
            </label>
            <select
              value={dailyOrderVolume}
              onChange={(e) => setDailyOrderVolume(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
            >
              <option value="Under 100 orders/day">Under 100 orders/day</option>
              <option value="100–200 orders/day">100–200 orders/day</option>
              <option value="200–400 orders/day">200–400 orders/day</option>
              <option value="400–800 orders/day">400–800 orders/day</option>
              <option value="800+ orders/day (Multi-hub)">
                800+ orders/day (Multi-hub)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Monthly GMV / Revenue Band
            </label>
            <select
              value={monthlyRevenueBand}
              onChange={(e) => setMonthlyRevenueBand(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
            >
              <option value="Under ₹5L / month">Under ₹5L / month</option>
              <option value="₹5L – ₹15L / month">₹5L – ₹15L / month</option>
              <option value="₹15L – ₹35L / month">₹15L – ₹35L / month</option>
              <option value="₹35L – ₹1Cr / month">₹35L – ₹1Cr / month</option>
              <option value="₹1Cr+ / month">₹1Cr+ / month</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Rollout Urgency
            </label>
            <select
              value={urgency}
              onChange={(e) =>
                setUrgency(e.target.value as OwnerBottleneckInput["urgency"])
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
            >
              <option value="THIS_WEEK">Urgent — This Week</option>
              <option value="THIS_MONTH">Priority — This Month</option>
              <option value="THIS_QUARTER">Planned — This Quarter</option>
            </select>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            2. Describe Your Specific Kitchen Bottleneck (Plain Words)
          </label>
          <textarea
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            rows={5}
            placeholder="Example: Dinner rush between 8 PM and 10 PM in Gurugram K1 causes brioche buns to stock out without updating Swiggy/Zomato menus, leading to ₹8,000+ weekly cancellation penalties..."
            className="w-full flex-1 rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              File output:{" "}
              <code className="font-mono text-emerald-300">
                {brief.fileName}
              </code>
            </span>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="font-semibold text-slate-200 hover:text-emerald-300 underline underline-offset-2"
            >
              {showPreview ? "Hide Markdown preview" : "Preview generated .md"}
            </button>
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              {brief.fileName}
            </span>
            <span className="text-[11px] text-slate-500">
              {brief.markdown.length} chars
            </span>
          </div>
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-300">
            {brief.markdown}
          </pre>
        </div>
      )}
    </section>
  );
}
