import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), "../../.env") });

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { runClickHouseMigrations } from "./clickhouse/index.js";
import * as schema from "./schema/index.js";

async function main() {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("DATABASE_URL is required");

  // ─── PostgreSQL ────────────────────────────────────────────────────────────
  console.log("[migrate] Connecting to PostgreSQL…");
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  console.log("[migrate] Running Drizzle migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] PostgreSQL migrations complete.");

  // ─── ClickHouse ────────────────────────────────────────────────────────────
  const clickhouseUrl = process.env["CLICKHOUSE_URL"];
  const clickhouseDb = process.env["CLICKHOUSE_DATABASE"] ?? "garage_seo";

  if (!clickhouseUrl) {
    console.warn("[migrate] CLICKHOUSE_URL not set — skipping ClickHouse migrations.");
  } else {
    console.log("[migrate] Creating ClickHouse database and tables…");

    async function chExec(sql: string) {
      const url = new URL(`${clickhouseUrl}/`);
      url.searchParams.set("database", clickhouseDb);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: sql,
      });
      if (!res.ok) {
        const text = await res.text();
        if (text.includes("already exists")) return;
        throw new Error(`ClickHouse error: ${text}`);
      }
    }

    try {
      // Create database first (no database param for this call)
      const createDbRes = await fetch(`${clickhouseUrl}/`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: `CREATE DATABASE IF NOT EXISTS ${clickhouseDb}`,
      });
      if (!createDbRes.ok) {
        const t = await createDbRes.text();
        if (!t.includes("already exists")) throw new Error(`ClickHouse create DB: ${t}`);
      }
      console.log(`[migrate] ClickHouse database '${clickhouseDb}' ready.`);

      await runClickHouseMigrations(chExec);
      console.log("[migrate] ClickHouse tables ready.");
    } catch (err) {
      console.warn("[migrate] ClickHouse migration failed — skipping:", (err as Error).message);
    }
  }

  await pool.end();
  console.log("[migrate] Done.");
}

main().catch((err) => {
  console.error("[migrate] FAILED:", err);
  process.exit(1);
});
