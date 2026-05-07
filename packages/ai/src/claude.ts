import Anthropic from "@anthropic-ai/sdk";
import type { ContentAnalysis, ClaudeUsage } from "./types.js";

// Claude Sonnet 4.6 for complex analysis, Haiku 4.5 for simple tasks
const SONNET = "claude-sonnet-4-6";
const HAIKU = "claude-haiku-4-5-20251001";

export class ClaudeClient {
  private readonly client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey: apiKey ?? process.env["ANTHROPIC_API_KEY"] });
  }

  /**
   * Analyze page content for SEO quality. Uses Sonnet with prompt caching
   * for the system prompt (large, static SEO rubric).
   */
  async analyzeContent(
    url: string,
    content: string,
    targetKeywords: string[]
  ): Promise<{ analysis: ContentAnalysis; usage: ClaudeUsage }> {
    const systemPrompt = buildContentAnalysisSystemPrompt();

    const res = await this.client.messages.create({
      model: SONNET,
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: systemPrompt,
          // Cache the large system prompt — it's the same every call
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Analyze the following page content for SEO quality.\n\nURL: ${url}\nTarget keywords: ${targetKeywords.join(", ")}\n\n<content>\n${content.slice(0, 12_000)}\n</content>\n\nRespond with valid JSON only.`,
        },
      ],
    });

    const text = res.content.find((b) => b.type === "text")?.text ?? "{}";
    let analysis: ContentAnalysis;
    try {
      analysis = JSON.parse(text) as ContentAnalysis;
    } catch {
      throw new Error(`Claude returned invalid JSON: ${text.slice(0, 200)}`);
    }

    return {
      analysis,
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        cacheReadTokens: (res.usage as unknown as Record<string, number>)["cache_read_input_tokens"] ?? 0,
        cacheCreationTokens: (res.usage as unknown as Record<string, number>)["cache_creation_input_tokens"] ?? 0,
      },
    };
  }

  /**
   * Generate a content brief for a target keyword. Uses Sonnet.
   */
  async generateContentBrief(
    keyword: string,
    competitorUrls: string[],
    targetAudience: string
  ): Promise<string> {
    const res = await this.client.messages.create({
      model: SONNET,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Create a comprehensive SEO content brief for the keyword: "${keyword}"\n\nTarget audience: ${targetAudience}\nCompetitor pages to beat: ${competitorUrls.join(", ")}\n\nInclude: suggested title, meta description, H2/H3 outline, word count target, LSI keywords, internal linking opportunities, and content angle recommendations.`,
        },
      ],
    });

    return res.content.find((b) => b.type === "text")?.text ?? "";
  }

  /**
   * Classify audit issue severity and generate a recommendation.
   * Uses Haiku — cheaper for bulk classification.
   */
  async classifyIssue(
    issueTitle: string,
    issueDescription: string,
    pageUrl: string
  ): Promise<{ severity: "critical" | "warning" | "notice"; recommendation: string }> {
    const res = await this.client.messages.create({
      model: HAIKU,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `SEO audit issue:\nTitle: ${issueTitle}\nDescription: ${issueDescription}\nPage: ${pageUrl}\n\nClassify severity (critical/warning/notice) and provide a 1-2 sentence actionable recommendation. Respond with JSON: {"severity": "...", "recommendation": "..."}`,
        },
      ],
    });

    const text = res.content.find((b) => b.type === "text")?.text ?? "{}";
    return JSON.parse(text) as { severity: "critical" | "warning" | "notice"; recommendation: string };
  }

  /**
   * Summarize rank movement for a weekly digest email.
   * Uses Haiku.
   */
  async summarizeRankMovement(
    domain: string,
    winners: Array<{ keyword: string; change: number }>,
    losers: Array<{ keyword: string; change: number }>
  ): Promise<string> {
    const res = await this.client.messages.create({
      model: HAIKU,
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `Write a brief, professional SEO rank movement summary for ${domain}.\n\nKeywords that improved:\n${winners.map((w) => `- "${w.keyword}": +${w.change} positions`).join("\n")}\n\nKeywords that dropped:\n${losers.map((l) => `- "${l.keyword}": ${l.change} positions`).join("\n")}\n\nKeep it concise (3-4 sentences). Highlight the most significant movements.`,
        },
      ],
    });

    return res.content.find((b) => b.type === "text")?.text ?? "";
  }
}

function buildContentAnalysisSystemPrompt(): string {
  return `You are an expert SEO analyst. When given page content and target keywords, analyze the content and return a JSON object with this exact structure:

{
  "score": <0-100 overall SEO content score>,
  "readabilityScore": <0-100>,
  "seoScore": <0-100>,
  "keywordDensity": { "<keyword>": <percentage as decimal, e.g. 0.023> },
  "suggestions": [
    {
      "type": "<add_section|improve_heading|add_keyword|improve_meta|internal_link>",
      "priority": "<high|medium|low>",
      "title": "<short title>",
      "description": "<actionable description>",
      "example": "<optional example text>"
    }
  ],
  "topicClusters": ["<related topic 1>", "<related topic 2>"],
  "estimatedWordCount": <number>
}

Scoring rubric:
- Keyword in title: +15 pts
- Keyword in H1: +10 pts
- Keyword density 0.5%-2%: +10 pts
- Word count > 800: +10 pts
- Word count > 1500: +5 pts bonus
- Internal links present: +5 pts
- Meta description with keyword: +10 pts
- Structured headings (H2/H3): +10 pts
- Readability (Flesch > 60): +10 pts
- Images with alt text: +5 pts
- Schema markup signals: +5 pts

Return ONLY valid JSON, no explanation or markdown.`;
}
