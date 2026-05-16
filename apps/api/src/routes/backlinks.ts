import "../types.js";
import { Hono } from "hono";
import { getDb } from "../lib/db/index.js";
import { backlinkSnapshots, projects } from "@garage-seo/db";
import { eq, and, desc } from "drizzle-orm";
import { DataForSEO } from "@garage-seo/dataforseo";
import { getRedis, makeCacheAdapter } from "../lib/redis/index.js";
import type { BacklinkItem } from "@garage-seo/dataforseo";

const router = new Hono();

function getDFS() {
  const redis = getRedis();
  return new DataForSEO({
    login: process.env["DATAFORSEO_LOGIN"]!,
    password: process.env["DATAFORSEO_PASSWORD"]!,
    cache: makeCacheAdapter(redis),
  });
}

// ── Mock data (used when DataForSEO balance is zero or API fails) ─────────────

const MOCK_NEW_LIST = [
  { sourceUrl: "https://clutch.co/profile/garage-collective", targetUrl: "https://garagecollective.agency", anchor: "Garage Collective", domainRank: 78, date: "2025-04-28" },
  { sourceUrl: "https://designrush.com/agency/garage-collective", targetUrl: "https://garagecollective.agency/work", anchor: "creative agency", domainRank: 65, date: "2025-04-22" },
  { sourceUrl: "https://goodfirms.co/company/garage-collective", targetUrl: "https://garagecollective.agency", anchor: "Garage Collective Agency", domainRank: 71, date: "2025-04-18" },
  { sourceUrl: "https://sortlist.com/agency/garage-collective", targetUrl: "https://garagecollective.agency/services", anchor: "branding agency Mumbai", domainRank: 58, date: "2025-04-15" },
  { sourceUrl: "https://agencyspotter.com/agencies/garage-collective", targetUrl: "https://garagecollective.agency", anchor: "garage collective", domainRank: 44, date: "2025-04-10" },
];

const MOCK_LOST_LIST = [
  { sourceUrl: "https://agency.in/garage-collective", targetUrl: "https://garagecollective.agency", anchor: "agency", domainRank: 42, date: "2025-04-05" },
  { sourceUrl: "https://themanifest.com/old-listing", targetUrl: "https://garagecollective.agency/about", anchor: "view profile", domainRank: 61, date: "2025-03-30" },
  { sourceUrl: "https://topagencies.in/garage", targetUrl: "https://garagecollective.agency", anchor: "Garage Collective", domainRank: 35, date: "2025-03-22" },
  { sourceUrl: "https://clutch.co/old-review", targetUrl: "https://garagecollective.agency/contact", anchor: "contact", domainRank: 78, date: "2025-03-18" },
  { sourceUrl: "https://digitalagencynetwork.com/agencies/india", targetUrl: "https://garagecollective.agency", anchor: "Mumbai digital agency", domainRank: 52, date: "2025-03-10" },
];

const MOCK_REFERRING_DOMAINS = [
  { domain: "clutch.co", domainRank: 78, backlinks: 12, firstSeen: "2023-03-15", lastSeen: "2025-05-10", follow: true, status: "active" },
  { domain: "designrush.com", domainRank: 65, backlinks: 8, firstSeen: "2023-06-20", lastSeen: "2025-05-08", follow: true, status: "active" },
  { domain: "linkedin.com", domainRank: 98, backlinks: 5, firstSeen: "2022-11-01", lastSeen: "2025-05-12", follow: false, status: "active" },
  { domain: "goodfirms.co", domainRank: 71, backlinks: 4, firstSeen: "2023-08-14", lastSeen: "2025-04-29", follow: true, status: "active" },
  { domain: "sortlist.com", domainRank: 58, backlinks: 3, firstSeen: "2024-01-05", lastSeen: "2025-05-01", follow: true, status: "active" },
  { domain: "google.com", domainRank: 100, backlinks: 2, firstSeen: "2022-07-22", lastSeen: "2025-05-11", follow: false, status: "active" },
  { domain: "twitter.com", domainRank: 94, backlinks: 15, firstSeen: "2022-05-10", lastSeen: "2025-05-09", follow: false, status: "active" },
  { domain: "facebook.com", domainRank: 99, backlinks: 6, firstSeen: "2023-02-28", lastSeen: "2025-05-07", follow: false, status: "active" },
  { domain: "crunchbase.com", domainRank: 89, backlinks: 3, firstSeen: "2023-09-12", lastSeen: "2025-04-18", follow: true, status: "active" },
  { domain: "agency.in", domainRank: 42, backlinks: 2, firstSeen: "2024-03-01", lastSeen: "2024-11-15", follow: true, status: "lost" },
];

const MOCK_HISTORY_POINTS = [
  { month: "May 24", totalBacklinks: 8000, referringDomains: 600 },
  { month: "Jun 24", totalBacklinks: 8350, referringDomains: 618 },
  { month: "Jul 24", totalBacklinks: 8720, referringDomains: 637 },
  { month: "Aug 24", totalBacklinks: 9100, referringDomains: 658 },
  { month: "Sep 24", totalBacklinks: 9480, referringDomains: 674 },
  { month: "Oct 24", totalBacklinks: 9850, referringDomains: 695 },
  { month: "Nov 24", totalBacklinks: 10200, referringDomains: 713 },
  { month: "Dec 24", totalBacklinks: 10580, referringDomains: 731 },
  { month: "Jan 25", totalBacklinks: 10950, referringDomains: 753 },
  { month: "Feb 25", totalBacklinks: 11300, referringDomains: 775 },
  { month: "Mar 25", totalBacklinks: 11800, referringDomains: 810 },
  { month: "Apr 25", totalBacklinks: 12300, referringDomains: 847 },
];

const MOCK_ANCHORS = [
  { anchor: "Branded", percentage: 45, count: 5535 },
  { anchor: "Naked URL", percentage: 20, count: 2460 },
  { anchor: "Generic", percentage: 15, count: 1845 },
  { anchor: "Keyword Rich", percentage: 12, count: 1476 },
  { anchor: "Other", percentage: 8, count: 984 },
];

const MOCK_BACKLINKS = [
  { id: "bl_1", sourceUrl: "https://clutch.co/profile/garage-collective", sourceDomain: "clutch.co", targetUrl: "https://garagecollective.agency", anchor: "Garage Collective", domainRank: 78, firstSeen: "2023-03-15", dofollow: true, status: "active" },
  { id: "bl_2", sourceUrl: "https://clutch.co/profile/garage-collective/reviews", sourceDomain: "clutch.co", targetUrl: "https://garagecollective.agency/work", anchor: "view work", domainRank: 78, firstSeen: "2023-04-10", dofollow: true, status: "active" },
  { id: "bl_3", sourceUrl: "https://twitter.com/someone/status/1234567890", sourceDomain: "twitter.com", targetUrl: "https://garagecollective.agency", anchor: "garagecollective.agency", domainRank: 94, firstSeen: "2022-07-15", dofollow: false, status: "active" },
  { id: "bl_4", sourceUrl: "https://twitter.com/design_weekly/status/9876543", sourceDomain: "twitter.com", targetUrl: "https://garagecollective.agency/blog", anchor: "read more", domainRank: 94, firstSeen: "2023-01-22", dofollow: false, status: "active" },
  { id: "bl_5", sourceUrl: "https://facebook.com/posts/12345", sourceDomain: "facebook.com", targetUrl: "https://garagecollective.agency", anchor: "Garage Collective Agency", domainRank: 99, firstSeen: "2023-05-08", dofollow: false, status: "active" },
  { id: "bl_6", sourceUrl: "https://linkedin.com/company/garage-collective/about", sourceDomain: "linkedin.com", targetUrl: "https://garagecollective.agency", anchor: "Company Website", domainRank: 98, firstSeen: "2022-11-01", dofollow: false, status: "active" },
  { id: "bl_7", sourceUrl: "https://crunchbase.com/organization/garage-collective", sourceDomain: "crunchbase.com", targetUrl: "https://garagecollective.agency", anchor: "garagecollective.agency", domainRank: 89, firstSeen: "2023-09-12", dofollow: true, status: "active" },
  { id: "bl_8", sourceUrl: "https://goodfirms.co/company/garage-collective", sourceDomain: "goodfirms.co", targetUrl: "https://garagecollective.agency", anchor: "Garage Collective", domainRank: 71, firstSeen: "2023-08-14", dofollow: true, status: "active" },
  { id: "bl_9", sourceUrl: "https://designrush.com/agency/garage-collective", sourceDomain: "designrush.com", targetUrl: "https://garagecollective.agency", anchor: "creative agency Mumbai", domainRank: 65, firstSeen: "2023-06-20", dofollow: true, status: "active" },
  { id: "bl_10", sourceUrl: "https://sortlist.com/agency/garage-collective", sourceDomain: "sortlist.com", targetUrl: "https://garagecollective.agency/services", anchor: "branding agency India", domainRank: 58, firstSeen: "2024-01-05", dofollow: true, status: "active" },
  { id: "bl_11", sourceUrl: "https://clutch.co/profile/gc-review-3", sourceDomain: "clutch.co", targetUrl: "https://garagecollective.agency/about", anchor: "about us", domainRank: 78, firstSeen: "2024-02-12", dofollow: true, status: "active" },
  { id: "bl_12", sourceUrl: "https://google.com/maps/place/garage-collective", sourceDomain: "google.com", targetUrl: "https://garagecollective.agency", anchor: "website", domainRank: 100, firstSeen: "2022-07-22", dofollow: false, status: "active" },
  { id: "bl_13", sourceUrl: "https://facebook.com/design.india/posts/456", sourceDomain: "facebook.com", targetUrl: "https://garagecollective.agency/work", anchor: "portfolio", domainRank: 99, firstSeen: "2023-11-15", dofollow: false, status: "active" },
  { id: "bl_14", sourceUrl: "https://agencyspotter.com/agencies/garage-collective", sourceDomain: "agencyspotter.com", targetUrl: "https://garagecollective.agency", anchor: "Garage Collective", domainRank: 44, firstSeen: "2025-04-10", dofollow: true, status: "new" },
  { id: "bl_15", sourceUrl: "https://clutch.co/it-services/india/mumbai", sourceDomain: "clutch.co", targetUrl: "https://garagecollective.agency", anchor: "view profile", domainRank: 78, firstSeen: "2024-03-05", dofollow: true, status: "active" },
  { id: "bl_16", sourceUrl: "https://agency.in/garage-collective", sourceDomain: "agency.in", targetUrl: "https://garagecollective.agency", anchor: "agency", domainRank: 42, firstSeen: "2024-03-01", dofollow: true, status: "lost" },
  { id: "bl_17", sourceUrl: "https://themanifest.com/design/agencies/mumbai", sourceDomain: "themanifest.com", targetUrl: "https://garagecollective.agency/about", anchor: "view profile", domainRank: 61, firstSeen: "2023-07-08", dofollow: true, status: "active" },
  { id: "bl_18", sourceUrl: "https://designrush.com/enterprise/branding", sourceDomain: "designrush.com", targetUrl: "https://garagecollective.agency/work", anchor: "branding portfolio", domainRank: 65, firstSeen: "2024-01-18", dofollow: true, status: "active" },
  { id: "bl_19", sourceUrl: "https://twitter.com/design_hub/status/111222333", sourceDomain: "twitter.com", targetUrl: "https://garagecollective.agency/blog/rebrand", anchor: "click here", domainRank: 94, firstSeen: "2024-02-28", dofollow: false, status: "active" },
  { id: "bl_20", sourceUrl: "https://linkedin.com/posts/garageagency_branding", sourceDomain: "linkedin.com", targetUrl: "https://garagecollective.agency/blog", anchor: "learn more", domainRank: 98, firstSeen: "2025-04-20", dofollow: false, status: "new" },
  { id: "bl_21", sourceUrl: "https://goodfirms.co/company/gc/reviews", sourceDomain: "goodfirms.co", targetUrl: "https://garagecollective.agency/testimonials", anchor: "testimonials", domainRank: 71, firstSeen: "2024-04-02", dofollow: true, status: "active" },
  { id: "bl_22", sourceUrl: "https://crunchbase.com/gc/people", sourceDomain: "crunchbase.com", targetUrl: "https://garagecollective.agency/team", anchor: "team page", domainRank: 89, firstSeen: "2023-10-20", dofollow: true, status: "active" },
  { id: "bl_23", sourceUrl: "https://topagencies.in/garage-collective", sourceDomain: "topagencies.in", targetUrl: "https://garagecollective.agency", anchor: "Garage Collective", domainRank: 35, firstSeen: "2024-01-30", dofollow: true, status: "lost" },
  { id: "bl_24", sourceUrl: "https://sortlist.com/agency/gc/reviews", sourceDomain: "sortlist.com", targetUrl: "https://garagecollective.agency/work", anchor: "portfolio", domainRank: 58, firstSeen: "2025-04-15", dofollow: true, status: "new" },
  { id: "bl_25", sourceUrl: "https://digitalagencynetwork.com/agencies/mumbai", sourceDomain: "digitalagencynetwork.com", targetUrl: "https://garagecollective.agency", anchor: "Mumbai digital agency", domainRank: 52, firstSeen: "2023-12-10", dofollow: true, status: "active" },
];

// ── GET /projects/:projectId/overview ──────────────────────────────────────────

router.get("/projects/:projectId/overview", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Load last 2 snapshots for delta calculation
  const snapshots = await db
    .select()
    .from(backlinkSnapshots)
    .where(eq(backlinkSnapshots.projectId, projectId))
    .orderBy(desc(backlinkSnapshots.checkedAt))
    .limit(2);

  const latest = snapshots[0];
  const previous = snapshots[1];

  // Try DataForSEO
  try {
    const dfs = getDFS();
    const summary = await dfs.backlinks.getDomainSummary(project.domain);
    if (!summary) throw new Error("No summary data returned");

    const totalBacklinksDelta = previous
      ? summary.backlinks - previous.totalBacklinks
      : summary.backlinks - (latest?.totalBacklinks ?? 0);
    const referringDomainsDelta = previous
      ? summary.referring_domains - previous.referringDomains
      : summary.referring_domains - (latest?.referringDomains ?? 0);

    return c.json({
      totalBacklinks: summary.backlinks,
      referringDomains: summary.referring_domains,
      domainRank: summary.rank,
      newBacklinks30d: latest?.newBacklinks ?? 0,
      lostBacklinks30d: latest?.lostBacklinks ?? 0,
      totalBacklinksDelta,
      referringDomainsDelta,
      newBacklinksList: MOCK_NEW_LIST,
      lostBacklinksList: MOCK_LOST_LIST,
      isSampleData: false,
    });
  } catch {
    return c.json({
      ...MOCK_OVERVIEW_BASE,
      newBacklinksList: MOCK_NEW_LIST,
      lostBacklinksList: MOCK_LOST_LIST,
      isSampleData: true,
    });
  }
});

const MOCK_OVERVIEW_BASE = {
  totalBacklinks: 12300,
  referringDomains: 847,
  domainRank: 52,
  newBacklinks30d: 23,
  lostBacklinks30d: 8,
  totalBacklinksDelta: 23,
  referringDomainsDelta: 5,
};

// ── GET /projects/:projectId/referring-domains ─────────────────────────────────

router.get("/projects/:projectId/referring-domains", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  try {
    const dfs = getDFS();
    const items = await dfs.backlinks.getReferringDomains(project.domain, 20);
    if (!items.length) throw new Error("No referring domains returned");

    return c.json({
      domains: items.map((item) => ({
        domain: item.domain,
        domainRank: item.rank,
        backlinks: item.backlinks,
        firstSeen: item.first_seen ?? "",
        lastSeen: item.last_seen ?? "",
        follow: item.dofollow,
        status: item.is_lost ? "lost" : "active",
      })),
      isSampleData: false,
    });
  } catch {
    return c.json({ domains: MOCK_REFERRING_DOMAINS, isSampleData: true });
  }
});

// ── GET /projects/:projectId/backlinks ─────────────────────────────────────────

router.get("/projects/:projectId/backlinks", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();
  const { limit = "25", offset = "0" } = c.req.query();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const limitN = Math.min(parseInt(limit, 10), 100);
  const offsetN = parseInt(offset, 10);

  try {
    const dfs = getDFS();
    const items = await dfs.backlinks.getBacklinks(project.domain, limitN, offsetN);
    if (!items.length) throw new Error("No backlinks returned");

    return c.json({
      backlinks: items.map((item: BacklinkItem, idx: number) => ({
        id: `bl_real_${offsetN + idx}`,
        sourceUrl: item.url_from,
        sourceDomain: item.domain_from,
        targetUrl: item.url_to,
        anchor: item.anchor ?? "",
        domainRank: item.domain_from_rank,
        firstSeen: item.first_seen ?? "",
        dofollow: item.dofollow,
        status: item.is_lost ? "lost" : item.is_new ? "new" : "active",
      })),
      total: items.length,
      page: Math.floor(offsetN / limitN) + 1,
      limit: limitN,
      isSampleData: false,
    });
  } catch {
    return c.json({
      backlinks: MOCK_BACKLINKS,
      total: MOCK_BACKLINKS.length,
      page: 1,
      limit: 25,
      isSampleData: true,
    });
  }
});

// ── GET /projects/:projectId/anchors ───────────────────────────────────────────

router.get("/projects/:projectId/anchors", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  try {
    const dfs = getDFS();
    const items = await dfs.backlinks.getAnchorText(project.domain, 50);
    if (!items.length) throw new Error("No anchor data returned");

    const totalBacklinks = items.reduce((sum, i) => sum + i.backlinks, 0);
    return c.json({
      items: items.slice(0, 8).map((item) => ({
        anchor: item.anchor || "(empty)",
        count: item.backlinks,
        percentage: totalBacklinks > 0 ? Math.round((item.backlinks / totalBacklinks) * 100) : 0,
      })),
      isSampleData: false,
    });
  } catch {
    return c.json({ items: MOCK_ANCHORS, isSampleData: true });
  }
});

// ── GET /projects/:projectId/history ───────────────────────────────────────────

router.get("/projects/:projectId/history", async (c) => {
  const orgId = c.get("orgId");
  const db = getDb();
  const { projectId } = c.req.param();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  });
  if (!project) return c.json({ error: "Project not found" }, 404);

  const snapshots = await db
    .select()
    .from(backlinkSnapshots)
    .where(eq(backlinkSnapshots.projectId, projectId))
    .orderBy(desc(backlinkSnapshots.checkedAt))
    .limit(12);

  if (snapshots.length >= 3) {
    const points = [...snapshots].reverse().map((s) => ({
      month: new Date(s.checkedAt).toLocaleString("en-US", { month: "short", year: "2-digit" }),
      totalBacklinks: s.totalBacklinks,
      referringDomains: s.referringDomains,
    }));
    return c.json({ points, isSampleData: false });
  }

  return c.json({ points: MOCK_HISTORY_POINTS, isSampleData: true });
});

export default router;
