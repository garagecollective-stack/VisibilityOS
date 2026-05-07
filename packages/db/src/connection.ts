import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;
let _pool: Pool | undefined;

export function getDb() {
  if (_db) return _db;

  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("DATABASE_URL env var is required");

  _pool = new Pool({ connectionString, max: 20 });
  _db = drizzle(_pool, { schema });
  return _db;
}

export type Database = ReturnType<typeof getDb>;

export async function closeDb(): Promise<void> {
  await _pool?.end();
  _db = undefined;
  _pool = undefined;
}
