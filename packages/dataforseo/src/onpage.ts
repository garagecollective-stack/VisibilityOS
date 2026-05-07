import type { DataForSEOClient } from "./client.js";
import type { OnPagePage, OnPageSummary, OnPageIssue } from "./types.js";

export class OnPageClient {
  constructor(private readonly client: DataForSEOClient) {}

  /**
   * Start a new crawl task. Returns the task ID.
   */
  async startCrawl(
    domain: string,
    maxPages: number = 500,
    enableJavascript: boolean = true,
    loadResources: boolean = false
  ): Promise<string> {
    const res = await this.client.post<{ id: string }>("/v3/on_page/task_post", [
      {
        target: domain,
        max_crawl_pages: maxPages,
        enable_javascript: enableJavascript,
        load_resources: loadResources,
        enable_browser_rendering: enableJavascript,
        custom_js: null,
        disable_cookie_popup: true,
        return_despite_timeout: false,
        enable_content_parsing: true,
        calculate_keyword_density: false,
      },
    ]);

    const taskId = res.tasks[0]?.id;
    if (!taskId) throw new Error("OnPage task_post returned no task ID");
    return taskId;
  }

  /**
   * Fetch crawled page data for a task.
   */
  async getCrawlResults(taskId: string, limit: number = 1000, offset: number = 0): Promise<OnPagePage[]> {
    const res = await this.client.post<{ items: OnPagePage[] }>("/v3/on_page/pages", [
      { id: taskId, limit, offset, filters: [["resource_type", "=", "html"]] },
    ]);
    const result = res.tasks[0]?.result?.[0] as { items?: OnPagePage[] } | undefined;
    return result?.items ?? [];
  }

  /**
   * Fetch the issues summary for a completed crawl.
   */
  async getIssues(taskId: string): Promise<OnPageIssue[]> {
    const res = await this.client.post<OnPageSummary>("/v3/on_page/issues_summary", [
      { id: taskId },
    ]);
    const summary = res.tasks[0]?.result?.[0] as OnPageSummary | undefined;
    if (!summary?.checks) return [];

    // Flatten the checks map into an array of issues
    return Object.entries(summary.checks).map(([checkId, data]) => ({
      id: `${taskId}_${checkId}`,
      check_id: checkId,
      title: formatCheckTitle(checkId),
      description: "",
      category: inferCategory(checkId),
      relevance: 0,
      severity: inferSeverity(checkId),
      pages_count: data.issues_count,
      pages_crawled_count: data.relevant_pages_count,
    }));
  }

  /**
   * Get overall crawl summary.
   */
  async getSummary(taskId: string): Promise<OnPageSummary | null> {
    const res = await this.client.post<OnPageSummary>("/v3/on_page/summary", [
      { id: taskId },
    ]);
    return (res.tasks[0]?.result?.[0] as OnPageSummary | undefined) ?? null;
  }

  /**
   * Poll until task is done or timeout. Returns taskId.
   */
  async waitForTask(taskId: string, timeoutMs: number = 600_000): Promise<void> {
    const pollMs = 15_000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollMs));
      const summary = await this.getSummary(taskId);
      if (summary?.crawl_progress === "finished") return;
    }

    throw new Error(`OnPage task ${taskId} timed out after ${timeoutMs / 1000}s`);
  }
}

function formatCheckTitle(checkId: string): string {
  return checkId
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function inferCategory(checkId: string): string {
  if (checkId.includes("title") || checkId.includes("description") || checkId.includes("h1")) return "meta";
  if (checkId.includes("link") || checkId.includes("redirect")) return "links";
  if (checkId.includes("speed") || checkId.includes("lcp") || checkId.includes("cls") || checkId.includes("fid")) return "cwv";
  if (checkId.includes("mobile")) return "mobile";
  if (checkId.includes("schema") || checkId.includes("structured")) return "schema";
  if (checkId.includes("ssl") || checkId.includes("https") || checkId.includes("security")) return "security";
  if (checkId.includes("index") || checkId.includes("robot") || checkId.includes("canonical")) return "indexing";
  if (checkId.includes("content") || checkId.includes("duplicate")) return "content";
  return "meta";
}

const CRITICAL_CHECKS = new Set([
  "broken_links",
  "no_title",
  "no_description",
  "duplicate_title",
  "duplicate_description",
  "broken_resources",
  "no_h1_tag",
  "no_image_alt",
  "canonical_to_broken",
  "canonical_to_redirect",
  "pages_with_blocked_internal_resources",
]);

const WARNING_CHECKS = new Set([
  "title_too_long",
  "title_too_short",
  "description_too_long",
  "description_too_short",
  "low_word_count",
  "redirect_chains",
  "slow_page",
]);

function inferSeverity(checkId: string): "critical" | "warning" | "notice" {
  if (CRITICAL_CHECKS.has(checkId)) return "critical";
  if (WARNING_CHECKS.has(checkId)) return "warning";
  return "notice";
}
