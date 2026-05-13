import {
  Code,
  FileCheck,
  FileText,
  Link as LinkIcon,
  Shield,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CheckCategory {
  icon: typeof FileText;
  label: string;
  iconClass: string;
  items: string[];
}

const CATEGORIES: CheckCategory[] = [
  {
    icon: FileText,
    label: "Meta Tags",
    iconClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    items: [
      "Title tag presence & length",
      "Meta description presence & length",
      "H1 tag presence & duplicates",
    ],
  },
  {
    icon: LinkIcon,
    label: "Links",
    iconClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    items: ["Broken links (404s)", "Orphan pages", "Redirect chains"],
  },
  {
    icon: Zap,
    label: "Speed",
    iconClass: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    items: [
      "Time to First Byte (TTFB)",
      "Images without alt text",
      "Core Web Vitals (LCP, CLS)",
    ],
  },
  {
    icon: FileCheck,
    label: "Content",
    iconClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    items: ["Thin content detection", "Outbound link presence"],
  },
  {
    icon: Code,
    label: "Schema",
    iconClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    items: ["JSON-LD structured data"],
  },
  {
    icon: Shield,
    label: "Security",
    iconClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    items: [
      "HTTPS enforcement",
      "Viewport meta tag",
      "Indexing directives",
      "Canonical tags",
    ],
  },
];

export function AuditChecksGrid() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          What we check
        </h3>
        <p className="text-sm text-muted-foreground">
          23 rules across 6 categories, evaluated on every page the crawler reaches.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <Card key={cat.label} className="overflow-hidden">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                      cat.iconClass
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold">{cat.label}</span>
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {cat.items.map((item) => (
                    <li key={item} className="flex items-start gap-1.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="rounded-md border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        Crawls up to 9,999 pages · ~2–5 min for most sites · Powered by your crawler
      </p>
    </div>
  );
}
