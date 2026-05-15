import { getDb } from "./db/index.js";
import { projects } from "@garage-seo/db";
import { eq } from "drizzle-orm";
import { decrypt, encrypt } from "./encryption.js";
import { SearchConsoleClient } from "@garage-seo/google-apis";
import { clickhouse } from "./clickhouse/index.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

async function refreshAccessToken(projectId: string, refreshToken: string): Promise<string> {
  const clientId = process.env["GOOGLE_CLIENT_ID"] ?? "";
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"] ?? "";

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error(`GSC token refresh failed: ${await res.text()}`);

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;

  const db = getDb();
  await db
    .update(projects)
    .set({ gscAccessToken: encrypt(data.access_token), gscTokenExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  return data.access_token;
}

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

export async function syncGscData(projectId: string): Promise<{ keywords: number }> {
  const db = getDb();
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });

  if (!project?.gscConnected || !project.gscRefreshToken) {
    throw new Error(`GSC not connected for project ${projectId}`);
  }

  const refreshToken = decrypt(project.gscRefreshToken);

  const now = Date.now();
  const expiresAt = project.gscTokenExpiresAt?.getTime() ?? 0;
  let accessToken: string;
  if (project.gscAccessToken && expiresAt > now + 60_000) {
    accessToken = decrypt(project.gscAccessToken);
  } else {
    accessToken = await refreshAccessToken(projectId, refreshToken);
  }

  const siteUrl = project.gscPropertyUrl ?? `sc-domain:${project.domain}`;
  const sc = new SearchConsoleClient({ access_token: accessToken, refresh_token: refreshToken, expiry_date: expiresAt });

  // GSC has a ~3-day data lag; sync last 28 days
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 3);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 28);

  const keywords = await sc.getTopKeywords(siteUrl, fmtDate(startDate), fmtDate(endDate), 1000);

  const syncDate = fmtDate(new Date());
  const syncedAt = new Date().toISOString();

  const rows = keywords.map((kw) => ({
    project_id: projectId,
    keyword: kw.keys[0] ?? "",
    page: "",
    clicks: Math.round(kw.clicks),
    impressions: Math.round(kw.impressions),
    ctr: kw.ctr,
    position: kw.position,
    date: syncDate,
    synced_at: syncedAt,
  }));

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    await clickhouse.insert("gsc_metrics", rows.slice(i, i + BATCH));
  }

  await db
    .update(projects)
    .set({ gscLastSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  console.log(`[gsc-sync] ${rows.length} keywords synced for project ${projectId}`);
  return { keywords: rows.length };
}
