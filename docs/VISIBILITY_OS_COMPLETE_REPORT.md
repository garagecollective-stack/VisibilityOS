# VisibilityOS — Complete Product & Technical Report

*Generated: May 2026 · Version: 1.0 · Status: Beta*

---

## 1. Executive Summary

VisibilityOS is a multi-tenant SEO platform built for the Indian market: agencies, freelancers, and in-house SEO managers who want Ahrefs/Semrush-class capabilities at a rupee-denominated price point. The product unifies keyword research, rank tracking, site auditing, backlink analysis, competitor intelligence, and generative-search (GEO) visibility tracking behind a single Clerk-authenticated dashboard.

The economic thesis is straightforward: most Indian agencies cannot justify paying USD 119+/month per seat for Semrush Pro or Ahrefs Lite. VisibilityOS prices its Pro tier at ₹2,999/month and its Agency tier at ₹7,999/month while wrapping the same underlying data sources (DataForSEO, Google APIs, Anthropic Claude) and adding India-first defaults — location code `2356`, INR pricing via Razorpay, and a curated set of seven priority countries.

The platform is currently in **late-beta**. Authentication, project management, full keyword intelligence (overview, ideas, bulk analysis, AI-powered strategy builder, lists with enrichment), full site audit (custom Python crawler + 23-rule TypeScript engine), and rank tracking UI are functional end-to-end. Backlinks, competitors, GEO tracker, content, and reports modules have working schema + API + UI shells; their data-flow wiring is partial.

The stack is a Turborepo monorepo: **Next.js 14** (App Router) frontend, **Hono 4** API backend, **PostgreSQL + Drizzle ORM** for transactional state, **ClickHouse** for rank/traffic time-series, **Redis** for caching and BullMQ queues, **Clerk** for auth, **Razorpay** for billing, plus integrations with **DataForSEO**, **Anthropic Claude (Sonnet 4.6 + Haiku 4.5)**, **OpenAI**, **Gemini**, **Perplexity**, **Google Search Console**, **Google Analytics 4**, and **Google PageSpeed Insights**.

---

## 2. Platform Overview

### 2.1 Target Market

- **Primary users:** Indian digital marketing agencies (3–50 seats), in-house SEO managers at Indian SaaS / e-commerce companies, freelance SEO consultants serving Indian SMBs.
- **Secondary users:** Agencies in adjacent markets — UAE, Singapore, UK, Canada, Australia — that handle Indian and international clients.
- **Pricing tiers** (from `apps/api/src/routes/billing.ts`):

| Plan | INR / mo | USD / mo | Projects | Tracked keywords | Headline features |
|------|----------|----------|----------|------------------|-------------------|
| **Starter** | ₹0 | $0 | 1 | 50 | `keyword_research`, `rank_tracking`, `basic_audit` |
| **Pro** | ₹2,999 | $36 | 5 | 500 | + `full_audit`, `gsc_integration`, `ga4_integration`, `competitor_basic` |
| **Agency** | ₹7,999 | $96 | 30 | 3,000 | `all_features`, `white_label`, `client_dashboards`, `pdf_reports`, `geo_tracker`, `backlinks` |
| **Enterprise** | custom | custom | unlimited | unlimited | `custom_integrations`, `dedicated_support`, `sla` |

- **Geographic focus:** India-first (default `countryCode: "IN"` on projects, default DataForSEO location `2356`), with seven priority countries supported in keyword/SERP lookups.

### 2.2 Core Value Proposition

| Vendor | Entry price (per user/mo) | Tracked keywords | India focus |
|--------|----------------------------|------------------|-------------|
| Semrush Pro | ~USD 139 | 500 | No |
| Ahrefs Lite | ~USD 129 | 750 | No |
| Surfer Essential | ~USD 89 | n/a | No |
| **VisibilityOS Pro** | **₹2,999 (~USD 36)** | **500** | **Yes** |
| **VisibilityOS Agency** | **₹7,999 (~USD 96)** | **3,000** | **Yes** |

The platform replicates the high-leverage feature set of Semrush/Ahrefs (keyword research, rank tracking, site audit, backlinks, competitor intelligence) and adds generative-search visibility tracking (GEO) — a feature category that none of the incumbents charge separately for at this price point.

Gross-margin commentary is in §11.

### 2.3 Supported Locations

From `apps/web/lib/keywords.ts` `KEYWORD_LOCATIONS`:

| Country | DataForSEO `location_code` | ISO code | Flag |
|---------|---------------------------|----------|------|
| India | `2356` | IN | 🇮🇳 (default) |
| United States | `2840` | US | 🇺🇸 |
| United Kingdom | `2826` | GB | 🇬🇧 |
| UAE | `9041` | AE | 🇦🇪 |
| Canada | `2124` | CA | 🇨🇦 |
| Australia | `2036` | AU | 🇦🇺 |
| Singapore | `2702` | SG | 🇸🇬 |

The project-creation dialog (`apps/web/app/dashboard/page.tsx`) additionally accepts ten more countries as the project's primary country (Pakistan, Bangladesh, Germany, France, Netherlands, Brazil, Mexico, Japan, South Africa, Nigeria) — these are stored on the project but not yet wired into DataForSEO lookups.

---

## 3. Architecture

### 3.1 Monorepo Structure

```
visibilityos/
├── apps/
│   ├── api/                       Hono backend (Node, port 3001)
│   └── web/                       Next.js 14 App Router (port 3000)
└── packages/
    ├── db/                        Drizzle ORM schema + Postgres + ClickHouse DDL
    │   ├── src/schema/            10 PG schema files (organizations, users, projects,
    │   │                          keywords, audit, backlinks, geo, reports, billing)
    │   ├── src/clickhouse/        3 CH DDLs (rank_history, traffic_estimates,
    │   │                          keyword_metrics_history)
    │   └── drizzle/               Generated migrations (0000–0003)
    ├── dataforseo/                Typed DataForSEO client + caching wrapper
    │   └── src/{client,keywords,serp,onpage,backlinks,labs}.ts
    ├── ai/                        AI provider clients
    │   └── src/{claude,openai,gemini,perplexity}.ts
    ├── google-apis/               Search Console, Analytics 4, PageSpeed
    │   └── src/{search-console,analytics,pagespeed}.ts
    ├── workers/                   BullMQ workers (5 queues)
    │   └── src/{rank,audit,ai,geo,report}-worker.ts + queues.ts
    └── crawler/                   Python Scrapy crawler (lives in WSL2, not in repo)
```

### 3.2 Infrastructure

The reference deployment runs on three services:

| Service | Workload | Notes |
|---------|----------|-------|
| **PostgreSQL 15+** | Transactional store: all 13 tables in `packages/db/src/schema/` | Drizzle-migrated |
| **ClickHouse** | Time-series rank history, visibility, keyword metrics | DDL in `packages/db/src/clickhouse/`; runs over HTTP at `CLICKHOUSE_URL` |
| **Redis 7+** | DataForSEO cache, rate limiter, BullMQ broker | `ioredis` client |

The Python audit crawler runs separately in **WSL2 / Ubuntu** as a small Flask-style service on port 5001 (configured by `CRAWLER_URL` in `.env`). It is not part of this monorepo.

API requests are protected by Clerk JWT verification at the edge of the Hono router; the API itself runs as a single Node.js process. There is no CDN or shared L7 caching layer documented in the codebase.

### 3.3 Data Flow

**Keyword overview lookup:**

```
User clicks "Analyze" in /dashboard/keywords/overview
  → POST /api/keywords/overview { keyword, locationCode, languageCode, device }
  → Clerk JWT verified, orgId set on context
  → Cache key: kw:{keyword}:{locationCode}:{languageCode}:overview (Redis, 24h)
  → On miss: DataForSEO /v3/dataforseo_labs/google/keyword_suggestions/live
              + /v3/dataforseo_labs/google/bulk_keyword_difficulty/live (enrichment)
  → Returns { main: KeywordRow, related: KeywordRow[] }
  → Same click also fires POST /api/keywords/serp (separate query for SERP features + PAA + top 10)
```

**Site audit flow:**

```
POST /api/audit/start { projectId }
  → If CRAWLER_URL is not set → 503 immediately
  → Insert audit_runs row (status=pending)
  → Fire-and-forget runAuditBackground():
       POST {CRAWLER_URL}/crawl-site { domain, max_pages: 9999, use_js: false }
       (Scrapy crawler returns CrawlResult with up to 9,999 pages)
     ↓
     If GOOGLE_PAGESPEED_API_KEY set → fetch PageSpeed mobile
     ↓
     runAuditRules(crawlData, pageSpeed) → 23-rule engine
     ↓
     Persist audit_issues rows (with affected_urls array)
     Persist audit_runs.crawled_pages JSONB summary
     Set status=completed
Frontend polls GET /api/audit/runs/:projectId every 5s while a run is running/pending.
```

### 3.4 Caching Strategy

All Redis keys, TTLs, and purpose:

| Pattern | TTL | Purpose | Source |
|---------|-----|---------|--------|
| `dfs:{endpoint}:{md5(params)}` | varies | Generic DataForSEO response cache | `packages/dataforseo/src/client.ts` (`makeCacheKey`) |
| `kw:{keyword}:{locationCode}:{languageCode}:overview` | 86,400s (24h) | Keyword overview result | `apps/api/src/routes/keywords.ts` |
| `kw:{keyword}:{locationCode}:{languageCode}:ideas` | 86,400s (24h) | Keyword ideas list | same |
| `kd:{keyword}:{locationCode}` | 86,400s (24h) | Per-keyword bulk-KD enrichment cache | same |
| `serp:{sha256(keyword\|locationCode\|device)}` | 21,600s (6h) | SERP organic + PAA + features | same |
| `rl:{orgId}` | window-bound | Sliding-window rate-limit set (zset) | `apps/api/src/middleware/rateLimit.ts` |
| (per-client) `CACHE_TTL_KEYWORDS` | 86,400s | DataForSEO keywords client | `packages/dataforseo/src/keywords.ts` |
| (per-client) `CACHE_TTL_SERP` | 21,600s | DataForSEO SERP client | `packages/dataforseo/src/serp.ts` |
| (per-client) `CACHE_TTL_BACKLINKS` | 43,200s (12h) | DataForSEO backlinks client | `packages/dataforseo/src/backlinks.ts` |
| (per-client) `CACHE_TTL_DOMAIN_METRICS` | 86,400s | DataForSEO Labs client | `packages/dataforseo/src/labs.ts` |

`apps/api/src/lib/redis/index.ts` also exports a centralised `CACHE_TTL` constant set (`KEYWORD_DATA`, `SERP_DATA`, `BACKLINK_DATA`, `DOMAIN_METRICS`, `PAGESPEED`, `GSC_DATA: 3,600s`).

### 3.5 Background Jobs

Five BullMQ queues are defined in `packages/workers/src/queues.ts`. Each is created lazily on first use, has `attempts: 3` + exponential backoff (5s base), and retains the last 100 completed / 500 failed jobs.

| Queue | Concurrency | Trigger | What it does |
|-------|-------------|---------|--------------|
| `rank-checks` | 10 | `POST /api/rank/projects/:projectId/check-now` (or scheduled) | Calls DataForSEO SERP, finds project's domain position, extracts competitor positions from same response, writes to ClickHouse `rank_history`, sends alert if drop ≥ 5 positions |
| `audits` | 3 | (currently dormant — the live audit path is HTTP-driven, not BullMQ) | DataForSEO OnPage crawl → persists `audit_issues` |
| `ai-tasks` | 5 | (programmatic) | Dispatches to Claude for `content_analysis`, `content_brief`, `issue_classify`, `rank_summary` |
| `reports` | 2 | (programmatic) | PDF generation placeholder; uploads to storage and sets `reports.fileUrl` |
| `geo-checks` | 5 | `POST /api/geo/projects/:projectId/prompts/:promptId/check` | Calls ChatGPT, Perplexity, Gemini in parallel, checks for domain citation, persists `geo_results` |

Note: The live audit path uses Path A (HTTP call to the WSL2 Python crawler + the TS rules engine in `apps/api/src/lib/audit-rules.ts`). The BullMQ `audit-worker.ts` (Path B, using DataForSEO OnPage) is dead code as of this writing.

---

## 4. Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Monorepo** | Turborepo | 2.5 |
| **Language** | TypeScript | 5.8 |
| **Frontend framework** | Next.js (App Router) | 14.2.29 |
| **UI runtime** | React + React DOM | 18.3.1 |
| **Styling** | Tailwind CSS | 3.4 |
| **Tailwind plugins** | `tailwindcss-animate`, `tailwind-merge`, `class-variance-authority`, `clsx` | latest |
| **Component primitives** | Radix UI (dialog, dropdown-menu, select, tabs, popover, tooltip, toast, label, separator, slot, avatar) | latest |
| **Icons** | Lucide React | 0.511 |
| **Data fetching** | TanStack Query | 5.75 |
| **Tables** | TanStack Table | 8.21 |
| **Client state** | Zustand | 5.0 |
| **Charts** | Recharts | 2.15 |
| **Forms / validation** | Zod | 3.24 |
| **Backend framework** | Hono | 4.7 |
| **Backend runtime** | `@hono/node-server` | 2.0 |
| **Validation middleware** | `@hono/zod-validator` | 0.7 |
| **ORM** | Drizzle ORM | 0.43 + `drizzle-kit` 0.31 |
| **PG driver** | `pg` | 8.20 |
| **Redis client** | `ioredis` | 5.6 |
| **Queues** | BullMQ | 5.53 |
| **Cron** | `node-cron` | 3.0 |
| **Auth** | Clerk (`@clerk/nextjs` 6.20, `@clerk/backend` 1.31, `@hono/clerk-auth` 2.0) | latest |
| **Webhook signature verification** | `svix` (Clerk webhooks) | 1.92 |
| **Billing** | Razorpay Node SDK | 2.9 |
| **AI SDKs** | `@anthropic-ai/sdk` 0.52, `openai` 4.98, raw `fetch` for Gemini & Perplexity | latest |
| **Google APIs** | `googleapis` | 148 |
| **External: DataForSEO** | REST API v3 (Basic Auth) | n/a |
| **Crawler** | Python (Scrapy) running in WSL2 — not in repo | n/a |
| **Dev runtime** | `tsx` watch mode | 4.19 |
| **Formatter** | Prettier | 3.5 |
| **Linter** | ESLint (Next config) | 8.57 |
| **Node version** | ≥ 20.0 | enforced in `package.json` |

---

## 5. Database Schema

### 5.1 PostgreSQL Tables

13 tables, all under the `public` schema. Every primary key uses `text` (CUID-style IDs from `createId()` in `packages/db/src/utils.ts`).

#### `organizations`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `name` | text NOT NULL | |
| `slug` | text NOT NULL UNIQUE | |
| `plan` | `plan` enum NOT NULL DEFAULT `'starter'` | `starter \| pro \| agency \| enterprise` |
| `stripe_customer_id` | text NULL | reserved |
| `razorpay_customer_id` | text NULL | |
| `created_at` / `updated_at` | timestamp NOT NULL DEFAULT now() | |

Purpose: tenant root. The `orgId` Clerk claim is matched to `organizations.id`; the `planLimits` middleware auto-creates the row in development if it does not exist.

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `org_id` | text FK → organizations.id (cascade) | |
| `clerk_user_id` | text NOT NULL UNIQUE | |
| `email` | text NOT NULL | |
| `role` | `role` enum DEFAULT `'viewer'` | `admin \| editor \| viewer` |
| `created_at` / `updated_at` | timestamp | |

#### `projects`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `org_id` | text FK → organizations.id (cascade) | |
| `domain` | text NOT NULL | |
| `name` | text NOT NULL | |
| `country_code` | text NOT NULL DEFAULT `'IN'` | |
| `language_code` | text NOT NULL DEFAULT `'en'` | |
| `gsc_connected` | boolean NOT NULL DEFAULT false | |
| `ga4_connected` | boolean NOT NULL DEFAULT false | |
| `settings` | jsonb NOT NULL DEFAULT `{}` | `{ competitors[], alertsEnabled, rankDropThreshold, crawlFrequency, gscPropertyUrl, ga4PropertyId }` |
| `created_at` / `updated_at` | timestamp | |

#### `tracked_keywords`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `project_id` | text FK → projects.id (cascade) | |
| `keyword` | text NOT NULL | |
| `location_code` | text NOT NULL | stored as string |
| `language_code` | text DEFAULT `'en'` | |
| `device` | `device` enum DEFAULT `'desktop'` | `desktop \| mobile` |
| `is_active` | boolean DEFAULT true | |
| `created_at` | timestamp | |

#### `keyword_lists`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `project_id` | text FK → projects.id (cascade) | |
| `name` | text NOT NULL | |
| `tags` | text[] NOT NULL DEFAULT `{}` | |
| `last_enriched_at` | timestamp NULL | **added 0003** |
| `created_at` | timestamp | |

#### `keyword_list_items`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `list_id` | text FK → keyword_lists.id (cascade) | |
| `keyword_id` | text FK → tracked_keywords.id (cascade) | |
| `volume` | integer NULL | **added 0003** |
| `kd` | integer NULL | **added 0003** |
| `cpc` | real NULL | **added 0003** |
| `intent` | text NULL | **added 0003** |

#### `audit_runs`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `project_id` | text FK → projects.id (cascade) | |
| `status` | `audit_status` enum DEFAULT `'pending'` | `pending \| running \| completed \| failed` |
| `pages_crawled` | integer DEFAULT 0 | |
| `total_issues`, `critical_issues`, `warnings`, `notices` | integer DEFAULT 0 | |
| `technical_score` | real NULL | 0–100 |
| `cwv_score` | real NULL | 0–100 |
| `crawled_pages` | jsonb NOT NULL DEFAULT `[]` | **added 0001** — `CrawledPageSummary[]` |
| `failure_reason` | text NULL | **added 0002** |
| `started_at` / `completed_at` | timestamp | |

#### `audit_issues`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `run_id` | text FK → audit_runs.id (cascade) | |
| `severity` | `severity` enum NOT NULL | `critical \| warning \| notice` |
| `category` | `issue_category` enum NOT NULL | `meta \| links \| speed \| content \| schema \| mobile \| security \| indexing \| cwv` |
| `url` | text NULL | first sample |
| `affected_urls` | text[] NOT NULL DEFAULT `{}` | **added 0001** |
| `title`, `description`, `recommendation` | text | |
| `affected_count` | integer DEFAULT 1 | |
| `created_at` | timestamp | |

#### `backlink_snapshots`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `project_id` | text FK → projects.id (cascade) | |
| `total_backlinks`, `referring_domains`, `domain_rank`, `new_backlinks`, `lost_backlinks` | integer | |
| `checked_at` | timestamp | |

#### `geo_prompts`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `project_id` | text FK → projects.id (cascade) | |
| `prompt_text` | text NOT NULL | |
| `platforms` | text[] DEFAULT `chatgpt,perplexity,gemini,google_aio` | |
| `is_active` | boolean DEFAULT true | |
| `created_at` | timestamp | |

#### `geo_results`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `prompt_id` | text FK → geo_prompts.id (cascade) | |
| `platform` | `geo_platform` enum | `chatgpt \| perplexity \| gemini \| google_aio` |
| `cited` | boolean DEFAULT false | |
| `citation_position` | integer NULL | |
| `response_text` | text DEFAULT `''` | truncated to 4,000 chars on insert |
| `checked_at` | timestamp | |

#### `reports`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `project_id` | text FK → projects.id (cascade) | |
| `type` | `report_type` enum | `full_seo \| keyword_report \| backlink_report \| audit_report \| competitor_report \| custom` |
| `status` | `report_status` enum | `pending \| generating \| ready \| failed` |
| `file_url` | text NULL | |
| `created_at` | timestamp | |

#### `billing`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `org_id` | text FK → organizations.id (cascade) | |
| `plan` | text NOT NULL DEFAULT `'starter'` | |
| `status` | `billing_status` enum | `active \| past_due \| cancelled \| trialing` |
| `stripe_subscription_id` | text NULL | reserved |
| `razorpay_subscription_id` | text NULL | |
| `current_period_end` | timestamp NULL | |
| `created_at` | timestamp | |

### 5.2 ClickHouse Tables

#### `rank_history`
```sql
CREATE TABLE rank_history (
  project_id        String,
  keyword_id        String,
  keyword           String,
  position          UInt16,
  previous_position UInt16,
  url               String,
  serp_features     Array(String),
  location_code     UInt32,
  device            String,
  checked_at        DateTime
) ENGINE = MergeTree()
ORDER BY (project_id, keyword_id, checked_at)
PARTITION BY toYYYYMM(checked_at);
```

#### `traffic_estimates`
```sql
CREATE TABLE traffic_estimates (
  project_id        String,
  estimated_traffic UInt32,
  visibility_score  Float32,
  organic_keywords  UInt32,
  date              Date
) ENGINE = MergeTree()
ORDER BY (project_id, date);
```

#### `keyword_metrics_history`
```sql
CREATE TABLE keyword_metrics_history (
  keyword_id          String,
  keyword             String,
  volume              UInt32,
  cpc                 Float32,
  keyword_difficulty  UInt8,
  recorded_at         Date
) ENGINE = MergeTree()
ORDER BY (keyword_id, recorded_at);
```

### 5.3 Redis Key Patterns

See §3.4. Sliding-window rate limiting uses ZSETs with score = epoch ms; default window is 60s / 120 requests per org (`apiRateLimit`); a `strictRateLimit` exists at 20 req/60s but is not currently mounted.

---

## 6. API Reference

Base URL: `http://localhost:3001/api` (dev). All `/api/*` routes pass through Clerk auth middleware (`clerkAuth` + `requireAuth`), which sets `userId` and `orgId` on the request context. Missing/invalid token → 401; valid user without an active org → 403. The Razorpay webhook (`POST /api/billing/webhook/razorpay`) is mounted **before** auth and verified by HMAC.

### 6.1 Projects (`/api/projects`)

| Method | Path | Body / params | Returns | Plan-gated |
|--------|------|---------------|---------|------------|
| GET | `/` | — | `{ projects: Project[] }` | — |
| GET | `/:id` | — | `{ project }` or 404 | — |
| POST | `/` | `{ domain, name, countryCode?, languageCode? }` | `{ project }` (201) | `enforcePlanLimit("projects")` |
| PATCH | `/:id` | partial fields + `settings.competitors[]`, `alertsEnabled`, `rankDropThreshold`, `crawlFrequency` | `{ project }` | — |
| DELETE | `/:id` | — | `{ success: true }` | — |

`createProjectSchema` validates `domain` against `^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$`.

### 6.2 Keywords (`/api/keywords`)

| Method | Path | Body / params | Returns |
|--------|------|---------------|---------|
| POST | `/overview` | `{ keyword, locationCode?, languageCode?, device? }` | `{ main: KeywordRow, related: KeywordRow[] }` (mock if DFS creds absent) — caches `kw:…:overview` (24h) |
| GET | `/ideas` | query: `keyword`, `location`/`locationCode`, `languageCode`, `device?` | `{ ideas: KeywordRow[] }` — caches `kw:…:ideas` (24h) |
| POST | `/ideas` | `{ keyword, locationCode?, languageCode? }` | same |
| POST | `/serp` | `{ keyword, locationCode?, device? }` | `{ organic: SerpOrganic[], paa: PaaQuestion[], serp_features: string[] }` — caches `serp:{sha256}` (6h) |
| POST | `/research` | `{ keyword, locationCode?, languageCode?, type: "suggestions" \| "ideas" \| "volume" }` | `{ type, results }` |
| POST | `/bulk` | `{ keywords[1..200], locationCode?, languageCode? }` | `{ results: KeywordBulkRow[] }` |
| POST | `/bulk-volume` | `{ keywords[1..700], locationCode?, languageCode? }` | `{ results }` |
| POST | `/strategy` | `{ topic, targetUrl?/url?, locationCode?, languageCode?, device? }` | Full Claude-generated strategy: `{ pillar, clusters[], content_calendar[], summary }` — mock when DFS or `ANTHROPIC_API_KEY` is absent |
| GET | `/projects/:projectId/tracked` | — | `{ keywords: TrackedKeyword[] }` |
| POST | `/projects/:projectId/tracked` | `{ keywords[1..100], locationCode?, languageCode?, device? }` | `{ keywords, added, duplicates }` (201) — dedup on `(projectId, keyword, locationCode, languageCode, device)` — `enforcePlanLimit("keywords")` |
| DELETE | `/projects/:projectId/tracked/:keywordId` | — | `{ success: true }` |
| GET | `/lists` | query: `projectId?` | `{ lists: KeywordListRecord[] }` — items joined with tracked keywords |
| POST | `/lists` | `{ name, projectId? }` | `{ list }` (201) |
| DELETE | `/lists/:listId` | — | `{ success: true }` |
| POST | `/lists/:listId/keywords` | `{ keywords[1..200], locationCode?, languageCode? }` | `{ added }` (201) — `enforcePlanLimit("keywords")` |
| GET | `/projects/:projectId/lists` | — | `{ lists }` (with items + keyword join) |
| POST | `/projects/:projectId/lists` | `{ name }` | `{ list }` (201) |
| DELETE | `/projects/:projectId/lists/:listId` | — | `{ success: true }` |
| POST | `/projects/:projectId/lists/:listId/keywords` | `{ keywords[1..100], locationCode?, languageCode? }` | `{ added }` (201) — `enforcePlanLimit("keywords")` |
| DELETE | `/projects/:projectId/lists/:listId/keywords/:itemId` | — | `{ success: true }` |
| GET | `/projects/:projectId/lists/:listId/export` | — | CSV file (Content-Disposition attachment) |
| POST | `/projects/:projectId/lists/:listId/enrich` | — | `{ enriched, failed }` — runs DFS `getBulkVolume` + `getBulkKeywordDifficulty`, updates per-item volume/kd/cpc/intent + sets `last_enriched_at` |
| POST | `/projects/:projectId/lists/:listId/move` | `{ keywordIds[1..500], targetListId }` | `{ moved }` — moves items to another list in the same project, dedupes against existing items in the target |

### 6.3 Rank (`/api/rank`)

| Method | Path | Returns |
|--------|------|---------|
| GET | `/projects/:projectId/history` (`?keywordId&days=30`) | Aggregated rank history per keyword from ClickHouse (or per-day series when `keywordId` supplied) |
| GET | `/projects/:projectId/visibility` | Last 90 days of `traffic_estimates` rows |
| POST | `/projects/:projectId/check-now` | `{ keywordIds? }` body → enqueues into `rank-checks` BullMQ queue, returns `{ queued }` |

### 6.4 Audit (`/api/audit`)

| Method | Path | Returns |
|--------|------|---------|
| POST | `/start` | `{ projectId }` body → 503 if `CRAWLER_URL` missing; 409 if already running; otherwise creates `audit_runs` row (status `pending`) and returns `{ auditRunId }` (202). Background job hits the Python crawler → runs `runAuditRules` → persists issues + crawled_pages summary. |
| GET | `/runs/:projectId` | Last 20 audit runs (descending) |
| GET | `/results/:auditRunId` (`?severity&category`) | `{ run, issues, grouped }` |
| GET | `/status/:auditRunId` | `{ status, pagesCrawled, startedAt, completedAt }` |

### 6.5 Backlinks (`/api/backlinks`)

| Method | Path | Returns |
|--------|------|---------|
| GET | `/projects/:projectId/summary` | Calls DataForSEO backlinks summary; inserts `backlink_snapshots` row; returns `{ summary }` |
| GET | `/projects/:projectId/backlinks` (`?limit=100&offset=0`) | `{ backlinks }` |
| GET | `/projects/:projectId/history` | Last 90 `backlink_snapshots` |

### 6.6 Competitors (`/api/competitors`)

| Method | Path | Returns |
|--------|------|---------|
| GET | `/projects/:projectId/overview` (`?locationCode`) | `{ domain, metrics, competitors }` from DataForSEO Labs |
| POST | `/projects/:projectId/compare` | `{ domains[1..5], locationCode }` → `{ comparison }` (bulk traffic estimation) |

### 6.7 GEO (`/api/geo`)

| Method | Path | Returns |
|--------|------|---------|
| GET | `/projects/:projectId/prompts` | All prompts for the project |
| POST | `/projects/:projectId/prompts` | `{ promptText, platforms? }` → `{ prompt }` (201) |
| POST | `/projects/:projectId/prompts/:promptId/check` | Enqueues GEO check via `geo-checks` queue → 202 |
| GET | `/projects/:projectId/results` | Last 200 `geo_results` |

### 6.8 Billing (`/api/billing`)

| Method | Path | Returns |
|--------|------|---------|
| GET | `/plans` | All four tier definitions |
| GET | `/subscription` | `{ subscription, plan, limits }` |
| POST | `/create-order` | `{ plan: "pro" \| "agency" }` → Razorpay order |
| POST | `/verify-payment` | HMAC-verified client confirmation → activates plan |
| POST | `/webhook/razorpay` | (mounted pre-auth) Server-to-server HMAC-verified webhook |

### 6.9 Health (`/health`)

Unauthenticated. Returns service status for Postgres / Redis / ClickHouse with latency, table existence checks, and write-read tests.

---

## 7. Feature Documentation

### 7.1 Keyword Intelligence

#### Keyword Overview (`/dashboard/keywords/overview`)
- **What it shows:** 5 metric cards (Volume, CPC, KD with color band, Intent, Competition), a 12-month trend chart with average ReferenceLine, a SERP Features grid (10 chips), a TanStack variations table with sort + bulk save, People Also Ask accordion, Top Ranking Pages list (favicons + position pill).
- **APIs:** `POST /api/keywords/overview` (main + related) + `POST /api/keywords/serp` (fires in parallel, slow path, cached for 6h).
- **DataForSEO endpoints used:** `keyword_suggestions/live`, `bulk_keyword_difficulty/live`, `serp/google/organic/task_post` + `task_get`.
- **Limitations:** Global volume card is intentionally hidden — DataForSEO does not return worldwide volume in the suggestions response and adding a second call was deferred. PAA + Top 10 only render when `serp_item_types` data is returned (hides when empty).

#### Keyword Ideas Generator (`/dashboard/keywords/ideas`)
- **What it shows:** Seed input, country + device selectors, collapsible filter panel (Volume / KD / CPC ranges, 4 intent checkboxes, include + exclude phrases) with an active-filter count badge on the Filters button, summary bar (count + 4 stat chips + Export All/Filtered CSV), 4 tabs (All / Questions / Low Competition / By Intent), TanStack table (25/page, sortable Volume/KD/CPC, optional trend sparkline column), sticky bulk action bar.
- **APIs:** `GET /api/keywords/ideas` (cached 24h).
- **DataForSEO endpoints used:** `keyword_ideas/live`.

#### Keyword Bulk Analysis (`/dashboard/keywords/bulk`)
- **What it shows:** Textarea (200 max with live count), CSV upload + Sample CSV, 7 stat chips (Total / Avg Vol / Avg KD colored / Avg CPC / High Volume>10K / Low KD<30 / Opportunities), filter bar (text search, intent dropdown, KD range, opportunities-only toggle), TanStack table with **opportunity highlighting** (green left border + light bg when Volume>1,000 AND KD<40), 25-row pagination, sticky bulk bar.
- **APIs:** `POST /api/keywords/bulk` (max 200 keywords).
- **DataForSEO endpoints:** `google_ads/search_volume/live` + `bulk_keyword_difficulty/live` in parallel.

#### Keyword Strategy Builder (`/dashboard/keywords/strategy`)
- **What it shows:** Topic input + optional target URL, country + device selectors, animated "thinking" loader with cycling messages, output sections — Summary card, gold/amber Pillar Keyword card (with rationale), 3–5 expandable Cluster cards (pillar page + supporting keywords with Quick Win green badges + Save All in Cluster), Content Calendar timeline grouped by week with priority dots, sticky actions bar (Regenerate / Export CSV / Save All to List).
- **APIs:** `POST /api/keywords/strategy`.
- **AI used:** Anthropic Claude **`claude-sonnet-4-6`**, system prompt directs JSON-only output, schema enforced via in-prompt template, response parsed with markdown-fence stripping.
- **Mock fallback:** When `ANTHROPIC_API_KEY` or DataForSEO creds are missing, returns a topic-themed 4-cluster sample strategy.

#### Keyword Lists (`/dashboard/keywords/lists`)
- **What it shows:** Left panel with project filter, instant-search input, list cards (name, project, count, **Avg KD + Avg Volume + Last Enriched**). Right panel: header with Enrich / Track All / Add Keywords / Export CSV / Delete buttons; filter bar (intent, KD range, min volume); TanStack table with sortable Keyword / Volume / KD / CPC / Intent / Location / Device / Added; sticky bulk bar (Track / Move to List / Export Selected / Delete).
- **APIs added in this build:** `POST /api/keywords/projects/:projectId/lists/:listId/enrich`, `POST /api/keywords/projects/:projectId/lists/:listId/move`.

### 7.2 Rank Tracker (`/dashboard/rank-tracker`)

#### Rank Tracking Setup
- Empty-state form when the project has 0 tracked keywords. Textarea (100 max), country selector, device selector with Desktop / Mobile / **Both** (the "Both" option fires the API twice). On submit calls `POST /api/keywords/projects/:projectId/tracked` and surfaces `{ added, duplicates }`.

#### Position Monitoring
- Five metric cards: **Visibility Score**, **Top 3**, **Top 10**, **Top 100**, **Avg Position**. Cards self-badge with the purple "Sample Data" pill when ClickHouse is empty.
- Visibility trend chart with 7d / 30d / 60d / 90d toggles, gradient area fill.
- Keywords table with: keyword + device chip, Best, Current (color-coded pill: green ≤3, blue ≤10, gray ≤100, red >100), Change (▲/▼/—), Volume, CPC, ranking URL, SERP feature icon row, Delete.
- Filter bar: search, position bucket, change bucket, device.
- Detail drawer: position history chart (reversed Y-axis), SERP screenshot placeholder, sample competitor list with favicons.

#### Visibility Score
The worker `packages/workers/src/rank-worker.ts` exports `calculateVisibilityScore(keywords)`. Algorithm: weighted CTR by volume across a Google CTR curve (positions 1–10 with `pos 1 = 0.317` down to `pos 10 = 0.015`; positions beyond 10 contribute `0.01`). Score = `100 × (Σ CTR × volume) / Σ volume`.

#### Rank Alerts
The `rank-checks` worker calls `sendAlert(projectId, keyword, fromPosition, toPosition)` when current position drops ≥ 5 from previous. The alert sink is injected at worker construction time (currently no concrete sender wired in production).

### 7.3 Site Audit (`/dashboard/audit`)

#### Crawler Integration
- API route `POST /api/audit/start` calls `POST {CRAWLER_URL}/crawl-site { domain, max_pages: 9999, use_js: false }` with a 10-minute fetch timeout.
- `CRAWLER_URL` is mandatory — missing env returns 503; the run is also marked failed with `failure_reason: "Crawler not configured — CRAWLER_URL is missing"`.
- The crawler returns a `CrawlResult` shape (defined in `apps/api/src/lib/audit-rules.ts`): `{ domain, pages: Array<CrawledPage> }`, where each page has `url`, `status_code`, `title`, `meta_description`, `h1[]`, `word_count`, `internal_links[]`, `external_links[]`, `images_without_alt`, `has_json_ld`, `has_viewport`, `canonical`, `meta_robots`, `ttfb_ms`, `is_https`, `redirect_chain[]`.

#### Audit Rules Engine (23 rules)
`apps/api/src/lib/audit-rules.ts` — entirely in TypeScript, runs after the crawl returns. PageSpeed Insights is fetched once for the homepage (mobile strategy) when `GOOGLE_PAGESPEED_API_KEY` is set.

| # | Category | Severity | Trigger |
|---|----------|----------|---------|
| 1 | meta | critical | Missing Title Tag |
| 2 | meta | warning | Title > 60 chars |
| 3 | meta | warning | Title < 30 chars |
| 4 | meta | warning | Missing meta description |
| 5 | meta | warning | Meta description > 160 chars |
| 6 | meta | notice | Meta description < 70 chars |
| 7 | meta | warning | Missing H1 |
| 8 | meta | warning | Multiple H1 tags |
| 9 | links | critical | Status 404 |
| 10 | links | warning | Orphan pages (no internal links pointing to them) |
| 11 | links | warning | Redirect chain (> 1 hop) |
| 12 | speed | warning | TTFB > 600 ms |
| 13 | speed | warning | Images without alt text |
| 14 | content | warning | Word count < 300 |
| 15 | content | notice | No outbound links |
| 16 | schema | notice | No JSON-LD |
| 17 | mobile | critical | Missing viewport meta |
| 18 | security | critical | Not HTTPS |
| 19 | indexing | warning | `noindex` directive in meta robots |
| 20 | indexing | notice | Missing canonical |
| 21 | cwv | critical | LCP > 2.5 s (PageSpeed) |
| 22 | cwv | warning | CLS > 0.1 (PageSpeed) |
| 23 | cwv | critical | Performance score < 50 (PageSpeed) |

#### Health Score Calculation
```
healthScore = max(0, round(100
  − min(criticals_excluding_cwv × 5, 40)
  − min(warnings_excluding_cwv × 2, 30)
  − min(notices_excluding_cwv × 0.5, 15)
  − cwvFailures × 5))
cwvScore = round(max(0, 100 − cwvFailures × 34))
```

Score band labels: ≥ 90 Excellent (green), ≥ 70 Good (blue), ≥ 50 Needs Work (yellow), < 50 Critical (red).

#### Issue Categories (9)
`meta`, `links`, `speed`, `content`, `schema`, `mobile`, `security`, `indexing`, `cwv`. The audit detail page groups these into four breakdown cards in the browser:
- **Technical** = meta + links + indexing + schema + mobile
- **Content** = content
- **Speed** = speed + cwv
- **Security** = security

### 7.4 SERP Intelligence

#### SERP Features Detection
Sourced from `serp_item_types` in the DataForSEO suggestions response **plus** the live SERP call. UI renders 10 chips: Featured Snippet, People Also Ask, Video Pack, Image Pack, Local Pack, Shopping, AI Overview, Top Stories, Sitelinks, Knowledge Panel. Active chip = colored; inactive = gray.

#### People Also Ask
Extracted from the SERP response items where `type === "people_also_ask"`. Each entry has `question`, optional `featured_title`, optional `featured_url`. Accordion-style UI, show 8 initially, "Show more" reveals 8 more. Save-to-list available per question.

#### Top Ranking Pages
Top 10 organic results (`type === "organic"` in the SERP items). Card list (not table) with position pill (gold 1st, silver 2nd, bronze 3rd, gray 4–10), favicon via `https://www.google.com/s2/favicons?sz=32&domain=...`, domain, URL path, title with tooltip when > 60 chars, line-clamped description.

### 7.5 GEO / AI Visibility Tracker (`/dashboard/geo-tracker`)
- **Schema:** `geo_prompts` + `geo_results` (cited boolean, citationPosition, responseText truncated to 4,000 chars).
- **Backend:** Full API (CRUD prompts, queue check) + BullMQ `geo-checks` worker calls OpenAI (`gpt-4o-mini`), Perplexity (`sonar`), Gemini (`gemini-2.0-flash`) in parallel; substring-matches the target domain in the response.
- **Frontend:** Page shell exists (`apps/web/app/dashboard/geo-tracker/page.tsx`); full prompt-management UI not yet built.

### 7.6 Backlinks (`/dashboard/backlinks`)
- **Schema:** `backlink_snapshots`.
- **Backend:** `GET /summary`, `GET /backlinks`, `GET /history` — all wired to DataForSEO `/v3/backlinks/...` endpoints with 12h caching.
- **Frontend:** Page shell exists; full table + filters UI pending.

### 7.7 Competitors (`/dashboard/competitors`)
- **Backend:** `GET /overview`, `POST /compare` (1–5 domains, bulk traffic estimation).
- **Frontend:** Page shell exists; competitor overview table pending. The dashboard `CompetitorSnapshot` widget consumes `project.settings.competitors[]` with sample stats.

### 7.8 Content Module (`/dashboard/content`)
- **Backend:** AI worker has `content_analysis` and `content_brief` task types backed by Claude Sonnet with prompt caching on the SEO rubric system prompt.
- **Frontend:** Page shell only.

### 7.9 Reports (`/dashboard/reports`)
- **Schema:** `reports` table with 6 types and 4 status states.
- **Backend:** BullMQ worker exists; PDF generation is a placeholder (`Buffer.from("PDF report: ...")`) pending `@react-pdf/renderer` integration.
- **Frontend:** Page shell only.

---

## 8. External API Integrations

### DataForSEO
- **Authentication:** Basic Auth (`DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD`).
- **Rate limit:** Token-bucket limiter in-client (default 2,000 req/min); 3 retries with exponential backoff + 500 ms jitter on 429 / 5xx.
- **Endpoints used:**
  - `POST /v3/dataforseo_labs/google/keyword_suggestions/live` (Keyword Overview)
  - `POST /v3/dataforseo_labs/google/keyword_ideas/live` (Keyword Ideas)
  - `POST /v3/dataforseo_labs/google/bulk_keyword_difficulty/live` (KD enrichment)
  - `POST /v3/dataforseo_labs/google/domain_metrics_by_categories/live` (Competitor overview)
  - `POST /v3/dataforseo_labs/google/competitors_domain/live` (Competitor discovery)
  - `POST /v3/dataforseo_labs/google/bulk_traffic_estimation/live` (Multi-domain compare)
  - `POST /v3/keywords_data/google_ads/search_volume/live` (Bulk volume + CPC)
  - `POST /v3/serp/google/organic/task_post` + `GET .../task_get/:id` (SERP organic + PAA + features — polled in `SerpClient.getOrganicResults`)
  - `POST /v3/backlinks/summary/live` (Backlink summary)
  - `POST /v3/backlinks/backlinks/live` (Backlink list with new/lost filters)
  - `POST /v3/on_page/task_post`, `/v3/on_page/pages`, `/v3/on_page/issues_summary`, `/v3/on_page/summary` (OnPage — currently dormant code path)
- **Mock fallback:** When credentials are absent, the keyword overview / ideas / bulk / strategy / serp / enrich routes return deterministic mock data with the same shape.

### Google Search Console
- `googleapis@148` OAuth2 client. Methods: `getTopKeywords`, `getTopPages`, `getKeywordsByPage`, `listProperties`. Token storage on the project / user side is **not yet implemented** — credentials must be supplied at client construction.

### Google PageSpeed Insights
- `https://www.googleapis.com/pagespeedonline/v5/runPagespeed`. API key from `GOOGLE_PAGESPEED_API_KEY`. Called once per audit run against the homepage (mobile strategy). 30-second fetch timeout. Failure is non-fatal — audit proceeds without CWV signals.

### Google Ads API
- Mentioned in the user's initial prompt but **not wired in code**. Not present in `packages/google-apis/src/`.

### Anthropic Claude (`packages/ai/src/claude.ts`)
- Model constants: `SONNET = "claude-sonnet-4-6"`, `HAIKU = "claude-haiku-4-5-20251001"`.
- Methods: `analyzeContent` (Sonnet + prompt-cached SEO rubric system prompt), `generateContentBrief` (Sonnet), `classifyIssue` (Haiku), `summarizeRankMovement` (Haiku), `generateKeywordStrategy` (Sonnet, JSON-mode, used by `/keywords/strategy`).
- Auth via `ANTHROPIC_API_KEY`. Mock fallback in the strategy route.

### OpenAI (`packages/ai/src/openai.ts`)
- Model: `gpt-4o-mini`. Used only by the GEO tracker (`checkGEOVisibility`). Auth via `OPENAI_API_KEY`.

### Google Gemini (`packages/ai/src/gemini.ts`)
- Model: `gemini-2.0-flash`. Raw fetch to `https://generativelanguage.googleapis.com/v1beta`. Auth via `GEMINI_API_KEY` (query param).

### Perplexity (`packages/ai/src/perplexity.ts`)
- Model: `sonar`. Auth via `PERPLEXITY_API_KEY` (Bearer).

### Clerk
- Frontend via `@clerk/nextjs`, backend via `@hono/clerk-auth` (Bearer JWT verification). Webhook handler exists at `apps/web/app/api/webhooks/clerk/route.ts` for org/user lifecycle.

### Razorpay
- Server SDK for order creation. HMAC-SHA256 signature verification on both client callback (`/verify-payment`) and the server webhook (`/webhook/razorpay`). Period is 1 month from activation.

---

## 9. Authentication & Security

- **Auth:** Clerk JWT, verified on every `/api/*` request by `clerkAuth` + `requireAuth`. Missing user → 401. Missing active org → 403.
- **Multi-tenancy isolation:** Every query that touches tenant data joins on `orgId` extracted from the JWT. `enforcePlanLimit` middleware auto-creates the `organizations` row on first use to support local-dev where the Clerk webhook has not fired.
- **Row-level security:** Application-level only — no Postgres RLS policies. The orgId filter is in every query.
- **Rate limiting:** Sliding-window via Redis ZSET. Default `apiRateLimit` = 120 requests / 60 seconds per org (or per IP if no org). Strict variant exists (`strictRateLimit` 20/min) but is not currently mounted on any route.
- **Webhook signature verification:** Razorpay (`x-razorpay-signature` HMAC-SHA256) and Clerk (via `svix`).
- **Secrets:** All env-based; `.env.example` documents the full surface.
- **Plan limits:** `enforcePlanLimit("projects" | "keywords")` returns 402 with an explanatory body when the org exceeds its plan's count.
- **Audit reconciliation:** On API boot, `reconcileStuckAudits()` flips any `audit_runs` with `status='running' AND started_at < now() − 15min` to `failed` with `failureReason: "Interrupted — server restarted"`.

---

## 10. Billing & Plans

- **Plan store:** `organizations.plan` enum + `billing` row per org.
- **Limit enforcement:** `apps/api/src/middleware/planLimits.ts` queries the current count of `projects` or `tracked_keywords` for the org and returns 402 with `{ error: "Plan limit reached", resource, limit, current, upgrade: true, message }` when over.
- **Razorpay flow:** Client requests `/create-order` → opens Razorpay checkout → on success calls `/verify-payment` (HMAC-verified) OR the server webhook arrives at `/webhook/razorpay`. Both paths call `activatePlan(db, orgId, plan, paymentId)` which upserts the billing row and updates `organizations.plan`.
- **Grace period:** On `payment.failed`, the billing row is flipped to `past_due` but plan-limit middleware does not currently downgrade the org. No automatic recheck job.

---

## 11. Cost Model

Per-call DataForSEO costs are not stored aggregately — the API client logs `data.cost` per response (see `packages/dataforseo/src/client.ts`), but no per-tenant accounting table exists. The numbers below are based on public DataForSEO pricing (subject to change) and observed monthly usage patterns.

### 11.1 API Cost Per User Per Month (estimate)

| Feature | External API | ~Cost per call (USD) | ~Calls per user / mo |
|---------|--------------|----------------------|----------------------|
| Keyword Overview | DFS suggestions + KD | $0.0005 + $0.0002 | 200 |
| Keyword Ideas | DFS keyword_ideas | $0.001 | 100 |
| Keyword Bulk (200) | DFS bulk_volume + bulk_KD | $0.005 + $0.002 | 20 |
| SERP (organic + PAA + features) | DFS SERP task | $0.0006 | 50 |
| Strategy Builder | Claude Sonnet (~3 KB out) | $0.02 | 20 |
| Rank tracking (per keyword / day) | DFS SERP | $0.0006 | varies by plan |
| Audit | Custom crawler ($0) + PageSpeed (free) + 0 DFS | $0 | 4 |
| GEO check | OpenAI + Perplexity + Gemini | $0.005 combined | 30 |

**Rough estimates (highly approximate, dependent on usage):**

| Plan | Approx. monthly variable cost / user | Plan revenue |
|------|--------------------------------------|--------------|
| Starter | < $1 | $0 |
| Pro | $6–10 | $36 |
| Agency | $30–55 | $96 |

### 11.2 Gross Margin Analysis

Conservative bracket: Pro ~75% gross margin; Agency ~50% gross margin. Cache hit rate has outsized impact — Redis caching on overview / ideas / serp / KD / domain metrics (TTL 6h–24h) is the primary cost lever.

---

## 12. Build Status

| Module | Status | What works | What's missing |
|--------|--------|------------|----------------|
| Auth (Clerk) | ✅ | JWT, org switcher, webhook handler | — |
| Billing (Razorpay) | 🟡 | Plan defs, create-order, verify-payment, webhook, activate-on-paid | Subscription cancel, dunning flow, grace-period downgrade |
| Dashboard | ✅ | Project selector, 4 stat cards, rank chart, top movers, alerts, project health, GSC card, issues summary, competitor snapshot | Real top-movers + alerts (currently sample) |
| Project CRUD | ✅ | Create / read / update / delete with plan limits | — |
| Keyword Overview | ✅ | 5 metric cards, chart with avg line, SERP features, variations table, PAA, Top 10 | Global volume (intentionally omitted) |
| Keyword Ideas | ✅ | Seed + filters + tabs + paginated table + bulk save + CSV export | — |
| Keyword Bulk | ✅ | Up to 200 kw, opportunity highlighting, filter bar, CSV | — |
| Keyword Strategy | ✅ | Claude AI generation, 4-cluster output, content calendar, exports | Brief regeneration on a single cluster |
| Keyword Lists | ✅ | Enrich, Move, Track All, sortable + filterable items table | — |
| Rank Tracker | 🟡 | Setup form, metrics, chart, table, filters, detail drawer | Real ClickHouse data dependent on the rank worker running on a schedule |
| Site Audit | ✅ | Pre/during/post states, 23 rules, score breakdown, severity tabs, expandable issue rows, crawled pages table, export PDF | "All affected URLs" expand for issues from runs predating migration 0001 — empty |
| Backlinks | 🔶 | Full API + DataForSEO integration + snapshots schema | UI: only page shell |
| Competitors | 🔶 | API + DataForSEO Labs integration | UI: only page shell |
| GEO Tracker | 🔶 | API + 3-platform worker + schema | UI: only page shell |
| Content | 🔶 | AI worker handles content_analysis + content_brief | UI: only page shell |
| Reports | 🔶 | Schema + worker shell | PDF rendering (`@react-pdf/renderer`) + UI |
| Settings | 🔶 | Page shell | All settings UIs |

Legend: ✅ Production-ready · 🟡 Functional, needs polish · 🔶 Scaffolded (schema + API ready, UI pending) · ❌ Not started.

---

## 13. Known Issues & Limitations

- **ClickHouse optional in dev:** When `CLICKHOUSE_URL` is unset or the service is down, rank/visibility endpoints return empty arrays. The frontend falls back to per-keyword deterministic mock data and displays a "Sample Data" badge.
- **Rank worker not on a schedule:** `rank-checks` queue exists, the worker is implemented, but there is no cron in `packages/workers/src/index.ts` that schedules daily checks. Triggered today only via `POST /api/rank/projects/:projectId/check-now`.
- **Reports PDF placeholder:** `report-worker.ts` writes a literal `Buffer.from("PDF report: …")` and uploads it. Real renderer not implemented.
- **GSC OAuth flow incomplete:** `SearchConsoleClient` constructor accepts tokens but there is no project-side OAuth flow or token storage.
- **Google Ads API:** Not implemented despite being listed in the original requirements.
- **GEO tracker `google_aio` platform enum:** Recognised in the schema but no client implements it.
- **Crawler reachability:** `CRAWLER_URL` is a WSL2 NAT IP that changes on every WSL boot; fallback removed from code on purpose — the API now refuses to start an audit if `CRAWLER_URL` is unset and surfaces a clear 503.
- **Audit run reconciliation:** On API restart, runs older than 15 min in `running` state are marked failed. Younger orphans persist as `running` until the next restart.
- **Sidebar collapse:** Not implemented.
- **Breadcrumbs:** Not implemented.
- **Dead code:** `packages/workers/src/audit-worker.ts` uses DataForSEO OnPage instead of the WSL2 crawler; not wired into any route. Kept as a fallback option.
- **Cosmetic:** Some `useEffect` hooks restore from localStorage with `[selectedProjectId]` in deps; the dashboard + rank tracker pages now guard the restore with a `useRef` to avoid a re-render loop on project switch (fixed at the end of the May 2026 build pass).

---

## 14. Development Setup

### Prerequisites
- Node.js ≥ 20 + npm ≥ 10
- Postgres 15+
- Redis 7+
- ClickHouse (optional in dev — rank features fall back to mock)
- WSL2 + Python 3.11+ for the Scrapy crawler (optional in dev — audit will fail with a clear error if `CRAWLER_URL` is unset)

### Environment variables (`.env.example` in repo root)
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/garage_seo
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DATABASE=garage_seo
REDIS_URL=redis://localhost:6379

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=

GOOGLE_PAGESPEED_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_GEMINI_API_KEY=
PERPLEXITY_API_KEY=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001

CRAWLER_URL=http://localhost:5001
CRAWLER_TYPE=scrapy
```

### Boot steps
```bash
# 1. Install
npm install

# 2. Migrate Postgres (and ClickHouse if running)
npm run db:migrate

# 3. Seed (optional)
npm run db:seed

# 4. Start both apps (run in two terminals)
cd apps/api && npm run dev   # → :3001
cd apps/web && npm run dev   # → :3000

# 5. (Optional) Start the audit crawler in WSL2
#    in WSL2 Ubuntu shell:
#    cd /path/to/visibilityos-crawler
#    source .venv/bin/activate
#    python -m crawler.server   # listens on :5001
#    hostname -I                # grab WSL IP → set CRAWLER_URL=http://<ip>:5001 in .env
```

### Dev ports
| Service | Port | Notes |
|---------|------|-------|
| Next.js web | 3000 | Falls through to 3001/3002 if busy |
| Hono API | 3001 | |
| Postgres | 5432 | |
| Redis | 6379 | |
| ClickHouse HTTP | 8123 | Optional |
| WSL2 crawler | 5001 | |

---

## 15. Deployment

The repository does not contain CI/CD configuration (no `.github/workflows/`, no `Dockerfile`s). A reference deployment shape:

- **One VPS** (8 vCPU / 16 GB / 100 GB SSD) running the API + web (PM2 or systemd), the Python crawler (separately or alongside), and a single Node process per service.
- **Managed Postgres** (Supabase / Neon / RDS).
- **Managed ClickHouse** (ClickHouse Cloud or self-hosted).
- **Managed Redis** (Upstash / Elasticache).
- **Object storage** for PDF reports (S3 / R2) — the storage adapter passed into `createReportWorker` is currently injected by the worker bootstrap.
- **Environment:** all secrets from §14 supplied at the platform level.
- **Backup:** Postgres logical dumps daily; ClickHouse partition-level backups weekly. No automation in this repository.

CI/CD recommendation: a single GitHub Actions workflow that runs `turbo run type-check lint build test`, deploys via SSH + PM2 reload, runs `npm run db:migrate` before reload.

---

## 16. Roadmap

### Phase 2 — Next 30 days

| Item | Why |
|------|-----|
| Backlinks UI | API + data wired; just needs a TanStack table view |
| Competitors UI | DFS Labs already returns the data; render it |
| GEO Tracker UI | Worker + schema + 3 LLM clients in place; needs CRUD UI + results visualizer |
| Rank check scheduler | Add `node-cron` daily trigger that enqueues `rank-checks` for every active tracked keyword |
| Reports PDF | Swap the placeholder buffer for `@react-pdf/renderer` templates |
| GSC OAuth flow | OAuth start + callback + token storage on `projects.settings` |
| Sidebar collapse + breadcrumbs | Universal UX gap |

### Phase 3 — Future

| Item | Where it's hinted in the codebase |
|------|------------------------------------|
| Content brief generator UI | Claude `generateContentBrief` exists; no UI |
| Issue auto-classification via Claude Haiku | `classifyIssue` method exists in the AI worker |
| Weekly rank digest email | `summarizeRankMovement` method exists |
| White-label dashboards (agency plan) | Listed as a feature on the Agency plan |
| Client-facing dashboards | Same |
| Google Ads API integration | Required by original spec; not started |
| `google_aio` GEO platform | Recognised in the `geo_platform` enum but no client |
| Subscription dunning + cancel flow | Razorpay endpoints exist; UI/UX not built |

---

## Appendix A — DataForSEO endpoints used

```
/v3/dataforseo_labs/google/keyword_suggestions/live
/v3/dataforseo_labs/google/keyword_ideas/live
/v3/dataforseo_labs/google/bulk_keyword_difficulty/live
/v3/dataforseo_labs/google/domain_metrics_by_categories/live
/v3/dataforseo_labs/google/competitors_domain/live
/v3/dataforseo_labs/google/bulk_traffic_estimation/live
/v3/keywords_data/google_ads/search_volume/live
/v3/serp/google/organic/task_post
/v3/serp/google/organic/task_get/:taskId
/v3/backlinks/summary/live
/v3/backlinks/backlinks/live
/v3/on_page/task_post           # dormant
/v3/on_page/pages               # dormant
/v3/on_page/issues_summary      # dormant
/v3/on_page/summary             # dormant
```

## Appendix B — Database migrations

| File | What it adds |
|------|--------------|
| `0000_brief_thunderball.sql` | Initial schema — 13 tables + 9 enums |
| `0001_premium_lockjaw.sql` | `audit_issues.affected_urls text[]`, `audit_runs.crawled_pages jsonb` |
| `0002_tough_meggan.sql` | `audit_runs.failure_reason text` |
| `0003_shallow_gideon.sql` | `keyword_list_items.volume / kd / cpc / intent`, `keyword_lists.last_enriched_at` |

## Appendix C — Component library

### `components/ui/` — shadcn-style primitives
`badge` · `button` · `card` · `checkbox` · `dialog` · `input` · `label` · `select` · `separator` · `skeleton` · `table` · `tabs` · `textarea` · `tooltip`

### `components/shared/`
`circular-score` · `country-selector` · `device-toggle` · `empty-state` · `info-tooltip` · `metric-card` · `mini-progress` · `sample-data-badge`

### `components/dashboard/`
`competitor-snapshot` · `gsc-connection-card` · `issues-summary` · `project-health-card` · `project-selector` · `quick-actions-card` · `rank-movements-chart` · `recent-alerts` · `sidebar-nav` · `top-movers-table`

### `components/audit/`
`audit-checks-grid` · `audit-history-card` · `crawled-pages-table` · `crawling-indicator` · `issues-list` · `score-breakdown`

### `components/keywords/`
`bulk-summary-bar` · `competition-badge` · `ideas-filter-panel` · `ideas-summary-bar` · `intent-badge` · `kd-badge` · `keyword-variations-table` · `people-also-ask` · `save-to-list-dialog` · `serp-features-grid` · `serp-top10` · `sparkline` · `strategy-calendar` · `strategy-cluster-card` · `strategy-loading` · `strategy-pillar-card` · `strategy-summary`

### `components/providers/`
`query-provider` (TanStack Query)
