import fs from "fs";
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
    console.log("[db:migrate] Drizzle migrations applied successfully.");

    const rlsPath = path.resolve(process.cwd(), "db", "rls.sql");
    if (fs.existsSync(rlsPath)) {
      console.log(`[db:migrate] Applying RLS baseline policies from ${rlsPath}...`);
      const rlsSql = fs.readFileSync(rlsPath, "utf8");
      await client.unsafe(rlsSql);
      console.log("[db:migrate] RLS baseline policies applied successfully.");
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[db:migrate] Failed:", err);
  process.exit(1);
});
