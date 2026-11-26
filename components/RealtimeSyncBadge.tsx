"use client";

import type { RealtimeConnectionMode } from "@/hooks/useRealtimeKitchenSync";

interface RealtimeSyncBadgeProps {
  connectionMode: RealtimeConnectionMode;
  lastEventAt?: string | null;
  topic?: string;
}

function formatClock(iso?: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function RealtimeSyncBadge({
  connectionMode,
  lastEventAt,
  topic,
}: RealtimeSyncBadgeProps) {
  const isLive = connectionMode === "REALTIME_LIVE";
  const timeLabel = formatClock(lastEventAt);

  return (
    <span
      title={
        topic
          ? `${isLive ? "Sub-second Supabase Realtime Broadcast active" : "Automatic HTTP polling fallback active"} • Channel: ${topic}`
          : undefined
      }
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${
        isLive
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : "border-amber-500/35 bg-amber-500/10 text-amber-300"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isLive
            ? "animate-pulse bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]"
            : "bg-amber-400"
        }`}
      />
      <span>{isLive ? "Realtime Live" : "Polling Fallback"}</span>
      {timeLabel ? (
        <span className="border-l border-current/25 pl-2 font-mono text-[10px] opacity-80">
          {timeLabel}
        </span>
      ) : null}
    </span>
  );
}
