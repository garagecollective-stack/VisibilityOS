# Visibility OS

Visibility OS is a multi-tenant SEO and search visibility platform for agencies, freelancers, and in-house SEO teams. It brings keyword intelligence, rank tracking, site auditing, backlink analysis, competitor intelligence, AI answer-engine visibility, reporting, billing, and workspace management into one web application.

The product is designed as a cost-conscious alternative to enterprise SEO platforms by combining paid SEO data sources, Google APIs, AI analysis, caching, background workers, and a modular TypeScript monorepo.

## What This Project Is

Visibility OS is an SEO operating system with these major product areas:

- Keyword intelligence and keyword strategy workflows.
- Daily rank tracking with visibility scoring and competitor comparison.
- Technical SEO audits with crawler-driven checks and PageSpeed metrics.
- Backlink analysis, toxic-link review, and backlink gap discovery.
- Competitor intelligence for traffic, top pages, and keyword gaps.
- GEO / AI visibility tracking for ChatGPT, Perplexity, Gemini, and AI Overview style results.
- Content optimization, content briefs, schema support, and topical authority planning.
- E-E-A-T auditing for trust, expertise, and YMYL-focused signals.
- Unified SEO health scoring across technical, authority, content, ranking, and AI visibility.
- Google integrations for Search Console, Analytics, PageSpeed, and planned Keyword Planner support.
- Reporting, white-label report generation, and client-facing workspace views.
- Multi-workspace and team support with role-based access control.

The full product scope is documented in [complete-features-list.md](./complete-features-list.md).

## Current Status

This repository contains a working beta foundation for the Visibility OS web application. Several core workflows are implemented or close to production-ready, while other modules are scaffolded with schemas, service clients, APIs, workers, or placeholder UI.

### Recent Changes

- API startup resilience: the API now performs a one-time reconciliation on boot for stale audit runs. Any `running` audit older than 15 minutes is marked `failed` with an interrupted-by-restart reason, preventing audit history from staying permanently stuck after a server restart.
- Reports module: full `/api/reports` API (generate/list/get), reports list page, per-report preview page (`dashboard/reports/[reportId]`), and 8 section components: executive summary, site health, Core Web Vitals, keyword rankings, GSC performance, technical issues, AI search, recommendations.
- Backlinks overhaul: expanded `/api/backlinks` with growth, anchor-text, and referring-domain endpoints; new UI components for overview cards, growth chart, anchor-text chart, backlinks table, referring-domains table, and new/lost panel. The page is no longer a shell.
- Settings module: new `/api/settings` route plus a tabbed UI covering organization, project, notifications, team members, API keys, and a danger zone. Reads/writes `projectSettings` and new organization settings columns.
- PageSpeed widget: new dashboard widget powered by a `pagespeed_results` table; surfaces Core Web Vitals + lab metrics on the main dashboard alongside the existing competitor snapshot enhancements.
- Database: four new migrations: `0007_pagespeed_results`, `0008_reports_columns`, `0009_org_settings`, and `0010_locations_table`, plus schema updates to `reports`, `organizations`, `projects`, `audit`, and `locations`.
- Cascading Country -> State -> City location filter for keyword research: new `locations` table, DataForSEO seed script (India: 1 country, 29 states, 7 union territories, 2,729 cities), public `/api/locations/*` endpoints, reusable `LocationFilter` component, and end-to-end integration on Keyword Overview, Ideas, Bulk, and Strategy pages with auto re-fetch on selection change.
- API CORS now accepts any `http://localhost:<port>` in non-production so the Next.js dev server still works when it falls back to a port outside the explicit allowlist (e.g. 3001/3002 when 3000 is in use).
- GSC integration: project-level OAuth, encrypted token storage, property selection, and daily sync.
- Competitor intelligence: full UI with competitor cards, keyword gap, common keywords, top pages, and backlink comparison.
- Account management: profile, organization, integrations, and billing tabs under `dashboard/account`.
- Dashboard enhancements: new sidebar plus domain analytics, position tracking, SEM, site audit, and PageSpeed widgets.

### Current Execution Snapshot

Last checked locally on May 18, 2026 from the repository root.

- `npm run type-check` passes across all seven workspaces: `@garage-seo/ai`, `@garage-seo/api`, `@garage-seo/dataforseo`, `@garage-seo/db`, `@garage-seo/google-apis`, `@garage-seo/web`, and `@garage-seo/workers`.
- `npm run build` currently compiles the TypeScript packages and API, but the web build is blocked in restricted/offline environments because `next/font` fetches the Inter font from Google Fonts during `apps/web` production build.
- `npm run test` currently stops in `@garage-seo/dataforseo` because its Vitest command runs, but no `*.test.*` or `*.spec.*` files are present yet.
- `npm run dev` is the current full local execution command and delegates to Turborepo. For more control, start the API and web apps separately from `apps/api` and `apps/web`.
- Local development expects PostgreSQL, Redis, and optionally ClickHouse to be available through `.env`. External SEO, AI, billing, and Google credentials can be omitted only for flows that support sample/mock fallback behavior.

### Achieved / Working

- **Monorepo foundation** using Turborepo, npm workspaces, TypeScript, shared packages, and app-level builds.
- **Frontend application** in Next.js 14 App Router with Tailwind CSS, Radix UI primitives, TanStack Query, TanStack Table, Recharts, Zustand, and Clerk authentication screens.
- **Backend API** in Hono running on Node.js with secure headers, CORS, request logging, Clerk auth middleware, rate limiting, and protected `/api/*` routes.
- **Authentication and multi-tenancy foundation** using Clerk, organizations, users, projects, middleware, and plan-limit enforcement.
- **Project management** APIs and UI patterns for creating projects, selecting projects, configuring countries, enabling Google integrations, and storing competitor settings.
- **Dashboard** with project health, rank movement charts, top movers, quick actions, alerts, GSC connection status, issue summary, competitor snapshot, and module widgets (domain analytics, position tracking, SEM, site audit).
- **Competitor intelligence** with competitor selection/discovery, competitor cards, keyword gap analysis, common keywords, top pages, and backlink comparison.
- **Google Search Console integration** with per-project OAuth start/callback, encrypted token storage, property selection, manual sync, and disconnect flows.
- **Account & integrations** page with profile, organization, integrations, and billing tabs, plus `/api/account/integrations` and `/api/account/usage` endpoints.
- **Keyword overview** with the cascading Country → State → City location filter, device selector, metrics, 12-month trend chart, SERP feature display, related variations, People Also Ask, top organic results, and save-to-list flow.
- **Keyword ideas** with seed search, location filter, filter panel, volume/KD/CPC ranges, intent filters, include/exclude filters, summary bar, tabs, sortable table, pagination, and bulk actions.
- **Bulk keyword analysis** for up to 200 keywords with location filter, metrics, opportunity highlighting, CSV export, and list saving.
- **Keyword strategy builder** with location filter plus AI strategy generation and UI components for clusters, pillars, summary, calendar, and loading states.
- **Location intelligence** with a `locations` table seeded from the DataForSEO Google Ads locations API (India only for now), public cascading `/api/locations/countries`, `/api/locations/states`, and `/api/locations/cities` endpoints, and a reusable `LocationFilter` component that auto re-fetches keyword data when the selection changes.
- **Keyword lists** with list management, enrichment, movement between lists, bulk actions, and track-to-rank-tracker workflows.
- **Rank tracker** with setup flow, tracked keyword cards, visibility chart ranges, rank tables, filters, position badges, and historical detail views.
- **Site audit workflow** with API routes, audit run tracking, startup reconciliation for stale running audits, crawler integration hook, TypeScript audit rules, score breakdown, issue lists, crawled page table, comparison/progress/statistics tabs, and CSV export.
- **Backlinks module** with overview cards, growth chart, anchor-text chart, backlinks table, referring-domains table, and new/lost backlinks panel, backed by `/api/backlinks` endpoints for growth, anchors, and domains.
- **Reports module** with generate/list/get API, reports list page, per-report preview page, a generate-report dialog, and section components for executive summary, site health, Core Web Vitals, keyword rankings, GSC performance, technical issues, AI search visibility, and recommendations.
- **Settings module** with a tabbed UI for organization settings, project settings, notifications, team members, API keys, and a danger zone, backed by `/api/settings`.
- **PageSpeed widget** on the dashboard, backed by the new `pagespeed_results` table.
- **Billing foundation** with Razorpay order creation, payment verification, HMAC-verified webhook route, billing schema, and structured plan-limit responses.
- **Data layer** with Drizzle schemas and migrations for organizations, users, projects, keywords, audits, backlinks, GEO, reports, and billing.
- **ClickHouse support** for analytics-style data such as rank history, traffic estimates, and keyword metric history.
- **Redis support** for API caching, rate limiting, and BullMQ queues.
- **External service packages** for DataForSEO, Google APIs, and AI providers.
- **Worker package** with queue definitions and worker files for rank, audit, AI, GEO, and reports.
- **Health endpoint** at `/health` that checks PostgreSQL, Redis, and ClickHouse connectivity and expected tables.
- **Sample/mock fallback behavior** for parts of the app when paid credentials or analytics stores are unavailable.

### Scaffolded / Partially Implemented

- **GEO tracker**: schema, API route, and worker logic exist for major AI platforms; UI is currently a shell.
- **Content optimization**: AI package includes content analysis and brief generation capabilities; UI is currently a shell.
- **Reports PDF rendering**: report API, list page, preview page, and section components are in place; final PDF rendering still needs a real renderer.
- **Google Analytics 4**: project flag exists but the GA4 OAuth/sync flow is not yet implemented (GSC is complete).
- **Scheduled rank checks**: rank check jobs can be triggered on-demand, but the production daily scheduling flow (cron / BullMQ repeat) is not wired yet.
- **BullMQ worker process**: queue definitions and per-feature workers exist in `packages/workers`, but no long-running worker entrypoint is instantiated; rank checks currently run inline in the API process.
- **Crawler service**: the API expects an external Python Scrapy/Playwright crawler service; that crawler is not stored in this repository.

## Architecture

### High-Level Flow

1. A user signs in through Clerk and selects an organization/workspace.
2. The Next.js frontend calls the Hono API through authenticated requests.
3. The API validates auth, plan limits, input payloads, and rate limits.
4. Redis is checked for cached data where applicable.
5. Data is fetched or enriched through DataForSEO, Google APIs, AI providers, the crawler service, PostgreSQL, and ClickHouse.
6. Long-running work is delegated to BullMQ workers.
7. Results are stored in PostgreSQL for relational product data and ClickHouse for analytics/time-series data.
8. The frontend renders dashboards, tables, charts, audit results, keyword workflows, and module pages.

### Main Applications

- `apps/web`: Next.js 14 web application.
- `apps/api`: Hono API server.

### Shared Packages

- `packages/db`: Drizzle schema, migrations, PostgreSQL connection, ClickHouse helpers, seed and migration scripts.
- `packages/dataforseo`: DataForSEO API client for keywords, SERP, Labs, OnPage, and backlinks.
- `packages/google-apis`: Google Search Console, Google Analytics, and PageSpeed wrappers.
- `packages/ai`: AI provider clients for Claude, OpenAI, Gemini, and Perplexity-style workflows.
- `packages/workers`: BullMQ queues and background workers.

## Tech Stack

### Frontend

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Radix UI
- TanStack Query
- TanStack Table
- Recharts
- Zustand
- Clerk Next.js SDK
- Lucide icons

### Backend

- Hono
- Node.js 20+
- TypeScript
- Zod
- Drizzle ORM
- Clerk backend auth
- BullMQ
- Redis / ioredis
- Razorpay

### Data Stores

- PostgreSQL for relational product data.
- ClickHouse for analytics and time-series workloads.
- Redis for cache, queues, and rate limiting.

### External Services

- DataForSEO for keyword, ranking, SERP, Labs, OnPage, and backlink data.
- Google PageSpeed Insights for Core Web Vitals and performance checks.
- Google Search Console and Google Analytics clients for traffic/search integrations.
- Anthropic Claude for qualitative SEO and content analysis.
- OpenAI, Gemini, and Perplexity clients for AI visibility workflows.
- Razorpay for billing.
- Clerk for authentication and organizations.

## Repository Structure

```text
.
|-- .claude/
|   `-- settings.local.json
|-- .env
|-- .env.example
|-- .github/
|   `-- PR_DRAFT.md
|-- .gitignore
|-- README.md
|-- complete-features-list.md
|-- india-seo-locations.md
|-- docs/
|   |-- md_to_docx.py
|   |-- VISIBILITY_OS_COMPLETE_REPORT.md
|   `-- VISIBILITY_OS_SUMMARY.md
|-- package-lock.json
|-- package.json
|-- tsconfig.base.json
|-- turbo.json
|-- apps/
|   |-- api/
|   |   |-- package.json
|   |   |-- tsconfig.json
|   |   `-- src/
|   |       |-- index.ts
|   |       |-- types.ts
|   |       |-- lib/
|   |       |   |-- audit-rules.ts
|   |       |   |-- encryption.ts
|   |       |   |-- gsc-sync.ts
|   |       |   |-- clickhouse/
|   |       |   |   `-- index.ts
|   |       |   |-- db/
|   |       |   |   `-- index.ts
|   |       |   `-- redis/
|   |       |       `-- index.ts
|   |       |-- middleware/
|   |       |   |-- auth.ts
|   |       |   |-- cache.ts
|   |       |   |-- planLimits.ts
|   |       |   `-- rateLimit.ts
|   |       `-- routes/
|   |           |-- account.ts
|   |           |-- audit.ts
|   |           |-- backlinks.ts
|   |           |-- billing.ts
|   |           |-- competitors.ts
|   |           |-- dashboard.ts
|   |           |-- geo.ts
|   |           |-- gsc.ts
|   |           |-- keywords.ts
|   |           |-- locations.ts
|   |           |-- projects.ts
|   |           |-- rank.ts
|   |           |-- reports.ts
|   |           `-- settings.ts
|   `-- web/
|       |-- next-env.d.ts
|       |-- next.config.js
|       |-- package.json
|       |-- postcss.config.js
|       |-- tailwind.config.ts
|       |-- tsconfig.json
|       |-- middleware.ts
|       |-- app/
|       |   |-- globals.css
|       |   |-- layout.tsx
|       |   |-- page.tsx
|       |   |-- api/
|       |   |   `-- webhooks/
|       |   |       `-- clerk/
|       |   |           `-- route.ts
|       |   |-- (auth)/
|       |   |   |-- sign-in/
|       |   |   |   `-- [[...sign-in]]/
|       |   |   |       `-- page.tsx
|       |   |   `-- sign-up/
|       |   |       `-- [[...sign-up]]/
|       |   |           `-- page.tsx
|       |   |-- (dashboard)/
|       |   |   `-- layout.tsx
|       |   |-- dashboard/
|       |   |   |-- layout.tsx
|       |   |   |-- page.tsx
|       |   |   |-- account/
|       |   |   |   `-- page.tsx
|       |   |   |-- audit/
|       |   |   |   |-- [auditRunId]/
|       |   |   |   |   `-- page.tsx
|       |   |   |   `-- page.tsx
|       |   |   |-- backlinks/
|       |   |   |   `-- page.tsx
|       |   |   |-- competitors/
|       |   |   |   `-- page.tsx
|       |   |   |-- content/
|       |   |   |   `-- page.tsx
|       |   |   |-- geo-tracker/
|       |   |   |   `-- page.tsx
|       |   |   |-- keywords/
|       |   |   |   |-- layout.tsx
|       |   |   |   |-- page.tsx
|       |   |   |   |-- bulk/
|       |   |   |   |   `-- page.tsx
|       |   |   |   |-- ideas/
|       |   |   |   |   `-- page.tsx
|       |   |   |   |-- lists/
|       |   |   |   |   `-- page.tsx
|       |   |   |   |-- overview/
|       |   |   |   |   `-- page.tsx
|       |   |   |   `-- strategy/
|       |   |   |       `-- page.tsx
|       |   |   |-- rank-tracker/
|       |   |   |   `-- page.tsx
|       |   |   |-- reports/
|       |   |   |   |-- [reportId]/
|       |   |   |   |   `-- page.tsx
|       |   |   |   `-- page.tsx
|       |   |   `-- settings/
|       |   |       `-- page.tsx
|       |   `-- onboarding/
|       |       |-- layout.tsx
|       |       |-- add-project/
|       |       |   `-- page.tsx
|       |       |-- choose-plan/
|       |       |   `-- page.tsx
|       |       `-- create-org/
|       |           `-- page.tsx
|       |-- components/
|       |   |-- LocationFilter.tsx
|       |   |-- account/
|       |   |   |-- billing-tab.tsx
|       |   |   |-- integrations-tab.tsx
|       |   |   |-- org-tab.tsx
|       |   |   |-- profile-tab.tsx
|       |   |   `-- save-button.tsx
|       |   |-- audit/
|       |   |   |-- ai-search-visibility.tsx
|       |   |   |-- audit-checks-grid.tsx
|       |   |   |-- audit-history-card.tsx
|       |   |   |-- compare-tab.tsx
|       |   |   |-- crawled-pages-table.tsx
|       |   |   |-- crawling-indicator.tsx
|       |   |   |-- issues-list.tsx
|       |   |   |-- pages-breakdown-chips.tsx
|       |   |   |-- progress-tab.tsx
|       |   |   |-- score-breakdown.tsx
|       |   |   `-- statistics-tab.tsx
|       |   |-- backlinks/
|       |   |   |-- anchor-text-chart.tsx
|       |   |   |-- backlink-growth-chart.tsx
|       |   |   |-- backlinks-table.tsx
|       |   |   |-- new-lost-backlinks.tsx
|       |   |   |-- overview-cards.tsx
|       |   |   |-- referring-domains-table.tsx
|       |   |   `-- types.ts
|       |   |-- competitors/
|       |   |   |-- backlink-comparison.tsx
|       |   |   |-- common-keywords-table.tsx
|       |   |   |-- competitor-card.tsx
|       |   |   |-- competitor-selector.tsx
|       |   |   |-- discover-competitors-dialog.tsx
|       |   |   |-- keyword-gap-table.tsx
|       |   |   `-- top-pages-table.tsx
|       |   |-- dashboard/
|       |   |   |-- competitor-snapshot.tsx
|       |   |   |-- dashboard-sidebar.tsx
|       |   |   |-- domain-analytics-widget.tsx
|       |   |   |-- gsc-connection-card.tsx
|       |   |   |-- issues-summary.tsx
|       |   |   |-- keyword-changes.tsx
|       |   |   |-- keyword-distribution.tsx
|       |   |   |-- pagespeed-widget.tsx
|       |   |   |-- position-tracking-widget.tsx
|       |   |   |-- project-health-card.tsx
|       |   |   |-- project-selector.tsx
|       |   |   |-- quick-actions-card.tsx
|       |   |   |-- rank-movements-chart.tsx
|       |   |   |-- recent-alerts.tsx
|       |   |   |-- sem-widget.tsx
|       |   |   |-- sidebar-nav.tsx
|       |   |   |-- site-audit-widget.tsx
|       |   |   |-- top-movers-table.tsx
|       |   |   `-- top-pages.tsx
|       |   |-- keywords/
|       |   |   |-- bulk-summary-bar.tsx
|       |   |   |-- competition-badge.tsx
|       |   |   |-- ideas-filter-panel.tsx
|       |   |   |-- ideas-summary-bar.tsx
|       |   |   |-- intent-badge.tsx
|       |   |   |-- kd-badge.tsx
|       |   |   |-- keyword-clusters-panel.tsx
|       |   |   |-- keyword-variations-table.tsx
|       |   |   |-- people-also-ask.tsx
|       |   |   |-- save-to-list-dialog.tsx
|       |   |   |-- serp-features-grid.tsx
|       |   |   |-- serp-top10.tsx
|       |   |   |-- sparkline.tsx
|       |   |   |-- strategy-calendar.tsx
|       |   |   |-- strategy-cluster-card.tsx
|       |   |   |-- strategy-loading.tsx
|       |   |   |-- strategy-pillar-card.tsx
|       |   |   `-- strategy-summary.tsx
|       |   |-- providers/
|       |   |   `-- query-provider.tsx
|       |   |-- reports/
|       |   |   |-- generate-report-dialog.tsx
|       |   |   |-- report-card.tsx
|       |   |   |-- report-preview.tsx
|       |   |   |-- types.ts
|       |   |   `-- report-sections/
|       |   |       |-- ai-search-section.tsx
|       |   |       |-- cwv-section.tsx
|       |   |       |-- executive-summary.tsx
|       |   |       |-- gsc-performance-section.tsx
|       |   |       |-- keyword-rankings-section.tsx
|       |   |       |-- recommendations-section.tsx
|       |   |       |-- site-health-section.tsx
|       |   |       `-- technical-issues-section.tsx
|       |   |-- settings/
|       |   |   |-- api-keys-section.tsx
|       |   |   |-- danger-zone.tsx
|       |   |   |-- notifications-tab.tsx
|       |   |   |-- org-settings-tab.tsx
|       |   |   |-- project-settings-tab.tsx
|       |   |   `-- team-members-section.tsx
|       |   |-- shared/
|       |   |   |-- circular-score.tsx
|       |   |   |-- country-selector.tsx
|       |   |   |-- device-toggle.tsx
|       |   |   |-- empty-state.tsx
|       |   |   |-- info-tooltip.tsx
|       |   |   |-- metric-card.tsx
|       |   |   |-- mini-progress.tsx
|       |   |   `-- sample-data-badge.tsx
|       |   `-- ui/
|       |       |-- avatar.tsx
|       |       |-- badge.tsx
|       |       |-- button.tsx
|       |       |-- card.tsx
|       |       |-- checkbox.tsx
|       |       |-- dialog.tsx
|       |       |-- input.tsx
|       |       |-- label.tsx
|       |       |-- select.tsx
|       |       |-- separator.tsx
|       |       |-- skeleton.tsx
|       |       |-- switch.tsx
|       |       |-- table.tsx
|       |       |-- tabs.tsx
|       |       |-- textarea.tsx
|       |       `-- tooltip.tsx
|       `-- lib/
|           |-- api.ts
|           |-- export-csv.ts
|           |-- keywords.ts
|           |-- session-store.ts
|           `-- utils.ts
`-- packages/
    |-- ai/
    |   |-- package.json
    |   |-- tsconfig.json
    |   `-- src/
    |       |-- claude.ts
    |       |-- gemini.ts
    |       |-- index.ts
    |       |-- openai.ts
    |       |-- perplexity.ts
    |       `-- types.ts
    |-- dataforseo/
    |   |-- package.json
    |   |-- tsconfig.json
    |   `-- src/
    |       |-- backlinks.ts
    |       |-- client.ts
    |       |-- index.ts
    |       |-- keywords.ts
    |       |-- labs.ts
    |       |-- onpage.ts
    |       |-- serp.ts
    |       `-- types.ts
    |-- db/
    |   |-- drizzle.config.ts
    |   |-- package.json
    |   |-- tsconfig.json
    |   |-- drizzle/
    |   |   |-- 0000_brief_thunderball.sql
    |   |   |-- 0001_premium_lockjaw.sql
    |   |   |-- 0002_tough_meggan.sql
    |   |   |-- 0003_shallow_gideon.sql
    |   |   |-- 0004_bouncy_hellfire_club.sql
    |   |   |-- 0005_competitors_table.sql
    |   |   |-- 0006_gsc_tokens.sql
    |   |   |-- 0007_pagespeed_results.sql
    |   |   |-- 0008_reports_columns.sql
    |   |   |-- 0009_org_settings.sql
    |   |   |-- 0010_locations_table.sql
    |   |   `-- meta/
    |   |       |-- 0000_snapshot.json
    |   |       |-- 0001_snapshot.json
    |   |       |-- 0002_snapshot.json
    |   |       |-- 0003_snapshot.json
    |   |       |-- 0004_snapshot.json
    |   |       `-- _journal.json
    |   |-- seeds/
    |   |   |-- generate-india-locations-md.ts
    |   |   `-- seed-locations.js
    |   `-- src/
    |       |-- connection.ts
    |       |-- index.ts
    |       |-- migrate.ts
    |       |-- seed.ts
    |       |-- utils.ts
    |       |-- clickhouse/
    |       |   |-- gsc-metrics.ts
    |       |   |-- index.ts
    |       |   |-- keyword-metrics.ts
    |       |   |-- rank-history.ts
    |       |   `-- traffic.ts
    |       `-- schema/
    |           |-- audit.ts
    |           |-- backlinks.ts
    |           |-- billing.ts
    |           |-- competitors.ts
    |           |-- geo.ts
    |           |-- index.ts
    |           |-- keywords.ts
    |           |-- locations.ts
    |           |-- organizations.ts
    |           |-- projects.ts
    |           |-- reports.ts
    |           `-- users.ts
    |-- google-apis/
    |   |-- package.json
    |   |-- tsconfig.json
    |   `-- src/
    |       |-- analytics.ts
    |       |-- index.ts
    |       |-- pagespeed.ts
    |       |-- search-console.ts
    |       `-- types.ts
    `-- workers/
        |-- package.json
        |-- tsconfig.json
        `-- src/
            |-- ai-worker.ts
            |-- audit-worker.ts
            |-- geo-worker.ts
            |-- index.ts
            |-- queues.ts
            |-- rank-worker.ts
            `-- report-worker.ts
```

> `node_modules/` and `.git/` are intentionally excluded from the tree because they are generated/local repository directories. `.env` is shown because it exists locally, but secrets should never be committed.

## Local Setup

### Prerequisites

- Node.js 20 or newer.
- npm 10 or newer.
- PostgreSQL.
- Redis.
- ClickHouse for analytics features.
- Clerk project keys.
- Razorpay keys for billing flows.
- Optional DataForSEO, Google, Anthropic, OpenAI, Gemini, and Perplexity keys for real external data.

### Install

```bash
npm install
```

### Configure Environment

Copy the example environment file and fill in the required values:

```bash
cp .env.example .env
```

Important environment groups:

- `DATABASE_URL`
- `CLICKHOUSE_URL`
- `CLICKHOUSE_DATABASE`
- `REDIS_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `DATAFORSEO_LOGIN`
- `DATAFORSEO_PASSWORD`
- `GOOGLE_PAGESPEED_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `ENCRYPTION_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_GEMINI_API_KEY`
- `PERPLEXITY_API_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `CRAWLER_URL`
- `CRAWLER_TYPE`

DataForSEO credentials can be left blank for keyword endpoints that support mock-data mode.

### Database

Run migrations:

```bash
npm run db:migrate
```

Seed data if needed:

```bash
npm run db:seed
```

One-time DataForSEO location seed (populates the `locations` table with the India hierarchy used by the keyword location filter). Requires `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` in `.env`. Safe to re-run — uses `ON CONFLICT DO NOTHING`:

```bash
node packages/db/seeds/seed-locations.js
```

### Development

Run the full monorepo:

```bash
npm run dev
```

Or run apps separately:

```bash
cd apps/api
npm run dev
```

```bash
cd apps/web
npm run dev
```

Default local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- API health: `http://localhost:3001/health`

### Build

```bash
npm run build
```

### Type Check

```bash
npm run type-check
```

### Tests

```bash
npm run test
```

Only packages that define a `test` script will run tests through Turborepo.

### Format

```bash
npm run format
```

## API Surface

The API server exposes:

- `GET /health`: service health for PostgreSQL, Redis, and ClickHouse.
- `POST /api/billing/webhook/razorpay`: public Razorpay webhook verified by signature.
- `GET /api/gsc/callback`: public Google OAuth callback for GSC consent redirects.
- `/api/projects`: project and workspace project management.
- `/api/keywords`: keyword overview, ideas, lists, bulk analysis, and strategy workflows.
- `/api/rank`: rank tracking and rank check workflows.
- `/api/audit`: technical SEO audit workflows.
- `/api/backlinks`: backlink data workflows.
- `/api/competitors`: competitor intelligence workflows.
- `/api/geo`: AI visibility tracking workflows.
- `/api/billing`: billing and plan workflows.
- `/api/dashboard`: dashboard summary data.
- `/api/account`: integration status and plan usage for the current organization.
- `/api/gsc`: GSC OAuth start, property listing, manual sync, property selection, and disconnect.
- `/api/reports`: report generation, listing, and per-report retrieval.
- `/api/settings`: organization, project, and notification settings reads/writes used by the Settings module.
- `/api/locations/countries`, `/api/locations/states?country_code=<n>`, `/api/locations/cities?state_code=<n>`: public cascading location lookups used by the keyword research location filter.

All `/api/*` routes use Clerk authentication and API rate limiting, except the Razorpay webhook, the GSC OAuth callback, and the `/api/locations/*` reference endpoints.

## Data Model Areas

The PostgreSQL schema is organized around:

- Organizations and users.
- Projects and project settings.
- Tracked keywords, keyword lists, and keyword list items.
- Audit runs and audit issues.
- Backlink snapshots.
- Competitors and cached competitor metrics.
- GEO prompts and GEO results.
- Reports (with section data persisted per report).
- Billing.
- Locations (DataForSEO-sourced country/state/city reference data used by the keyword research location filter).
- PageSpeed results (`pagespeed_results`) backing the dashboard PageSpeed widget.

ClickHouse is used for:

- Rank history (`rank_history`).
- GSC metrics (`gsc_metrics`) — clicks, impressions, CTR, and average position synced from Search Console.
- Keyword metric history (`keyword_metric_history`).

Traffic estimate storage is planned but not yet a separate ClickHouse table.

## Background Workers

The worker package contains:

- Rank worker.
- Audit worker.
- AI worker.
- GEO worker.
- Report worker.
- Shared BullMQ queue definitions.

Redis is required for BullMQ queues.

## Audit Crawler

The technical audit flow expects an external crawler service configured through `CRAWLER_URL`.

The current `.env.example` notes that the Python Scrapy/Playwright crawler runs outside this repository, commonly in WSL2 during local development. If using WSL2, the WSL NAT IP can change after reboot, so `CRAWLER_URL` may need to be updated.

## Product Modules

### Keyword Intelligence

Implemented with UI and API coverage for keyword overview, suggestions, bulk lookup, intent display, related keywords, SERP features, People Also Ask, CSV export, and keyword list workflows.

### Rank Tracking

Implemented with tracked keyword UI, visibility charts, rank movement views, keyword tables, and API support. Daily production scheduling is still incomplete.

### Technical SEO Audit

Implemented with audit runs, startup reconciliation for stale running audits after API restarts, crawler integration, rule-based audit checks, score breakdowns, issue views, crawled-page tables, and supporting dashboard components. Full 60-rule production scope remains larger than the current TypeScript rule engine.

### Backlink Analysis

Implemented with overview cards, growth chart, anchor-text chart, backlinks table, referring-domains table, and new/lost backlinks panel, backed by `/api/backlinks` endpoints for growth, anchors, and domains.

### Competitor Intelligence

Implemented with competitor selection, automatic discovery, competitor cards, keyword gap table, common keywords table, top pages table, and backlink comparison, backed by DataForSEO Labs workflows.

### GEO / AI Visibility Tracker

Schema, API, and worker foundation exist for AI platform visibility checks. The user-facing module is not complete.

### Content Optimization

AI package support exists for content analysis and brief generation. The user-facing module is not complete.

### Reporting

Implemented with `/api/reports` (generate/list/get), a reports list page, a per-report preview page (`dashboard/reports/[reportId]`), a generate-report dialog, and section components for executive summary, site health, Core Web Vitals, keyword rankings, GSC performance, technical issues, AI search visibility, and recommendations. Final PDF rendering is still pending — the preview surfaces section data in the browser today.

### Settings

Implemented with a tabbed UI under `dashboard/settings` covering organization settings, project settings, notifications, team members, API keys, and a danger zone, backed by `/api/settings`. Reads/writes `projectSettings` (alerts, notification email, notification preferences, competitors, etc.) and the new organization settings columns.

### Billing and Plans

Razorpay integration, plan enforcement, payment verification, and webhook handling are in place. Some subscription lifecycle edge cases still require production hardening.

### Account & Integrations

Implemented with a tabbed account page (profile, organization, integrations, billing). The integrations tab surfaces GSC, GA4, and DataForSEO connection state per project, with manual sync, property selection, and disconnect controls. Backed by `/api/account/integrations`, `/api/account/usage`, and `/api/gsc/*`.

### Google Search Console Integration

Implemented end-to-end: per-project OAuth start, callback handler, encrypted token storage (`apps/api/src/lib/encryption.ts`), property listing, manual and worker-driven sync into ClickHouse (`apps/api/src/lib/gsc-sync.ts`), property re-selection, and disconnect.

## Known Gaps

- Google Ads Keyword Planner integration is described in the product scope but not implemented.
- Google Analytics 4 OAuth/sync is not yet implemented (GSC OAuth is complete).
- Reports module ships data and a browser preview, but a real PDF renderer is still pending.
- GEO tracker and content optimization pages are still shells while backend clients/schemas are already present.
- Full production cron/scheduler behavior for recurring rank checks is not complete; checks run on-demand inline in the API process and the BullMQ worker process is not yet bootstrapped.
- Email alert delivery is not wired up — alert preferences can be stored via the Settings module but no email provider is integrated.
- The crawler service is external to this repository.
- Some dev flows depend on mock/sample data when third-party credentials are missing; surfaces that show synthetic data are labelled with a "Sample Data" badge.
- ClickHouse is optional for parts of local development, but analytics, GSC metrics, and rank-history features need it for real data.

## Documentation

- [complete-features-list.md](./complete-features-list.md): Full product scope and intended feature list.
- [docs/VISIBILITY_OS_SUMMARY.md](./docs/VISIBILITY_OS_SUMMARY.md): Concise current-state summary.
- [docs/VISIBILITY_OS_COMPLETE_REPORT.md](./docs/VISIBILITY_OS_COMPLETE_REPORT.md): Detailed technical/product report.

## Development Notes

- Keep shared, reusable logic in `packages/*`.
- Keep web-only UI code inside `apps/web`.
- Keep API route handlers inside `apps/api/src/routes`.
- Keep database schema changes in `packages/db/src/schema` and generate migrations through Drizzle.
- Use environment variables from `.env.example` as the source of truth for local configuration.
- Do not commit `.env` or secrets.
