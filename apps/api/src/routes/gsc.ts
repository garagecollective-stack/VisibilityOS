import "../types.js";
import { Hono } from "hono";
import type { Context } from "hono";
import { getDb } from "../lib/db/index.js";
import { projects } from "@garage-seo/db";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "../lib/encryption.js";
import { syncGscData } from "../lib/gsc-sync.js";
import { SearchConsoleClient } from "@garage-seo/google-apis";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

function oauthConfig() {
  return {
    clientId: process.env["GOOGLE_CLIENT_ID"] ?? "",
    clientSecret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
    redirectUri:
      process.env["GOOGLE_REDIRECT_URI"] ?? "http://localhost:3001/api/gsc/callback",
  };
}

const router = new Hono();

// ── GET /gsc/auth/start?projectId=... ─────────────────────────────────────────

router.get("/auth/start", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.query();

  if (!projectId) return c.json({ error: "projectId required" }, 400);

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const { clientId, redirectUri } = oauthConfig();
  if (!clientId) return c.json({ error: "Google OAuth not configured on this server" }, 503);

  const state = Buffer.from(JSON.stringify({ projectId, orgId })).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GSC_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return c.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
});

// ── GET /gsc/properties/:projectId ────────────────────────────────────────────

router.get("/properties/:projectId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);
  if (!project.gscConnected || !project.gscRefreshToken) {
    return c.json({ error: "GSC not connected for this project" }, 400);
  }

  try {
    const refreshToken = decrypt(project.gscRefreshToken);
    const accessToken = project.gscAccessToken ? decrypt(project.gscAccessToken) : "";
    const expiresAt = project.gscTokenExpiresAt?.getTime() ?? 0;

    const sc = new SearchConsoleClient({ access_token: accessToken, refresh_token: refreshToken, expiry_date: expiresAt });
    const properties = await sc.listProperties();
    return c.json({ properties });
  } catch (err) {
    console.error("[gsc/properties] error:", err instanceof Error ? err.message : err);
    return c.json({ properties: [] });
  }
});

// ── DELETE /gsc/disconnect/:projectId ─────────────────────────────────────────

router.delete("/disconnect/:projectId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  await db
    .update(projects)
    .set({
      gscConnected: false,
      gscRefreshToken: null,
      gscAccessToken: null,
      gscTokenExpiresAt: null,
      gscConnectedEmail: null,
      gscPropertyUrl: null,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  return c.json({ success: true });
});

// ── POST /gsc/sync/:projectId ─────────────────────────────────────────────────

router.post("/sync/:projectId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);
  if (!project.gscConnected || !project.gscRefreshToken) {
    return c.json({ error: "GSC not connected for this project" }, 400);
  }

  void syncGscData(projectId).catch((err) => {
    console.error("[gsc/sync] error:", err instanceof Error ? err.message : err);
  });

  return c.json({ message: "GSC sync started" }, 202);
});

// ── PATCH /gsc/property/:projectId — set active GSC property ─────────────────

router.patch("/property/:projectId", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const body = await c.req.json<{ propertyUrl: string }>();
  if (!body.propertyUrl) return c.json({ error: "propertyUrl required" }, 400);

  await db
    .update(projects)
    .set({ gscPropertyUrl: body.propertyUrl, updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  return c.json({ success: true });
});

export default router;

// ── Public OAuth callback — registered directly on app in index.ts ────────────

export async function gscCallbackHandler(c: Context): Promise<Response> {
  const frontendUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
  const { code, state, error } = c.req.query();

  const redirectTo = (status: "connected" | "error") =>
    c.redirect(`${frontendUrl}/dashboard/account?tab=integrations&gsc=${status}`) as unknown as Response;

  if (error || !code || !state) return redirectTo("error");

  try {
    const { projectId, orgId } = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    ) as { projectId: string; orgId: string };

    if (!projectId || !orgId) throw new Error("Invalid OAuth state");

    const { clientId, clientSecret, redirectUri } = oauthConfig();

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${await tokenRes.text()}`);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!tokenData.refresh_token) {
      console.warn("[gsc/callback] No refresh_token — user must revoke access and reconnect");
      return redirectTo("error");
    }

    let email = "";
    try {
      const userRes = await fetch(USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userRes.ok) {
        const u = (await userRes.json()) as { email?: string };
        email = u.email ?? "";
      }
    } catch { /* best-effort */ }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    const db = getDb();
    await db
      .update(projects)
      .set({
        gscConnected: true,
        gscRefreshToken: encrypt(tokenData.refresh_token),
        gscAccessToken: encrypt(tokenData.access_token),
        gscTokenExpiresAt: expiresAt,
        gscConnectedEmail: email,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)));

    // Kick off first sync in background
    void syncGscData(projectId).catch((err) => {
      console.error("[gsc/callback] initial sync error:", err instanceof Error ? err.message : err);
    });

    return redirectTo("connected");
  } catch (err) {
    console.error("[gsc/callback] error:", err instanceof Error ? err.message : err);
    return redirectTo("error");
  }
}
