# VisibilityOS — Summary

*May 2026 · v1.0 · Beta*

## What it is

VisibilityOS is a multi-tenant SEO platform built primarily for the Indian market — agencies, freelancers, and in-house SEO managers who need Semrush/Ahrefs-class capabilities at a rupee price point. The product unifies keyword research, rank tracking, site auditing, backlinks, competitor intelligence, and generative-search visibility tracking behind a single dashboard.

Pricing: ₹0 Starter (1 project / 50 keywords), **₹2,999 Pro** (5 / 500), **₹7,999 Agency** (30 / 3,000), Enterprise custom. Compare to Semrush Pro at ~USD 139/mo or Ahrefs Lite at ~USD 129/mo with similar keyword caps.

## What works (production-ready or close)

- **Auth & multi-tenancy** — Clerk JWT + org switcher, `enforcePlanLimit` middleware
- **Project CRUD** — 17-country dropdown, GSC/GA4 toggles, competitor list in settings JSON
- **Dashboard** — 4 stat cards, 30-day rank chart, top movers, alerts feed, project health, quick actions, GSC card, issues summary, competitor snapshot
- **Keyword Overview** — country/device selectors, 5 metric cards (incl. Competition), 12-month chart with average line, SERP features grid (10 chips), TanStack variations table with bulk save, PAA accordion, Top 10 organic results
- **Keyword Ideas** — seed + filter panel (volume / KD / CPC ranges + intent + include/exclude), summary bar, 4 tabs (All / Questions / Low Competition / By Intent), paginated sortable table, sticky bulk bar
- **Keyword Bulk Analysis** — up to 200 keywords, 7 stat chips, opportunity row highlighting, CSV export, save-to-list
- **Keyword Strategy Builder** — Claude Sonnet 4.6 generates structured 4-cluster strategy + 8-week content calendar with quick-win flags
- **Keyword Lists** — search, enrichment (volume/KD/CPC/intent), Track All to rank tracker, Move between lists, bulk actions
- **Site Audit** — Python crawler in WSL2 + 23-rule TypeScript engine, score breakdown by Technical/Content/Speed/Security, severity tabs, expandable issue rows with all affected URLs, crawled pages table with sort/filter/CSV
- **Rank Tracker** — setup form, 5 metric cards, visibility chart with 7/30/60/90d range, keywords table with color-coded position pills, filter bar, slide-out detail drawer with 90-day history
- **Billing** — Razorpay create-order + payment verify + webhook (HMAC-verified)
- **Plan limit enforcement** — 402 responses with structured upgrade hints

## What is scaffolded (schema + API ready, UI pending)

- **Backlinks** — full DFS integration, snapshots table; UI is a shell
- **Competitors** — DFS Labs `competitors_domain` + bulk traffic estimation; UI is a shell
- **GEO Tracker** — schema + 3-platform worker (ChatGPT, Perplexity, Gemini); UI is a shell
- **Content** — Claude `analyzeContent` + `generateContentBrief` exist; UI is a shell
- **Reports** — schema + worker stub; PDF rendering is a placeholder buffer pending `@react-pdf/renderer`
- **Settings** — page shell only

## Tech stack

- **Frontend** — Next.js 14.2 App Router, React 18, Tailwind 3.4, Radix UI, TanStack Query 5 + Table 8, Recharts 2.15, Zustand 5
- **Backend** — Hono 4.7 on Node ≥ 20, Drizzle ORM 0.43, Zod 3.24, BullMQ 5.53
- **Stores** — PostgreSQL 15+ (13 tables), ClickHouse (rank_history, traffic_estimates, keyword_metrics_history), Redis 7+ (cache + queue + rate limit)
- **Auth & billing** — Clerk 6.20, Razorpay 2.9
- **AI** — Anthropic Claude (`claude-sonnet-4-6`, `claude-haiku-4-5-20251001`), OpenAI `gpt-4o-mini`, Google Gemini `gemini-2.0-flash`, Perplexity `sonar`
- **External data** — DataForSEO (15 endpoints across Keywords / SERP / Labs / Backlinks / OnPage), Google Search Console + Analytics 4 + PageSpeed Insights
- **Crawler** — Python Scrapy service in WSL2 (not in this repo)
- **Monorepo** — Turborepo 2.5, TypeScript 5.8

## How to run it locally

```bash
# 1. Install
npm install

# 2. Configure env — copy .env.example to .env and fill in keys
cp .env.example .env

# 3. Migrate the database
npm run db:migrate

# 4. Start API (terminal 1)
cd apps/api && npm run dev          # :3001

# 5. Start web (terminal 2)
cd apps/web && npm run dev          # :3000

# 6. (Optional) Start the audit crawler in WSL2 Ubuntu
#    Get WSL IP with `hostname -I`, set CRAWLER_URL=http://<ip>:5001 in .env,
#    then run the crawler service on :5001
```

Mock fallbacks make most of the app usable without DataForSEO / Claude / ClickHouse credentials — sections that have no real data show a small purple "Sample Data" badge.

## Known issues

- **ClickHouse is optional in dev** — rank / visibility endpoints return empty arrays without it; the frontend falls back to per-keyword deterministic mock data with the "Sample Data" badge.
- **Rank checks are on-demand only** — there is no daily cron scheduling `rank-checks` jobs yet. Triggered via `POST /api/rank/projects/:projectId/check-now`.
- **Audit crawler IP** — `CRAWLER_URL` in `.env` must be re-set after each WSL2 reboot (NAT IP changes). The API returns a clear 503 if missing.
- **GSC OAuth flow not implemented** — `SearchConsoleClient` works in code but there is no per-project OAuth + token storage.
- **Google Ads API** — listed in the original spec, not yet implemented.
- **GEO `google_aio` platform** — recognised in the schema enum but no client.
- **Reports PDF** — placeholder buffer; needs `@react-pdf/renderer`.
- **Audit BullMQ worker is dead code** — the live audit path is HTTP-driven (Python crawler + TS rules). `packages/workers/src/audit-worker.ts` exists but is not wired in.
- **Subscription dunning** — `payment.failed` flips billing to `past_due` but plan limits aren't auto-downgraded.
- **Sidebar collapse and breadcrumbs** — not implemented across the app.

## Repository map

```
apps/api          Hono backend
apps/web          Next.js 14 frontend
packages/db       Drizzle schema + Postgres + ClickHouse DDL
packages/dataforseo  DataForSEO client (keywords, SERP, OnPage, backlinks, labs)
packages/ai       Claude / OpenAI / Gemini / Perplexity clients
packages/google-apis  GSC, GA4, PageSpeed Insights
packages/workers  5 BullMQ workers (rank, audit, ai, geo, report)
packages/crawler  Python Scrapy crawler (lives in WSL2)
docs              This document set
```

See `docs/VISIBILITY_OS_COMPLETE_REPORT.md` for the full technical reference.
