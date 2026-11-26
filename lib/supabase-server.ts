import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase-config";

export function isSupabaseServerConfigured(): boolean {
  return getSupabasePublicConfig() !== null;
}

/**
 * Server Component / Route Handler Supabase client backed by Next.js cookies().
 * Returns null gracefully when Supabase env vars are not configured.
 */
export function createSupabaseServerClient(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  const cookieStore = cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
      ) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Next.js throws when attempting to mutate cookies inside a Server Component render.
          // Route handlers and middleware handle cookie refreshes cleanly.
        }
      },
    },
  });
}

/**
 * Route Handler Supabase client that reads cookies from an incoming NextRequest
 * and records any Set-Cookie updates so they can be flushed onto a NextResponse.
 */
export function createSupabaseRouteHandlerClient(request: NextRequest): {
  supabase: SupabaseClient;
  applyCookies: (response: NextResponse) => NextResponse;
} | null {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  const pendingCookies: {
    name: string;
    value: string;
    options?: CookieOptions;
  }[] = [];

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
      ) {
        for (const item of cookiesToSet) {
          pendingCookies.push(item);
        }
      },
    },
  });

  return {
    supabase,
    applyCookies(response: NextResponse) {
      for (const { name, value, options } of pendingCookies) {
        response.cookies.set(name, value, options);
      }
      return response;
    },
  };
}

/**
 * Server-only Admin client using SUPABASE_SERVICE_ROLE_KEY.
 * Strictly guarded with `import "server-only"` — never imported in client code.
 */
export function createSupabaseAdminClient(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config || !serviceRoleKey) {
    return null;
  }

  return createClient(config.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
