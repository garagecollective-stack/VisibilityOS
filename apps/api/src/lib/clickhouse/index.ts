const CLICKHOUSE_URL = () => process.env["CLICKHOUSE_URL"] ?? "http://localhost:8123";
const CLICKHOUSE_DB = () => process.env["CLICKHOUSE_DATABASE"] ?? "garage_seo";

interface CHRow {
  [key: string]: unknown;
}

export const clickhouse = {
  async query<T = CHRow>(sql: string): Promise<T[]> {
    const url = new URL(`${CLICKHOUSE_URL()}/`);
    url.searchParams.set("database", CLICKHOUSE_DB());
    url.searchParams.set("default_format", "JSONEachRow");

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: sql,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ClickHouse query error ${res.status}: ${text}`);
    }

    const text = await res.text();
    if (!text.trim()) return [];

    return text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  },

  async insert(table: string, rows: CHRow[]): Promise<void> {
    if (rows.length === 0) return;

    const url = new URL(`${CLICKHOUSE_URL()}/`);
    url.searchParams.set("database", CLICKHOUSE_DB());
    url.searchParams.set("query", `INSERT INTO ${table} FORMAT JSONEachRow`);

    const body = rows.map((r) => JSON.stringify(r)).join("\n");

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-ndjson" },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ClickHouse insert error ${res.status}: ${text}`);
    }
  },

  async execute(ddl: string): Promise<void> {
    const url = new URL(`${CLICKHOUSE_URL()}/`);
    url.searchParams.set("database", CLICKHOUSE_DB());

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: ddl,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ClickHouse DDL error ${res.status}: ${text}`);
    }
  },
};

export async function listClickHouseTables(): Promise<string[]> {
  const rows = await clickhouse.query<Record<string, unknown>>("SHOW TABLES");
  return rows
    .map((row) => Object.values(row)[0])
    .filter((value): value is string => typeof value === "string")
    .sort((a, b) => a.localeCompare(b));
}
