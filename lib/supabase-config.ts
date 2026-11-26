export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return null;
  }
  return { url, anonKey };
}

export function isSupabasePublicConfigured(): boolean {
  return getSupabasePublicConfig() !== null;
}

export const REALTIME_EVENT_TYPES = [
  "ORDER_CREATED",
  "ORDER_STATUS_CHANGED",
  "ORDER_CANCELLED",
  "INVENTORY_UPDATED",
  "STOCK_LOW_ALERT",
  "PAYMENT_CAPTURED",
  "PAYMENT_REFUNDED",
] as const;

export type KitchenRealtimeEventType = (typeof REALTIME_EVENT_TYPES)[number];

export interface KitchenRealtimeEventPayload {
  type: KitchenRealtimeEventType;
  organizationId: string;
  kitchenId: string;
  timestamp: string;
  orderId?: string;
  status?: string;
  previousStatus?: string;
  brandId?: string;
  ingredientId?: string;
  itemName?: string;
  currentStock?: number;
  reorderThreshold?: number;
  actor?: string;
  details?: string;
}

export function buildKitchenRealtimeTopics(
  organizationId: string,
  kitchenId?: string | null,
): string[] {
  const org = organizationId.trim() || "ORG-001";
  const topics: string[] = [];
  if (kitchenId && kitchenId.trim() && kitchenId.trim().toUpperCase() !== "ALL") {
    topics.push(`org:${org}:kitchen:${kitchenId.trim()}`);
  }
  topics.push(`org:${org}:all`);
  return topics;
}
