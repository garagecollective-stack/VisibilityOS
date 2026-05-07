export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ContentAnalysis {
  score: number;           // 0-100
  readabilityScore: number;
  seoScore: number;
  keywordDensity: Record<string, number>;
  suggestions: ContentSuggestion[];
  topicClusters: string[];
  estimatedWordCount: number;
}

export interface ContentSuggestion {
  type: "add_section" | "improve_heading" | "add_keyword" | "improve_meta" | "internal_link";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  example?: string;
}

export interface GEOCheckResult {
  platform: string;
  prompt: string;
  cited: boolean;
  citationPosition: number | null;
  responseText: string;
  confidence: number;
}

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}
