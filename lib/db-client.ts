import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "@/db/schema";

export type DarKitDb = PostgresJsDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __darkit_pg_client__: Sql | undefined;
  // eslint-disable-next-line no-var
  var __darkit_pg_url__: string | undefined;
  // eslint-disable-next-line no-var
  var __darkit_drizzle_db__: DarKitDb | undefined;
}

/**
 * Resolves the runtime PostgreSQL connection URL.
 * Prefers TEST_DATABASE_URL (for CI / Vitest integration runs) before DATABASE_URL.
 */
export function getDatabaseUrl(): string | undefined {
  const url =
    process.env.TEST_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  return url && url.length > 0 ? url : undefined;
}

export function isPostgresConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

/**
 * Lazily returns a pooled Drizzle ORM instance backed by postgres-js.
 * Configured with `{ prepare: false }` for Supabase Supavisor Transaction Pooler (port 6543).
 */
export function getDb(): DarKitDb {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Configure Supabase DATABASE_URL or run in offline fallback mode.",
    );
  }

  if (
    globalThis.__darkit_drizzle_db__ &&
    globalThis.__darkit_pg_client__ &&
    globalThis.__darkit_pg_url__ === url
  ) {
    return globalThis.__darkit_drizzle_db__;
  }

  const client = postgres(url, {
    prepare: false, // Mandatory for Supabase Supavisor Transaction Pooler (port 6543)
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  const db = drizzle(client, { schema });
  globalThis.__darkit_pg_client__ = client;
  globalThis.__darkit_pg_url__ = url;
  globalThis.__darkit_drizzle_db__ = db;

  return db;
}

/**
 * Cleanly closes the cached PostgreSQL pool (used in tests and graceful shutdowns).
 */
export async function closeDb(): Promise<void> {
  if (globalThis.__darkit_pg_client__) {
    const client = globalThis.__darkit_pg_client__;
    globalThis.__darkit_pg_client__ = undefined;
    globalThis.__darkit_drizzle_db__ = undefined;
    globalThis.__darkit_pg_url__ = undefined;
    await client.end({ timeout: 5 });
  }
}
