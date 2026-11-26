import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { seedDatabaseIdempotent } from "./seed-runner";

async function main() {
  const url =
    process.env.DIRECT_URL?.trim() ||
    process.env.TEST_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error(
      "Missing DIRECT_URL or DATABASE_URL environment variable for db:seed.",
    );
  }

  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  try {
    console.log("[db:seed] Seeding DarKitOS operational tables (idempotent)...");
    await seedDatabaseIdempotent(db);
    console.log("[db:seed] Seed completed cleanly (ON CONFLICT DO NOTHING).");
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[db:seed] Failed:", err);
  process.exit(1);
});
