import OpenAI from "openai";
import type { GEOCheckResult } from "./types.js";

// GPT-4o-mini used only for GEO tracker
const MODEL = "gpt-4o-mini";

export class OpenAIClient {
  private readonly client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({ apiKey: apiKey ?? process.env["OPENAI_API_KEY"] });
  }

  async checkGEOVisibility(
    prompt: string,
    targetDomain: string
  ): Promise<GEOCheckResult> {
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
    });

    const responseText = completion.choices[0]?.message.content ?? "";
    const cited = responseText.toLowerCase().includes(targetDomain.toLowerCase());
    const citationPosition = cited ? estimateCitationPosition(responseText, targetDomain) : null;

    return {
      platform: "chatgpt",
      prompt,
      cited,
      citationPosition,
      responseText,
      confidence: 0.9,
    };
  }
}

function estimateCitationPosition(text: string, domain: string): number {
  const lower = text.toLowerCase();
  const domainLower = domain.toLowerCase();
  const idx = lower.indexOf(domainLower);
  if (idx === -1) return 0;
  // Count sentences before this mention
  const before = text.slice(0, idx);
  const sentenceCount = (before.match(/[.!?]+/g) ?? []).length;
  return sentenceCount + 1;
}
