"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase-config";

let cachedClient: SupabaseClient | null = null;
let cachedCacheKey: string | null = null;

/**
 * Returns a browser Supabase client when NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY are configured; otherwise returns null so
 * offline/CI demo builds gracefully fall back to JWT cookie auth + HTTP polling.
 */
export function createSupabaseBrowserClient(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  const cacheKey = `${config.url}::${config.anonKey}`;
  if (cachedClient && cachedCacheKey === cacheKey) {
    return cachedClient;
  }

  cachedClient = createBrowserClient(config.url, config.anonKey);
  cachedCacheKey = cacheKey;
  return cachedClient;
}
