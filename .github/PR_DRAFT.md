# PR draft — paste this into github.com when opening the PR

**Title:**

```
Frontend overhaul, audit backend extensions, and platform docs
```

**Base:** `main` · **Compare:** `ammar`

**Open-PR URL:** https://github.com/garagecollective-stack/VisibilityOS/pull/new/ammar

---

## Summary

- **Frontend overhaul** across all 9 dashboard pages (Dashboard, Keyword Overview / Ideas / Bulk / Strategy / Lists, Site Audit list + detail, Rank Tracker built from scratch) with TanStack Table v8 for every data grid, shared `MetricCard` / `CountrySelector` / `DeviceToggle` / `SampleDataBadge` primitives, and consistent green / yellow / red / blue / purple color tokens.
- **Audit backend extensions** — three Drizzle migrations adding `affected_urls` + `crawled_pages` + `failure_reason`, removed the WSL2 IP fallback in favour of a clear 503 when `CRAWLER_URL` is unset, and a one-time startup reconciliation for stuck `running` audits.
- **New endpoints** — `POST /api/keywords/serp` (organic + PAA + features, sha256-keyed 6h cache), Claude Sonnet-powered `POST /api/keywords/strategy`, list enrichment + move endpoints, dedup-aware tracked-keywords endpoint.
- **Two doc files** — `docs/VISIBILITY_OS_COMPLETE_REPORT.md` (16 sections, ~8k words, full schema / API / cost model / build status) and `docs/VISIBILITY_OS_SUMMARY.md` (two-page condensed).

72 files changed (+15,664 / −924).

## Highlights

| Area | What landed |
|---|---|
| Dashboard | Project selector, 4 stat cards, rank chart, top movers, alerts, project health with sub-score bars, quick actions, GSC card, issues summary, competitor snapshot |
| Keyword Overview | 7 country / device selectors, 5 metric cards including Competition, 12-month chart with average ReferenceLine, SERP features grid (10 chips), variations table, PAA accordion, Top 10 organic |
| Keyword Ideas | Collapsible filter panel, summary bar, 4 tabs, paginated TanStack table, sticky bulk bar, CSV export |
| Keyword Bulk | Up to 200 kw, animated progress bar, 7 stat chips, opportunity row highlighting (Volume>1k AND KD<40), filter bar |
| Keyword Strategy | AI thinking animation, Claude `claude-sonnet-4-6` JSON-structured output (Pillar + Clusters + 8-week Content Calendar), Save All / Export / Regenerate sticky bar |
| Keyword Lists | List search, Avg KD + Avg Volume cards, enrichment + move + Track All, sortable items table with new Volume/KD/CPC/Intent columns |
| Site Audit list | 6-category pre-audit grid, animated pulse-ring crawling indicator with live elapsed timer, history cards with critical badge / pages / duration / failure_reason |
| Site Audit detail | Re-run + Export PDF buttons, metadata strip, 4-card score breakdown (Technical/Content/Speed/Security), severity tabs, expandable issue rows showing ALL `affected_urls`, full TanStack Crawled Pages table |
| Rank Tracker | Setup form with Desktop/Mobile/Both, 5 metric cards, visibility trend chart (7/30/60/90d), keywords table with position pills + change indicators + SERP feature icons, slide-out detail drawer with reversed-Y position history |

## Backend changes

- New `POST /api/keywords/serp` — single endpoint returns `organic[]` (top 10), `paa[]` (People Also Ask), `serp_features[]`. Redis cache keyed on `serp:{sha256(keyword|locationCode|device)}` with 6-hour TTL. Mock fallback when DataForSEO creds are absent.
- `POST /api/keywords/strategy` rewritten — calls `ClaudeClient.generateKeywordStrategy()` (new method on `packages/ai/claude.ts`), returns `{ pillar, clusters[], content_calendar[], summary }` matching the agreed schema. Mock fallback when `ANTHROPIC_API_KEY` or DataForSEO creds are missing.
- `POST /api/keywords/projects/:projectId/lists/:listId/enrich` — fetches volume + KD + CPC from DataForSEO, persists to `keyword_list_items`, sets `keyword_lists.last_enriched_at`.
- `POST /api/keywords/projects/:projectId/lists/:listId/move` — moves items between lists in the same project, dedupes against the target.
- `POST /api/keywords/projects/:projectId/tracked` — now deduplicates on `(projectId, keyword, locationCode, languageCode, device)` and returns `{ added, duplicates, keywords }`.
- `POST /api/audit/start` — refuses to start with a 503 if `CRAWLER_URL` is unset; persists `crawled_pages` summary on completion; stores all affected URLs per issue.
- `reconcileStuckAudits()` runs once on API boot: flips `audit_runs` older than 15 min in `running` state to `failed` with `failure_reason: "Interrupted — server restarted"`.

## Schema migrations

| Migration | Adds |
|---|---|
| `0001_premium_lockjaw` | `audit_issues.affected_urls text[]`, `audit_runs.crawled_pages jsonb` |
| `0002_tough_meggan` | `audit_runs.failure_reason text` |
| `0003_shallow_gideon` | `keyword_list_items.volume / kd / cpc / intent`, `keyword_lists.last_enriched_at` |

All three migrations applied via `npm run db:migrate` against the local Postgres during development.

## Bug fixes

- Dashboard + Rank Tracker had a `useEffect` that restored project selection from localStorage with `[projects, selectedProjectId]` in its deps, fighting the save-to-localStorage effect on project switches. Replaced with a `useRef`-guarded one-time initialization.
- Keyword Lists' `trackProjectId` was synced via `useEffect([selectedList])`, so any mutation that refetched the lists query reverted the user's manual project choice in the Track dialog. Removed the effect; default is set when the dialog opens.
- Fixed pre-existing TS error `apps/api/src/routes/projects.ts:80` (`project.id` → `project!.id`).

## Type-check

- `apps/api` ✅
- `apps/web` ✅
- `packages/db` ✅
- `packages/ai` ✅ built clean

## Test plan

- [ ] Sign in, switch between two projects on `/dashboard` — should be smooth (no re-render loop)
- [ ] Same on `/dashboard/rank-tracker`
- [ ] `/dashboard/keywords/lists` — open Track dialog, change project, perform another mutation; user's project choice should persist
- [ ] `/dashboard/keywords/overview` for `seo tools india` — confirm 5 metric cards, SERP features grid, variations table, PAA, Top 10 all render
- [ ] `/dashboard/keywords/strategy` for `crm software for small business` — confirm Claude generates structured output and the calendar renders
- [ ] `/dashboard/audit` for a real domain — confirm pre-audit grid, running indicator with elapsed timer, completed history card with duration + critical badge
- [ ] `/dashboard/audit/[auditRunId]` — confirm 4-card breakdown, severity tabs, issue rows expand with all affected URLs, Crawled Pages table is sortable + filterable

🤖 Generated with [Claude Code](https://claude.com/claude-code)
