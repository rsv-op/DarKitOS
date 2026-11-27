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
          ? `${isLive ? "Sub-second Supabase Realtime Broadcast active" : "Automatic HTTP polling fallback active"} · Channel: ${topic}`
          : undefined
      }
      className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium tabular-nums ${
        isLive
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-white/[0.08] bg-[#151519] text-zinc-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isLive ? "bg-emerald-400" : "bg-amber-400"
        }`}
      />
      <span>{isLive ? "Live" : "Polling"}</span>
      {timeLabel ? (
        <span className="hidden border-l border-white/[0.08] pl-1.5 font-mono text-[10px] opacity-80 xl:inline">
          {timeLabel}
        </span>
      ) : null}
    </span>
  );
}
