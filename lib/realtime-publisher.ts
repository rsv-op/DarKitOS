import "server-only";

import {
  buildKitchenRealtimeTopics,
  type KitchenRealtimeEventPayload,
  type KitchenRealtimeEventType,
} from "@/lib/supabase-config";

export type { KitchenRealtimeEventPayload, KitchenRealtimeEventType };

export interface PublishRealtimeResult {
  delivered: boolean;
  skippedReason?: "UNCONFIGURED" | "NETWORK_ERROR" | "HTTP_ERROR";
  statusCode?: number;
  topics: string[];
  payload: KitchenRealtimeEventPayload;
}

type FetchLike = typeof fetch;

let customFetchForTesting: FetchLike | null = null;

/**
 * Test-only hook allowing unit suites to intercept Supabase Broadcast HTTP calls
 * without making live outbound network requests.
 */
export function setRealtimePublisherFetchForTesting(
  fn: FetchLike | null,
): void {
  customFetchForTesting = fn;
}

/**
 * Publishes an operational event to Supabase Realtime Broadcast topics:
 *   - `org:${organizationId}:kitchen:${kitchenId}`
 *   - `org:${organizationId}:all`
 *
 * Designed to fail-open: when Supabase env vars are absent (offline/CI/demo) or
 * the Realtime endpoint experiences transient latency, it resolves cleanly
 * without throwing or interrupting the primary operational database write.
 */
export async function publishKitchenRealtimeEvent(
  event: Omit<KitchenRealtimeEventPayload, "timestamp"> & { timestamp?: string },
): Promise<PublishRealtimeResult> {
  const payload: KitchenRealtimeEventPayload = {
    ...event,
    organizationId: event.organizationId?.trim() || "ORG-001",
    kitchenId: event.kitchenId?.trim() || "ALL",
    timestamp: event.timestamp ?? new Date().toISOString(),
  };

  const topics = buildKitchenRealtimeTopics(
    payload.organizationId,
    payload.kitchenId,
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const apiKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !apiKey) {
    return {
      delivered: false,
      skippedReason: "UNCONFIGURED",
      topics,
      payload,
    };
  }

  const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/realtime/v1/api/broadcast`;
  const fetchImpl = customFetchForTesting ?? fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: topics.map((topic) => ({
          topic,
          event: payload.type,
          payload,
        })),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        delivered: false,
        skippedReason: "HTTP_ERROR",
        statusCode: response.status,
        topics,
        payload,
      };
    }

    return {
      delivered: true,
      statusCode: response.status,
      topics,
      payload,
    };
  } catch {
    return {
      delivered: false,
      skippedReason: "NETWORK_ERROR",
      topics,
      payload,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
