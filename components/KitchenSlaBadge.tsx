"use client";

import { useEffect, useState } from "react";

interface KitchenSlaBadgeProps {
  orderId: string;
  anchorIso?: string;
  slaMinutes: number;
  labelPrefix?: string;
  onBreach?: (orderId: string) => void;
}

function computeElapsedMinutes(anchorIso?: string, nowMs = Date.now()): number {
  if (!anchorIso) return 0;
  const parsed = new Date(anchorIso).getTime();
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.floor((nowMs - parsed) / 60_000));
}

export default function KitchenSlaBadge({
  orderId,
  anchorIso,
  slaMinutes,
  labelPrefix = "SLA",
  onBreach,
}: KitchenSlaBadgeProps) {
  const safeSla = Math.max(1, Math.round(slaMinutes || 12));
  const [elapsedMins, setElapsedMins] = useState<number>(() =>
    computeElapsedMinutes(anchorIso),
  );

  useEffect(() => {
    setElapsedMins(computeElapsedMinutes(anchorIso));
    const timer = window.setInterval(() => {
      setElapsedMins(computeElapsedMinutes(anchorIso));
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [anchorIso]);

  const ratio = elapsedMins / safeSla;
  const state: "ON_TRACK" | "DUE_SOON" | "BREACHED" =
    elapsedMins >= safeSla
      ? "BREACHED"
      : ratio >= 0.8
        ? "DUE_SOON"
        : "ON_TRACK";

  useEffect(() => {
    if (state === "BREACHED" && onBreach) {
      onBreach(orderId);
    }
  }, [state, orderId, onBreach]);

  const badgeClass =
    state === "BREACHED"
      ? "border-rose-500/45 bg-rose-500/15 text-rose-300"
      : state === "DUE_SOON"
        ? "border-amber-500/40 bg-amber-500/12 text-amber-300"
        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

  const statusText =
    state === "BREACHED"
      ? "BREACHED"
      : state === "DUE_SOON"
        ? "DUE SOON"
        : "ON TRACK";

  return (
    <span
      title={`${labelPrefix}: ${elapsedMins}m elapsed vs ${safeSla}m target`}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-tight tabular-nums ${badgeClass}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          state === "BREACHED"
            ? "bg-rose-400"
            : state === "DUE_SOON"
              ? "bg-amber-400"
              : "bg-emerald-400"
        }`}
      />
      <span>{statusText}</span>
      <span className="opacity-85">
        {elapsedMins}m/{safeSla}m
      </span>
    </span>
  );
}
