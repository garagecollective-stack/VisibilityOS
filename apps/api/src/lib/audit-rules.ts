// Scrapy crawler page shape — adapt field names if your crawler differs
export interface CrawledPage {
  url: string;
  status_code: number;
  title?: string | null;
  meta_description?: string | null;
  h1?: string[];
  word_count?: number;
  internal_links?: string[];
  external_links?: string[];
  images_without_alt?: number;
  has_json_ld?: boolean;
  has_viewport?: boolean;
  canonical?: string | null;
  meta_robots?: string;
  ttfb_ms?: number;
  is_https?: boolean;
  redirect_chain?: string[];
}

export interface CrawlResult {
  domain: string;
  pages: CrawledPage[];
}

export interface PageSpeedResult {
  lcp_ms: number;
  cls: number;
  performance_score: number; // 0–100
}

export interface AuditIssue {
  severity: "critical" | "warning" | "notice";
  category:
    | "meta"
    | "links"
    | "speed"
    | "content"
    | "schema"
    | "mobile"
    | "security"
    | "indexing"
    | "cwv";
  url: string | null;
  affectedUrls: string[];
  title: string;
  description: string;
  recommendation: string;
  affectedCount: number;
}

export interface AuditReport {
  issues: AuditIssue[];
  healthScore: number;
  cwvScore: number;
  criticalCount: number;
  warningCount: number;
  noticeCount: number;
  pagesCrawled: number;
}

function mk(
  severity: AuditIssue["severity"],
  category: AuditIssue["category"],
  title: string,
  description: string,
  recommendation: string,
  affectedUrls: string[] = [],
  affectedCount?: number
): AuditIssue {
  const urls = affectedUrls.filter((url): url is string => typeof url === "string" && url.length > 0);
  return {
    severity,
    category,
    url: urls[0] ?? null,
    affectedUrls: urls,
    title,
    description,
    recommendation,
    affectedCount: affectedCount ?? urls.length,
  };
}

export function runAuditRules(
  crawl: CrawlResult,
  pagespeed: PageSpeedResult | null
): AuditReport {
  const issues: AuditIssue[] = [];
  const pages = crawl.pages;

  // ── META TAGS ──────────────────────────────────────────────────────────────

  const missingTitle = pages.filter((p) => !p.title?.trim());
  if (missingTitle.length > 0) {
    issues.push(
      mk(
        "critical",
        "meta",
        "Missing Title Tag",
        `${missingTitle.length} page(s) have no title tag.`,
        "Add a unique, descriptive title tag (30–60 chars) to every page.",
        missingTitle.map((p) => p.url)
      )
    );
  }

  const titleTooLong = pages.filter((p) => p.title && p.title.length > 60);
  if (titleTooLong.length > 0) {
    issues.push(
      mk(
        "warning",
        "meta",
        "Title Too Long",
        `${titleTooLong.length} page(s) have titles over 60 characters.`,
        "Shorten titles to 60 chars or fewer to avoid truncation in search results.",
        titleTooLong.map((p) => p.url)
      )
    );
  }

  const titleTooShort = pages.filter(
    (p) => p.title && p.title.trim().length > 0 && p.title.trim().length < 30
  );
  if (titleTooShort.length > 0) {
    issues.push(
      mk(
        "warning",
        "meta",
        "Title Too Short",
        `${titleTooShort.length} page(s) have titles under 30 characters.`,
        "Expand titles to at least 30 characters to improve keyword targeting.",
        titleTooShort.map((p) => p.url)
      )
    );
  }

  const missingDesc = pages.filter((p) => !p.meta_description?.trim());
  if (missingDesc.length > 0) {
    issues.push(
      mk(
        "warning",
        "meta",
        "Missing Meta Description",
        `${missingDesc.length} page(s) have no meta description.`,
        "Add a meta description (70–160 chars) to every page to improve click-through rates.",
        missingDesc.map((p) => p.url)
      )
    );
  }

  const descTooLong = pages.filter(
    (p) => p.meta_description && p.meta_description.length > 160
  );
  if (descTooLong.length > 0) {
    issues.push(
      mk(
        "warning",
        "meta",
        "Meta Description Too Long",
        `${descTooLong.length} page(s) have meta descriptions over 160 characters.`,
        "Trim meta descriptions to 160 characters to prevent search result truncation.",
        descTooLong.map((p) => p.url)
      )
    );
  }

  const descTooShort = pages.filter(
    (p) =>
      p.meta_description &&
      p.meta_description.trim().length > 0 &&
      p.meta_description.trim().length < 70
  );
  if (descTooShort.length > 0) {
    issues.push(
      mk(
        "notice",
        "meta",
        "Meta Description Too Short",
        `${descTooShort.length} page(s) have meta descriptions under 70 characters.`,
        "Expand meta descriptions to at least 70 characters for richer search snippets.",
        descTooShort.map((p) => p.url)
      )
    );
  }

  const missingH1 = pages.filter((p) => !p.h1 || p.h1.length === 0);
  if (missingH1.length > 0) {
    issues.push(
      mk(
        "warning",
        "meta",
        "Missing H1 Tag",
        `${missingH1.length} page(s) have no H1 heading.`,
        "Add a single, keyword-rich H1 tag to every page. Note: JS-rendered H1s are not detected without full JS rendering.",
        missingH1.map((p) => p.url)
      )
    );
  }

  const multipleH1 = pages.filter((p) => p.h1 && p.h1.length > 1);
  if (multipleH1.length > 0) {
    issues.push(
      mk(
        "warning",
        "meta",
        "Multiple H1 Tags",
        `${multipleH1.length} page(s) have more than one H1 heading.`,
        "Use exactly one H1 per page; convert extras to H2 or H3.",
        multipleH1.map((p) => p.url)
      )
    );
  }

  // ── LINKS ─────────────────────────────────────────────────────────────────

  const broken = pages.filter((p) => p.status_code === 404);
  if (broken.length > 0) {
    issues.push(
      mk(
        "critical",
        "links",
        "Broken Internal Links (404)",
        `${broken.length} page(s) returned a 404 status.`,
        "Fix or redirect these broken URLs to avoid crawl errors and lost link equity.",
        broken.map((p) => p.url)
      )
    );
  }

  const linkedSet = new Set<string>();
  for (const p of pages) {
    for (const link of p.internal_links ?? []) linkedSet.add(link);
  }
  const orphans = pages.filter((p) => p.status_code === 200 && !linkedSet.has(p.url));
  if (orphans.length > 0) {
    issues.push(
      mk(
        "warning",
        "links",
        "Orphan Pages",
        `${orphans.length} page(s) have no internal links pointing to them.`,
        "Add internal links to orphan pages so search engines can discover them.",
        orphans.map((p) => p.url)
      )
    );
  }

  const redirectChains = pages.filter((p) => (p.redirect_chain?.length ?? 0) > 1);
  if (redirectChains.length > 0) {
    issues.push(
      mk(
        "warning",
        "links",
        "Redirect Chains Detected",
        `${redirectChains.length} URL(s) go through multi-hop redirect chains.`,
        "Update internal links to point directly to the final destination URL.",
        redirectChains.map((p) => p.url)
      )
    );
  }

  // ── SPEED ─────────────────────────────────────────────────────────────────

  const slowTtfb = pages.filter((p) => (p.ttfb_ms ?? 0) > 600);
  if (slowTtfb.length > 0) {
    issues.push(
      mk(
        "warning",
        "speed",
        "Slow Time to First Byte",
        `${slowTtfb.length} page(s) have TTFB over 600ms.`,
        "Enable server caching, use a CDN, and optimise database queries to reduce TTFB.",
        slowTtfb.map((p) => p.url)
      )
    );
  }

  const pagesWithMissingAlt = pages.filter((p) => (p.images_without_alt ?? 0) > 0);
  if (pagesWithMissingAlt.length > 0) {
    const totalMissing = pagesWithMissingAlt.reduce(
      (n, p) => n + (p.images_without_alt ?? 0),
      0
    );
    issues.push(
      mk(
        "warning",
        "speed",
        "Images Missing Alt Text",
        `${totalMissing} image(s) on ${pagesWithMissingAlt.length} page(s) have no alt attribute.`,
        "Add descriptive alt text to all images for accessibility and image search indexing.",
        pagesWithMissingAlt.map((p) => p.url),
        totalMissing
      )
    );
  }

  // ── CONTENT ───────────────────────────────────────────────────────────────

  const thin = pages.filter((p) => p.status_code === 200 && (p.word_count ?? 0) < 300);
  if (thin.length > 0) {
    issues.push(
      mk(
        "warning",
        "content",
        "Thin Content",
        `${thin.length} page(s) have fewer than 300 words.`,
        "Expand these pages with relevant, detailed content to improve rankings.",
        thin.map((p) => p.url)
      )
    );
  }

  const noOutbound = pages.filter(
    (p) => p.status_code === 200 && (p.external_links?.length ?? 0) === 0
  );
  if (noOutbound.length > 0) {
    issues.push(
      mk(
        "notice",
        "content",
        "No Outbound Links",
        `${noOutbound.length} page(s) have zero external links.`,
        "Add relevant outbound links to authoritative sources to signal topical depth.",
        noOutbound.map((p) => p.url)
      )
    );
  }

  // ── SCHEMA ────────────────────────────────────────────────────────────────

  const noSchema = pages.filter((p) => p.status_code === 200 && !p.has_json_ld);
  if (noSchema.length > 0) {
    issues.push(
      mk(
        "notice",
        "schema",
        "Missing JSON-LD Schema",
        `${noSchema.length} page(s) have no structured data.`,
        "Add appropriate Schema.org markup to enable rich results in search.",
        noSchema.map((p) => p.url)
      )
    );
  }

  // ── MOBILE ────────────────────────────────────────────────────────────────

  const noViewport = pages.filter((p) => p.has_viewport === false);
  if (noViewport.length > 0) {
    issues.push(
      mk(
        "critical",
        "mobile",
        "Missing Viewport Meta Tag",
        `${noViewport.length} page(s) are missing the viewport meta tag.`,
        'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to every page.',
        noViewport.map((p) => p.url)
      )
    );
  }

  // ── SECURITY ──────────────────────────────────────────────────────────────

  const notHttps = pages.filter((p) => p.is_https === false);
  if (notHttps.length > 0) {
    issues.push(
      mk(
        "critical",
        "security",
        "Pages Not Served Over HTTPS",
        `${notHttps.length} page(s) are not served over HTTPS.`,
        "Install an SSL certificate and configure 301 redirects from HTTP to HTTPS.",
        notHttps.map((p) => p.url)
      )
    );
  }

  // ── INDEXING ──────────────────────────────────────────────────────────────

  const noindex = pages.filter((p) => {
    const r = (p.meta_robots ?? "").toLowerCase();
    return r.includes("noindex") || r.includes("none");
  });
  if (noindex.length > 0) {
    issues.push(
      mk(
        "warning",
        "indexing",
        "Noindex Directive Detected",
        `${noindex.length} page(s) contain a noindex directive.`,
        "Review these pages — only apply noindex deliberately if you want them excluded from search.",
        noindex.map((p) => p.url)
      )
    );
  }

  const noCanonical = pages.filter((p) => p.status_code === 200 && !p.canonical);
  if (noCanonical.length > 0) {
    issues.push(
      mk(
        "notice",
        "indexing",
        "Missing Canonical Tag",
        `${noCanonical.length} page(s) have no canonical link element.`,
        "Add a self-referencing canonical tag to prevent duplicate content issues.",
        noCanonical.map((p) => p.url)
      )
    );
  }

  // ── CORE WEB VITALS ───────────────────────────────────────────────────────

  let cwvFailures = 0;
  if (pagespeed) {
    if (pagespeed.lcp_ms > 2500) {
      cwvFailures++;
      issues.push(
        mk(
          "critical",
          "cwv",
          "LCP Too Slow",
          `Largest Contentful Paint is ${(pagespeed.lcp_ms / 1000).toFixed(2)}s (threshold: 2.5s).`,
          "Optimise the largest visible element: compress images, preload fonts, and reduce TTFB.",
          []
        )
      );
    }
    if (pagespeed.cls > 0.1) {
      cwvFailures++;
      issues.push(
        mk(
          "warning",
          "cwv",
          "CLS Score Too High",
          `Cumulative Layout Shift is ${pagespeed.cls.toFixed(3)} (threshold: 0.1).`,
          "Set explicit sizes on images and embeds; avoid inserting content above existing content.",
          []
        )
      );
    }
    if (pagespeed.performance_score < 50) {
      cwvFailures++;
      issues.push(
        mk(
          "critical",
          "cwv",
          "Poor PageSpeed Performance Score",
          `Mobile performance score is ${pagespeed.performance_score}/100 (threshold: 50).`,
          "Reduce JS bundle size, defer unused scripts, and use next-gen image formats.",
          []
        )
      );
    }
  }

  // ── HEALTH SCORE ──────────────────────────────────────────────────────────

  const criticals = issues.filter((i) => i.severity === "critical" && i.category !== "cwv").length;
  const warnings = issues.filter((i) => i.severity === "warning" && i.category !== "cwv").length;
  const notices = issues.filter((i) => i.severity === "notice" && i.category !== "cwv").length;

  const healthScore = Math.max(
    0,
    Math.round(
      100 -
        Math.min(criticals * 5, 40) -
        Math.min(warnings * 2, 30) -
        Math.min(notices * 0.5, 15) -
        cwvFailures * 5
    )
  );

  const cwvScore = Math.round(Math.max(0, 100 - cwvFailures * 34));

  return {
    issues,
    healthScore,
    cwvScore,
    criticalCount: issues.filter((i) => i.severity === "critical").length,
    warningCount: issues.filter((i) => i.severity === "warning").length,
    noticeCount: issues.filter((i) => i.severity === "notice").length,
    pagesCrawled: pages.length,
  };
}

export function extractPageSpeed(apiResponse: unknown): PageSpeedResult | null {
  try {
    const r = apiResponse as {
      lighthouseResult?: {
        audits?: {
          "largest-contentful-paint"?: { numericValue?: number };
          "cumulative-layout-shift"?: { numericValue?: number };
        };
        categories?: { performance?: { score?: number } };
      };
    };
    const audits = r.lighthouseResult?.audits;
    const lcp_ms = audits?.["largest-contentful-paint"]?.numericValue ?? 0;
    const cls = audits?.["cumulative-layout-shift"]?.numericValue ?? 0;
    const score = (r.lighthouseResult?.categories?.performance?.score ?? 0) * 100;
    return { lcp_ms, cls, performance_score: Math.round(score) };
  } catch {
    return null;
  }
}
