import type { GEOCheckResult } from "./types.js";

const PERPLEXITY_BASE = "https://api.perplexity.ai";

interface PerplexityResponse {
  choices: Array<{ message: { content: string } }>;
}

// Perplexity used only for GEO tracker
export class PerplexityClient {
  constructor(private readonly apiKey?: string) {
    this.apiKey = apiKey ?? process.env["PERPLEXITY_API_KEY"];
  }

  async checkGEOVisibility(
    prompt: string,
    targetDomain: string
  ): Promise<GEOCheckResult> {
    const res = await fetch(`${PERPLEXITY_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Perplexity API error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as PerplexityResponse;
    const responseText = data.choices[0]?.message.content ?? "";
    const cited = responseText.toLowerCase().includes(targetDomain.toLowerCase());

    return {
      platform: "perplexity",
      prompt,
      cited,
      citationPosition: cited ? 1 : null,
      responseText,
      confidence: 0.85,
    };
  }
}
