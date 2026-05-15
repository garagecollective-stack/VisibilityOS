export * from "./rank-history.js";
export * from "./traffic.js";
export * from "./keyword-metrics.js";
export * from "./gsc-metrics.js";

export const ALL_DDL_STATEMENTS = [
  // Imported lazily to avoid circular issues
] as const;

export async function runClickHouseMigrations(
  execute: (sql: string) => Promise<void>
): Promise<void> {
  const { RANK_HISTORY_DDL } = await import("./rank-history.js");
  const { TRAFFIC_DDL } = await import("./traffic.js");
  const { KEYWORD_METRICS_DDL } = await import("./keyword-metrics.js");
  const { GSC_METRICS_DDL } = await import("./gsc-metrics.js");

  for (const ddl of [RANK_HISTORY_DDL, TRAFFIC_DDL, KEYWORD_METRICS_DDL, GSC_METRICS_DDL]) {
    await execute(ddl.trim());
  }

  console.log("[ClickHouse] All tables created (IF NOT EXISTS)");
}
