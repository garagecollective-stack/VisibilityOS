"use client";

import { ExternalLink, HelpCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface AiCrawlerAccess {
  chatgpt_user?: "allowed" | "blocked" | "unknown";
  oai_searchbot?: "allowed" | "blocked" | "unknown";
  gptbot?: "allowed" | "blocked" | "unknown";
  google_extended?: "allowed" | "blocked" | "unknown";
  perplexitybot?: "allowed" | "blocked" | "unknown";
  claudebot?: "allowed" | "blocked" | "unknown";
}

const BOTS: Array<{ key: keyof AiCrawlerAccess; label: string }> = [
  { key: "chatgpt_user", label: "ChatGPT-User" },
  { key: "oai_searchbot", label: "OAI-SearchBot" },
  { key: "gptbot", label: "GPTBot" },
  { key: "google_extended", label: "Google-Extended" },
  { key: "perplexitybot", label: "PerplexityBot" },
  { key: "claudebot", label: "ClaudeBot" },
];

function StatusBadge({ status }: { status: "allowed" | "blocked" | "unknown" | undefined }) {
  if (status === "allowed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
        ✅ Allowed
      </span>
    );
  }
  if (status === "blocked") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
        ❌ Blocked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      ⚪ Unknown
    </span>
  );
}

function LlmsTxtStatus({ found, hasIssues }: { found: boolean | undefined; hasIssues: boolean }) {
  if (found === undefined) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        ⚪ Not checked
      </span>
    );
  }
  if (!found) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
        ❌ Not found
      </span>
    );
  }
  if (hasIssues) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        ⚠️ Found but has issues
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
      ✅ Found and valid
    </span>
  );
}

interface Props {
  aiCrawlerAccess?: AiCrawlerAccess | null;
  llmsTxtFound?: boolean | undefined;
  llmsTxtHasIssues?: boolean;
  aiSearchScore?: number | null;
}

export function AiSearchVisibilityCard({ aiCrawlerAccess, llmsTxtFound, llmsTxtHasIssues, aiSearchScore }: Props) {
  const access = aiCrawlerAccess ?? {};
  const scoreColor =
    aiSearchScore == null
      ? "text-muted-foreground"
      : aiSearchScore >= 80
      ? "text-green-600 dark:text-green-400"
      : aiSearchScore >= 50
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-600 dark:text-red-400";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            AI Search Visibility
          </div>
          {aiSearchScore != null && (
            <div className="text-right">
              <p className={cn("text-2xl font-bold tabular-nums leading-none", scoreColor)}>
                {aiSearchScore}
                <span className="text-sm font-normal text-muted-foreground">/100</span>
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">AI Search Score</p>
            </div>
          )}
        </CardTitle>
        {aiSearchScore != null && (
          <p className="text-xs text-muted-foreground">
            How well optimised for AI search engines
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            AI Bot Access
          </p>
          <div className="divide-y rounded-md border">
            {BOTS.map((bot) => (
              <div key={bot.key} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm font-medium">{bot.label}</span>
                <StatusBadge status={access[bot.key]} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              llms.txt
            </p>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  llms.txt is an emerging standard that tells AI crawlers which content on your site
                  should be indexed. Similar to robots.txt but designed for large language models.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className={cn("flex items-center justify-between rounded-md border px-3 py-2")}>
            <span className="text-sm font-medium">/llms.txt</span>
            <div className="flex items-center gap-2">
              <LlmsTxtStatus found={!!llmsTxtFound} hasIssues={!!llmsTxtHasIssues} />
              <a
                href="https://llmstxt.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
              >
                Learn more
                <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
