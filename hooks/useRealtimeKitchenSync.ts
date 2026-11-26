"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  REALTIME_EVENT_TYPES,
  type KitchenRealtimeEventPayload,
  type KitchenRealtimeEventType,
} from "@/lib/supabase-config";

export type RealtimeConnectionMode = "REALTIME_LIVE" | "POLLING_FALLBACK";

export interface UseRealtimeKitchenSyncOptions {
  organizationId?: string | null;
  kitchenId?: string | null;
  enabled?: boolean;
  onSync: (event?: KitchenRealtimeEventPayload) => void | Promise<void>;
  /** Fallback HTTP polling interval when Supabase Realtime is offline or unconfigured (default 3500ms). */
  pollIntervalMs?: number;
  /** Lightweight consistency heartbeat interval when Realtime WebSocket is LIVE (default 30000ms). */
  heartbeatIntervalMs?: number;
}

export interface UseRealtimeKitchenSyncResult {
  connectionMode: RealtimeConnectionMode;
  lastEventAt: string | null;
  lastEventType: KitchenRealtimeEventType | null;
  topic: string;
}

/**
 * Subscribes to tenant-scoped Supabase Realtime Broadcast channels
 * (`org:${orgId}:kitchen:${kitchenId}` or `org:${orgId}:all`) for sub-second
 * KDS, Dispatch, Live Orders, Inventory, and Owner updates.
 *
 * Automatically degrades to 3.5s HTTP polling when Supabase env vars are unset
 * (offline/CI/demo) or if the WebSocket channel disconnects, and drops polling
 * down to a lightweight 30s consistency heartbeat once Realtime is LIVE.
 */
export function useRealtimeKitchenSync({
  organizationId,
  kitchenId,
  enabled = true,
  onSync,
  pollIntervalMs = 3500,
  heartbeatIntervalMs = 30000,
}: UseRealtimeKitchenSyncOptions): UseRealtimeKitchenSyncResult {
  const org = organizationId?.trim() || "ORG-001";
  const normalizedKitchen =
    kitchenId && kitchenId.trim() && kitchenId.trim().toUpperCase() !== "ALL"
      ? kitchenId.trim()
      : null;

  const topic = normalizedKitchen
    ? `org:${org}:kitchen:${normalizedKitchen}`
    : `org:${org}:all`;

  const [connectionMode, setConnectionMode] =
    useState<RealtimeConnectionMode>("POLLING_FALLBACK");
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [lastEventType, setLastEventType] =
    useState<KitchenRealtimeEventType | null>(null);

  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  // 1. Manage Supabase Realtime subscription lifecycle
  useEffect(() => {
    if (!enabled) {
      setConnectionMode("POLLING_FALLBACK");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setConnectionMode("POLLING_FALLBACK");
      return;
    }

    let disposed = false;
    const channel = supabase.channel(topic, {
      config: {
        broadcast: { self: false },
      },
    });

    const handleBroadcast = (message: {
      event?: string;
      payload?: KitchenRealtimeEventPayload;
    }) => {
      if (disposed) return;
      const payload = message.payload;
      const eventType =
        (payload?.type as KitchenRealtimeEventType | undefined) ??
        (message.event as KitchenRealtimeEventType | undefined) ??
        null;

      setLastEventAt(payload?.timestamp ?? new Date().toISOString());
      if (eventType) {
        setLastEventType(eventType);
      }
      void onSyncRef.current(payload);
    };

    for (const eventType of REALTIME_EVENT_TYPES) {
      channel.on("broadcast", { event: eventType }, (msg) => {
        handleBroadcast(
          msg as { event?: string; payload?: KitchenRealtimeEventPayload },
        );
      });
    }

    channel.subscribe((status) => {
      if (disposed) return;
      if (status === "SUBSCRIBED") {
        setConnectionMode("REALTIME_LIVE");
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        setConnectionMode("POLLING_FALLBACK");
      }
    });

    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  }, [enabled, topic]);

  // 2. Manage adaptive polling timer (3.5s fallback vs 30s live consistency heartbeat)
  useEffect(() => {
    if (!enabled) return;

    const intervalMs =
      connectionMode === "REALTIME_LIVE" ? heartbeatIntervalMs : pollIntervalMs;

    const timer = window.setInterval(() => {
      void onSyncRef.current();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, connectionMode, pollIntervalMs, heartbeatIntervalMs]);

  return {
    connectionMode,
    lastEventAt,
    lastEventType,
    topic,
  };
}
