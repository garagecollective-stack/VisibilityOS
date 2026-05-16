Overall detail's about visibility-os

SEO Visibility OS: Structured Product and System Flow
Overview
This document organizes the handwritten notes into a structured product, architecture, and workflow reference. It presents the system as an SEO platform built around keyword intelligence, content auditing, technical SEO, GEO tracking, and supporting infrastructure.
Product Scope
The notes describe a platform referred to as Google SEO (Visibility OS) with a strong focus on APIs, data sources, analysis workflows, content intelligence, technical audits, and scalable infrastructure.
The main functional areas mentioned are:
•	Keyword intelligence and keyword overview workflows.
•	Content optimization and page-level recommendations.
•	E-E-A-T auditing for trust and quality signals.
•	GEO tracking for AI answer engine brand visibility.
•	Technical SEO and performance checks using PageSpeed data.
Data Sources and API Layer
The product relies on a mix of external APIs and internal caching to gather SEO, keyword, performance, and judgment-based insights.
Primary paid data source
DataForSEO is described as the primary paid data layer because building a comparable in-house web data system would take years. The notes state that DataForSEO has already crawled the web and sells that data wholesale, at fractions of a cent per call. It is also noted that tools such as SE Ranking, Mangools, and Serpstat use it.
Supporting APIs
API / Service	Purpose	Notes
DataForSEO	Keyword and ranking-related SEO data	Primary paid data layer 
Google Search Console API	Real click and impression data	Used to validate rank tracking estimates; GSC gives actual clicks while DataForSEO gives estimated positions.
Google PageSpeed API	Technical SEO and Core Web Vitals	Free up to 25,000 calls per day; provides LCP, INP, and CLS.
Google Ads API (Keyword Planner)	CPC, competition, and trend data	Free with a developer token; provides exact CPC, competition scores, and 12-month trend data.
Claude API (Anthropic)	Judgment-based analysis	Used for questions that raw metrics cannot answer, such as content usefulness and ranking diagnosis.

Why multiple sources are used
The notes indicate that DataForSEO provides broad SEO and keyword coverage, while Google Search Console provides actual click data directly from Google. Google Ads adds CPC, competition, and trend data, which reduces the amount of paid keyword data needed. Claude is used when a human-like reading or qualitative judgment is needed rather than just numerical analysis.
Core Product Modules
Keyword intelligence
The keyword workflow begins when a user opens the browser, enters a keyword, and triggers a search request to the API endpoint for keyword overview. The backend first checks authentication, then checks Redis for cached data before calling DataForSEO if no cache hit exists. The final response returns JSON containing values such as search volume, CPC, keyword difficulty, trends, and related keywords.
Content optimization
The content optimization feature is described as a workflow in which the platform crawls the user's page and fetches the top 10 competitor pages for a keyword. It collects raw measurements such as word count, headings, and keyword density, but the notes stress that these numbers alone do not tell a user what to fix. Claude is therefore used to read content more like a human and convert raw measurements into practical recommendations.
E-E-A-T audit
The E-E-A-T audit focuses on Experience, Expertise, Authoritativeness, and Trustworthiness. The notes describe this as particularly important for health, finance, and legal content, where quality and trust signals matter more. The crawler can automatically check mechanical trust factors such as author bio presence, About page existence, HTTPS, and privacy policy coverage, while Claude is used for the remaining qualitative assessment.
GEO tracker
The GEO tracker checks whether AI systems such as ChatGPT, Perplexity, and Gemini mention a brand when users ask questions. This positions the product as not only a classic SEO tool, but also as a visibility tracker for generative answer engines.
Technical audit
The technical audit module is powered by the Google PageSpeed API. It uses Core Web Vitals, including LCP, INP, and CLS, to support performance-related checks that are treated in the notes as ranking-relevant signals.
Intent Classification
The notes describe intent classification as an area with edge cases because keyword intent directly determines content strategy. One example given is publishing a blog post when the keyword should instead map to a comparison or landing page, which is treated as a meaningful mistake.
The system appears to use a hybrid approach:
•	A rule-based logic layer handles the bulk of intent classification work at low cost.
•	Claude is only called when rules are not enough.
•	Sonnet is used for more complex analysis, while Haiku is used for simpler tasks like bulk classification.
A simple keyword-intent mapping is also shown in the notes:
Keyword pattern	Intent
contains "buy"	Transactional.
contains "how to"	Informational.
contains "best"	Commercial.

Frontend Architecture
The frontend stack is centered on Next.js 14 using the App Router. The notes say this is chosen for server-side rendering, which helps pages load faster even before JavaScript fully runs.
Frontend libraries and roles
Tool	Role
Next.js 14	Frontend framework with server-side rendering.
Shadcn UI + Radix	UI components such as buttons, dropdowns, modals, and tooltips; Radix also handles keyboard navigation and accessibility.
Tailwind CSS	Utility-first styling directly in HTML markup.
React Query	Server-state handling such as fetching, caching, and refreshing.
Zustand	Local UI state such as sidebar state and selected filters.
TanStack Table	Efficient table rendering for hundreds or thousands of rows by rendering only visible rows.
Recharts	Standard charts such as rank history lines, keyword trends, and sparklines.
D3.js	Complex custom visuals such as an internal link map.

The notes explicitly separate charting responsibilities by saying Recharts is used for standard charts and D3.js only for more complex custom visuals.
Backend Architecture
The backend stack combines a lightweight API framework, queue processing, type-safe data access, validation, authentication, and payments.
Backend components
Tool	Role
Hono	API framework, described as similar to Express but faster; written in TypeScript and able to run on Node.js, Bun, or Cloudflare Workers.
BullMQ	Job queue system backed by Redis for scheduled and background work.
Drizzle ORM	Type-safe database querying in TypeScript instead of raw SQL strings.
Zod	Runtime schema validation and end-to-end type safety.
Clerk	Authentication and multi-tenancy, including sign-up and Google OAuth login.
Razorpay	Payment gateway.

BullMQ is used for operational workloads such as crawling a 200-page site, running daily rank checks for hundreds of keywords, and sending email alerts. The notes also mention retry behavior on failure and scheduled runs, including a 3 AM daily rank-check process.
Data Layer
The data layer is split by workload rather than forcing every data type into one database.
Storage systems
System	Role
PostgreSQL 16	Main relational database for users, organizations, projects, keyword lists, audit issues, and billing records.
ClickHouse	Column-oriented analytics database for time-series data such as rank history, traffic estimates, and keyword metric history.
Redis	Cache and queue backend for API responses and BullMQ queues.
Cloudflare R2	Object storage for generated PDFs, exported CSVs, and database backups, chosen partly because it has no egress fees.

The notes justify ClickHouse as the analytics engine for large-scale time-series queries over billions of rows, such as showing a keyword's daily rank across the past 12 months. Redis serves both as a cache and as infrastructure for queue processing.
Infrastructure and Operations
The infrastructure section describes a three-server deployment on Hetzner VPS instances.
Server layout
•	VPS 1 runs the application layer, including Next.js and Hono.
•	VPS 2 runs background workers such as rank checks, crawlers, and AI calls.
•	VPS 3 runs the data layer, including PostgreSQL, ClickHouse, and Redis.
Platform services
Cloudflare sits in front of the application layer and provides DDoS protection, WAF, SSL certificates, and edge caching. GitHub Actions is used for CI/CD so that code merged to main automatically runs tests and deploys to servers. Prometheus collects metrics from all three servers, and Grafana visualizes them in monitoring dashboards.
End-to-End Request Flow
This section combines the fragmented notes into one complete application flow.
User request flow
1.	A user opens the application and searches for a keyword.
2.	The frontend, built in Next.js, sends the request to the API endpoint for keyword overview.
3.	Hono receives the request and checks whether the user is authenticated through a Clerk-backed token flow.
4.	If authentication fails, the API returns an error; if it succeeds, processing continues.
5.	Redis is queried first to see whether keyword data already exists in cache.
6.	If cache data exists, the response is returned immediately.
7.	If cache data does not exist, the backend calls DataForSEO.
8.	DataForSEO returns structured keyword data such as volume, CPC, KD, trends, and related keywords.
9.	The platform may then apply intent classification rules to the keyword.
10.	The frontend renders charts, tables, and summaries using the React-based UI stack.

Extended analysis flow
For deeper features, this core keyword flow branches into more advanced modules:
•	Content optimization compares the user's page with top competitor pages and uses Claude for practical recommendations.
•	Technical audit uses PageSpeed data to score performance and Core Web Vitals.
•	E-E-A-T audit combines crawler checks with Claude-based qualitative evaluation.
•	GEO tracker checks whether AI assistants mention the brand in answer-generation contexts.
Testing and Delivery
The testing stack combines Vitest and Playwright. Vitest is used for fast unit testing of individual functions and components, while Playwright is used for end-to-end tests that simulate real user flows in a browser.
The notes also sketch a phased delivery plan:
•	Sprint 1: Infrastructure and foundation.
•	Sprint 2: Authentication, billing, and onboarding.
•	Sprint 3: Keyword intelligence.
Structured System Summary
The complete flow described in the notes can be summarized as a layered SEO intelligence system:
•	Acquisition layer: DataForSEO, Google Search Console, Google Ads, PageSpeed, and Claude.
•	Processing layer: Hono APIs, Redis caching, BullMQ queues, rule-based logic, and Claude-based reasoning.
•	Storage layer: PostgreSQL, ClickHouse, Redis, and Cloudflare R2.
•	Presentation layer: Next.js, Tailwind, Shadcn UI, Radix, Recharts, D3.js, React Query, Zustand, and TanStack Table.
•	Operations layer: Hetzner VPS infrastructure, Cloudflare, GitHub Actions, Prometheus, and Grafana.
Suggested Final Narrative
If converted into a formal product or technical document, the notes support the following narrative:
This platform is an SEO and visibility operating system that collects keyword, ranking, click, trend, and page performance data from multiple APIs; enriches that data with caching, classification, and AI-based analysis; stores operational and analytical workloads in different systems; and delivers recommendations through a modern web application.
Its complete flow starts with a user entering a keyword, moves through authentication, cache checks, and API enrichment, then extends into ranking intelligence, content optimization, E-E-A-T analysis, GEO visibility monitoring, and reporting workflows. The architecture is designed to be scalable, cost-conscious, and modular, with clear separation between frontend, backend, data, and infrastructure concerns.


Visibility OS — Product Scope Document v1.0
Feature’s List:
•	Keyword Intelligence
•	Rank Tracking
•	Technical SEO Audit
•	Backlink Analysis
•	Competitor Intelligence
•	GEO / AI Visibility Tracker
•	Content Optimization
•	E-E-A-T Audit
•	Unified SEO Health Score
•	Google Integrations
•	Reporting
•	Multi-Workspace and Team

Module 1 — Keyword Intelligence
Keyword Overview
•	Search volume (monthly, exact)
•	CPC (cost per click from Google Ads API)
•	Competition score (0–1 scale)
•	Keyword Difficulty (0–100)
•	Search Intent classification (Informational / Commercial / Transactional / Navigational)
•	12-month trend sparkline
•	SERP features present for that keyword (Featured Snippet, PAA, Video Pack, Image Pack, Local Pack, AI Overview)
•	Related keywords preview (top 5 inline)
Keyword Suggestions
•	Up to 700 keyword ideas per seed keyword
•	Sources: autocomplete, questions, prepositions, comparisons
•	Grouped by intent type
•	Bulk select and save to list
Bulk Keyword Lookup
•	Upload CSV or paste up to 200 keywords at once
•	Returns volume, CPC, KD, and intent for all 200
•	Batch export to CSV
Intent Classification Engine
•	Rule-based classification for 80%+ of keywords (zero API cost)
•	Claude Haiku fallback for edge cases
•	Intent label shown on every keyword across all modules
Keyword Lists
•	Create, name, and tag lists (e.g. "Blog Topics Q3", "Client X — Transactional")
•	Add/remove keywords from any view
•	Tag by campaign, intent, or priority
•	Export list to CSV
•	Share list across team members within workspace
Google Keyword Planner Integration
•	Free CPC, competition, and 12-month trend data from Google Ads API
•	Exact volume from DataForSEO (fallback when Google Ads basic access gives ranges)
•	Dual-source strategy reduces per-keyword cost by 60%
________________________________________
Module 2 — Rank Tracking
Daily Rank Tracking
•	Position checked daily at 3 AM for all tracked keywords
•	Desktop and mobile tracking per keyword
•	Top 100 SERP positions checked per keyword
•	Supports up to 3,000 keywords per Agency account
Rank History Charts
•	30-day and 90-day position history line chart per keyword
•	Position delta shown vs. previous day (up/down/same)
•	URL that ranked shown per data point
Local Rank Tracking
•	City, state, or country-level targeting
•	Supports 100,000+ location codes via DataForSEO
•	Each location tracked as a separate keyword instance
Competitor Rank Comparison
•	Add competitor domains to a project
•	Competitor positions extracted from the same SERP response (zero extra cost)
•	Side-by-side chart: your rank vs. competitor rank over 30/90 days
Visibility Score
•	Project-level metric: sum of (CTR at position x search volume) across all tracked keywords
•	CTR curve applied: Position 1 = 31.7%, Position 2 = 24.7%, Position 3 = 18.6%, diminishing after
•	Displayed as a daily trend chart
Rank Drop Alerts
•	Email notification triggered when any keyword drops 5 or more positions
•	Alert includes: keyword, previous rank, new rank, direct link to project
•	Smart alerting — only significant drops, not daily noise
SERP Feature Detection
•	Flags when Featured Snippet, PAA, Video Pack, Image Pack, Local Pack, or AI Overview appears for a tracked keyword
•	Updated daily with each rank check
Featured Snippet Opportunity Flag
•	Detects when a Featured Snippet exists for a keyword and you rank in top 5 but do not own the snippet
•	Claude Haiku generates a one-line recommendation on content format to win the snippet (list, table, definition, or numbered steps)
•	Shown as an opportunity flag inline in the keyword rank table
SERP Volatility Tracker
•	Computes average rank delta across all tracked projects platform-wide on a given day
•	If platform-wide delta spikes above threshold, flags it as a High Volatility Day
•	Indicates probable Google algorithm update
•	Shown as a volatility graph alongside rank history on the dashboard
•	Zero additional API cost — pure ClickHouse aggregation on existing rank data
________________________________________
Module 3 — Technical SEO Audit
Site Crawler
•	Scrapy + Playwright crawler self-hosted on Worker VPS
•	Standard HTML crawl (free, unlimited pages on our infrastructure)
•	JavaScript rendering via Playwright for React, Next.js, Vue sites (on-demand)
•	Up to 500 pages per crawl run on standard plan
60-Rule Audit across 9 Categories
Meta Tags:
•	Missing or duplicate title tags
•	Title too long (over 60 characters) or too short (under 30 characters)
•	Missing or duplicate meta descriptions
•	Meta description too long or too short
•	Missing H1 or multiple H1s on a page
Links:
•	Broken internal links (404)
•	Broken external links (404)
•	Redirect chains (301 to 301 to 301)
•	Nofollow misuse on important internal links
•	Orphan pages (pages with zero internal links pointing to them)
Speed:
•	Large uncompressed images
•	Render-blocking JavaScript
•	Slow TTFB (Time to First Byte)
•	Missing browser caching headers
•	Unminified CSS or JS files
Content:
•	Thin pages (under 300 words)
•	Duplicate content across pages
•	Missing image alt text
•	Pages with no outbound links
Schema:
•	Missing JSON-LD schema markup
•	Invalid or malformed schema
Mobile:
•	Missing viewport meta tag
•	Tap targets too small for touch
Security:
•	Mixed content (HTTP resources on HTTPS pages)
•	Missing HTTPS redirect from HTTP
•	Missing security headers
Indexing:
•	Noindex on important pages
•	Canonical tag conflicts
•	Robots.txt blocking important pages
•	Hreflang errors (if multilingual)
Core Web Vitals (via Google PageSpeed API — free):
•	LCP (Largest Contentful Paint) — pass if under 2.5s
•	INP (Interaction to Next Paint) — pass if under 200ms
•	CLS (Cumulative Layout Shift) — pass if under 0.1
•	Overall performance score
Site Health Score (0–100)
•	Critical issues: minus 5 points each (max minus 40)
•	Warnings: minus 2 points each (max minus 30)
•	Notices: minus 0.5 points each (max minus 15)
•	CWV failures: minus 5 per failing metric
•	Score bands: 90–100 Excellent, 70–89 Good, 50–69 Needs Work, 0–49 Critical
Issue Priority List
•	Filterable by severity (Critical, Warning, Notice)
•	Filterable by category (Meta, Links, Speed, Content, Schema, Mobile, Security, Indexing, CWV)
•	Sortable by affected URL
•	Each issue shows: what it is, why it matters, how to fix it
Internal Link Map
•	Directed graph built during crawl
•	Visualized as D3.js force-directed graph
•	Metrics: link depth from homepage, internal PageRank distribution, orphan pages, over-linked pages
•	Identifies link equity flow across the site
Crawl Budget Analysis
•	Flags pages wasting crawl budget: parameter URLs, paginated archives, redirect chains, low-value tag/category pages
•	Derived from crawl data — zero additional API cost
Keyword Cannibalization Detector
•	Identifies keywords where 2 or more pages from the same domain appear in rank history
•	Displays competing URLs per keyword with their respective positions
•	Severity score based on how close the positions are (both in top 10 = critical)
•	Zero additional API cost — SQL query on existing rank tracking data
Competitor Core Web Vitals Benchmarking
•	Runs PageSpeed API on competitor domains added in the Competitor Intelligence module
•	Side-by-side comparison: your LCP, INP, CLS vs. each competitor
•	Highlights where you are slower than competitors with fix recommendations
•	Free — uses the same Google PageSpeed API already integrated
Deep JS Audit (Agency Plan only)
•	DataForSEO OnPage API with full browser rendering enabled
•	For sites where Scrapy cannot render JavaScript
•	Cost: $0.00425 per page, gated behind Agency plan
________________________________________
Module 4 — Backlink Analysis
Backlink Overview
•	Total backlinks count
•	Total referring domains count
•	Domain Rank (authority score)
•	New links gained (last 30 days)
•	Lost links (last 30 days)
•	New vs. lost links trend chart
Referring Domains Table
•	Domain authority per referring domain
•	Link type (dofollow / nofollow)
•	Anchor text used
•	First seen date and last seen date
•	Number of links from that domain
Anchor Text Distribution
•	Breakdown chart: branded vs. keyword vs. URL vs. generic vs. other
•	Percentage split per anchor type
•	Over-optimized anchor text warning (too many exact-match keywords)
Toxic Link Detection
•	Rule-based scoring: domain rank under 5, outbound links over 500, exact-match anchor on irrelevant domain, domain age under 30 days, spammy TLDs (.xyz, .top, .loan, .work)
•	Risk score per referring domain (matched indicators / total indicators x 100)
•	Claude Haiku review for borderline cases
•	Toxic links list with individual risk scores
Disavow File Generator
•	Filter toxic links by risk score threshold
•	Generate correctly formatted disavow.txt for Google Search Console
•	Download via one-click export
Lost Links Tab
•	Dedicated view for links that existed previously but are no longer active
•	Sorted by domain authority of the lost link (highest priority to reclaim first)
•	Lost date shown per link
•	Zero extra API cost — DataForSEO already returns lost_date in backlink responses
Backlink Gap Analysis
•	User adds up to 3 competitor domains
•	Finds referring domains linking to competitors but not to the user's domain
•	Ranked by: domain authority of the referring site, number of competitors it links to, niche relevance
•	Exported as a prioritized outreach opportunity list
________________________________________
Module 5 — Competitor Intelligence
Domain Traffic Overview
•	Estimated organic traffic per month
•	Organic keyword count
•	Paid traffic estimate
•	Traffic cost (what their traffic would cost in Google Ads)
•	Top organic keywords list
Top Pages Discovery
•	Which pages drive the most organic traffic for any competitor domain
•	Traffic share per page
•	Top keyword per page
•	Useful for reverse-engineering competitor content strategy
Keyword Gap Analysis
•	User enters their domain and up to 4 competitors
•	Three-way categorization:
o	Opportunities: keywords only competitors rank for (you should target)
o	Improve: keywords both you and competitors rank for (you rank lower)
o	Protect: keywords only you rank for (defend your position)
•	Each gap keyword shows volume, KD, and competitor's current position
Similar Sites Discovery
•	Auto-discovers competitor domains the user may not know about
•	Ranked by keyword overlap percentage
•	Useful for building a complete competitive landscape
Automated Competitor Monitoring
•	Weekly check for new keywords each competitor started ranking for
•	Alert sent if a competitor gains 15 or more new keywords in a week
•	Derived from weekly SERP data — minimal additional cost
Competitor Core Web Vitals Comparison
•	Pulls into Technical Audit module
•	Side-by-side LCP, INP, CLS for your domain vs. each competitor domain
•	Powered by free Google PageSpeed API calls
________________________________________
Module 6 — GEO / AI Visibility Tracker
Brand Citation Tracking
•	Checks whether your brand or domain is mentioned when a user-defined prompt is sent to 4 AI platforms:
o	ChatGPT (OpenAI API, gpt-4o-mini)
o	Perplexity (Perplexity API, citations array parsed)
o	Gemini (Google Gemini Flash, grounding sources parsed)
o	Google AI Overview (DataForSEO SERP API with ai_overview flag)
•	Up to 20 prompts per project per week (Agency plan)
•	Up to 10 prompts per project per week (Pro plan)
Citation Rate Dashboard
•	Percentage of tracked prompts where your brand was cited, per platform
•	Grouped bar chart: your citation rate vs. estimated competitor citation rate
•	Weekly trend line per platform
Mention Viewer
•	Full AI response text displayed per prompt per platform
•	Your brand mentions highlighted inline
•	Position in response noted (cited early vs. mentioned at end)
Weekly Trend Chart
•	Citation rate over time per prompt and per platform
•	Detects improving or declining AI visibility over weeks
Hard Cost Caps
•	Monthly GEO budget enforced at job queue level per plan
•	Job rejected automatically if monthly cap is reached
•	No budget overrun possible by design
AEO Recommendations (Answer Engine Optimization)
•	After each GEO check run, Claude Sonnet analyzes prompts where citation rate is low
•	Compares your content vs. the competitor content that was cited
•	Outputs specific recommendations: what content to create, what format AI systems prefer to cite (definitions, statistics, list format, FAQ format, direct answers)
•	Tells the user exactly what to add or change on their site to get cited in that AI answer
•	Cost: approximately $0.02 per analysis, run monthly per project
________________________________________
Module 7 — Content Optimization
On-Page SEO Grader
•	Input: URL and target keyword
•	Crawls the user's page and top 10 ranking competitor pages for that keyword
•	Scores the page 0–100 across:
o	Keyword in title, H1, URL, and first 100 words
o	Content depth vs. competitor average word count
o	Semantic keyword coverage (TF-IDF comparison)
o	Readability level
o	Internal link quality
o	Image optimization
•	Claude Sonnet generates specific fix recommendations with priority order
Content Brief Generator
•	Input: target keyword
•	Process: SERP fetch (top 10 URLs) + top 5 page crawl + TF-IDF semantic extraction + PAA questions
•	Output:
o	Recommended word count based on competitor average
o	Suggested heading structure (H1, H2s, H3s)
o	Semantic keywords to include
o	FAQ section from People Also Ask
o	Content angle recommendation (what to cover that competitors missed)
•	Downloadable as markdown
Content Decay Tracker
•	Monitors all pages in the project over a rolling 60-day window
•	Flags pages where: rank dropped 5 or more positions AND GSC impressions dropped 20% or more
•	Priority score: (search volume x position drop magnitude)
•	Weekly digest email listing top 5 decaying pages
•	Zero additional API cost — derived from existing rank history and GSC data in ClickHouse
Schema Generator
•	User selects page type: Article, FAQ, Product, LocalBusiness, HowTo, BreadcrumbList, Event
•	Auto-fills schema fields from crawled page content
•	Generates valid JSON-LD markup
•	One-click copy to clipboard
Rich Results Validation
•	After schema is generated, calls Google Rich Results Test API (free)
•	Returns: valid or invalid, which rich result type it qualifies for, specific errors with line numbers if invalid
•	Shows a preview label: "This schema will trigger FAQ dropdowns in Google Search"
•	Prevents users from deploying broken schema to their site
Featured Snippet Optimization
•	Pulls from Rank Tracking module
•	Shows all keywords in the project where a Featured Snippet exists but the user does not own it
•	For each opportunity: recommended content format (numbered list, definition, table, short paragraph)
•	Generated by Claude Haiku per keyword
Topical Authority / Cluster Map
•	User inputs a main topic (e.g. "CRM software" or "solar panels India")
•	System queries existing tracked keywords and keyword suggestions for that topic
•	Groups keywords into: Pillar topic, Supporting subtopics, Content gap (keywords with no page currently ranking)
•	Visual card grid showing coverage: green (you have a ranking page), yellow (you rank but weakly), red (no content targeting this)
•	Claude groups and labels the clusters
•	Helps users see their content strategy gaps at a glance
________________________________________
Module 8 — E-E-A-T Audit
Automated Trust Signal Checklist
•	Author bio present on all blog posts
•	About page exists and has substantive content
•	Contact information visible (address, phone, email)
•	HTTPS active sitewide
•	Privacy Policy page present
•	Terms of Service page present
•	Schema Author markup on content pages
•	External citations to authoritative domains present in content
•	Review or testimonial signals visible
•	Each signal: pass, fail, or warning
Claude AI Qualitative Assessment
•	Claude Sonnet evaluates Experience, Expertise, Authoritativeness, and Trustworthiness signals across homepage and 3 key pages
•	Qualitative output: what signals are strong, what is missing, specific recommendations
•	Cost: approximately $0.02 per audit
Combined E-E-A-T Score
•	60% rule-based automated checklist
•	40% Claude qualitative assessment
•	Score shown as a 0–100 number with a pass/fail band
YMYL Flagging
•	Automatically detects if the site covers health, finance, legal, or safety topics
•	Applies stricter E-E-A-T weighting for YMYL content
•	Additional recommendations specific to YMYL compliance shown when triggered
________________________________________
Module 9 — Unified SEO Health Score
Composite Score (0–100)
•	Technical Score: 25% (from site audit health score)
•	Authority Score: 25% (from domain rank and referring domain count in backlink data)
•	Content Score: 20% (average on-page grade across audited pages)
•	Visibility Score: 20% (rank tracking visibility score)
•	AI Visibility Score: 10% (GEO citation rate average across all platforms)
•	Updates automatically after any module run completes
Score Display
•	Hero metric on the main dashboard
•	Colour bands: 90–100 Excellent (green), 70–89 Good (yellow), 50–69 Needs Work (orange), 0–49 Critical (red)
•	Each component score shown as a sub-metric with its weighting
Drill-Down Navigation
•	Clicking any component score navigates directly to that module
•	Highlights what is dragging the score down
Competitor Benchmark
•	Shows your health score vs. competitor domain average health score (computed from competitor data already pulled)
•	Example display: "Your score: 72 | Competitor average: 81"
Weekly Trend Chart
•	Health score plotted week over week
•	Shows whether the site is improving or declining overall
________________________________________
Module 10 — Google Integrations
Google Search Console
•	OAuth 2.0 connect flow — user grants access per property
•	Daily sync: clicks, impressions, CTR, average position per URL
•	Top pages view sorted by clicks
•	Query-level data: which search queries drive traffic to which URLs
•	GSC data overlay on rank tracker chart (real clicks alongside estimated position)
•	Index coverage: which pages are indexed, which have errors, which are excluded
Google Analytics 4
•	OAuth 2.0 connect flow
•	Organic traffic sessions per landing page
•	Conversions attributed to organic traffic
•	Bounce rate and time on page per landing page
•	Connects ranking data to business outcomes (rank + traffic + conversion in one view)
________________________________________
Module 11 — Reporting
PDF Report Generation
•	Server-side generation via Puppeteer (zero external API cost)
•	Report sections:
o	Unified Health Score overview and weekly trend
o	Rank tracking summary: top 10 positions, top movers up and down, visibility score
o	Technical audit: health score, top 5 critical issues, issue count by category
o	GSC traffic overview: top 5 pages by clicks, impression and click trend
o	Backlink overview: referring domains count, domain rank, new and lost links
o	GEO visibility: citation rates per platform (if GEO enabled on plan)
o	Content summary: decaying pages count, top content opportunities
White-Label
•	Agency logo upload (stored in Cloudflare R2)
•	All Visibility OS branding removed from client-facing reports
•	Agency name shown in report header and footer
Report Scheduling
•	Manual trigger at any time
•	Auto-generate and email weekly or monthly
•	Scheduling managed via BullMQ job queue
Report History
•	All previously generated PDFs stored and downloadable from the Reports section
•	Stored in Cloudflare R2
Custom Report Builder
•	User selects which modules to include in each report
•	Useful for single-focus reports (e.g. rank-only report for a client call)
________________________________________
Module 12 — Multi-Workspace and Team
Workspace per Client
•	Each client gets a separate workspace under one agency account
•	Separate projects, keyword lists, audit history, rank data, and reports per workspace
•	Agency plan: up to 30 workspaces
•	Pro plan: up to 5 workspaces
Team Invitations
•	Invite team members via email
•	Clerk-managed invite flow
•	Role assigned at invite time
Role-Based Access
•	Admin: full access to all tools, billing, and workspace settings
•	Editor: can run all tools, add keywords, trigger audits — cannot access billing
•	Viewer: read-only access — for client-facing portals, cannot trigger any tool or API-cost action
Client Dashboard — Viewer Portal
•	Simplified view for clients: Health Score, rank changes, traffic trend
•	Branded with agency logo, no Visibility OS branding visible
•	Shareable via token-based link (no client login required)
Workspace Selector
•	Dropdown in the navigation to switch between all client workspaces instantly
•	Shows project count and last active date per workspace
Data Isolation
•	Row-level security in PostgreSQL: every query filtered by org ID
•	No API endpoint can return data across workspace boundaries
•	Confirmed via security gate before launch

