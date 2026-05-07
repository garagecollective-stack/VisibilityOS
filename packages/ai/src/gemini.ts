import type { GEOCheckResult } from "./types.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }> };
  }>;
}

// Gemini Flash used only for GEO tracker
export class GeminiClient {
  constructor(private readonly apiKey?: string) {
    this.apiKey = apiKey ?? process.env["GEMINI_API_KEY"];
  }

  async checkGEOVisibility(
    prompt: string,
    targetDomain: string
  ): Promise<GEOCheckResult> {
    const res = await fetch(
      `${GEMINI_BASE}/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1024 },
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as GeminiResponse;
    const responseText = data.candidates[0]?.content.parts[0]?.text ?? "";
    const cited = responseText.toLowerCase().includes(targetDomain.toLowerCase());

    return {
      platform: "gemini",
      prompt,
      cited,
      citationPosition: cited ? 1 : null,
      responseText,
      confidence: 0.8,
    };
  }
}
