import path from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

async function main() {
  const url =
    process.env.DIRECT_URL?.trim() ||
    process.env.TEST_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error(
      "Missing DIRECT_URL or DATABASE_URL environment variable for db:migrate.",
    );
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const migrationsFolder = path.resolve(process.cwd(), "drizzle");
    console.log(`[db:migrate] Applying SQL migrations from ${migrationsFolder}...`);
    await migrate(db, { migrationsFolder });
    console.log("[db:migrate] Migrations applied successfully.");
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[db:migrate] Failed:", err);
  process.exit(1);
});
