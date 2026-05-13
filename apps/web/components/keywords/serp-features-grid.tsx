import {
  BookOpen,
  HelpCircle,
  Image as ImageIcon,
  Link as LinkIcon,
  MapPin,
  Newspaper,
  Play,
  ShoppingCart,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Feature {
  code: string;
  label: string;
  icon: LucideIcon;
  activeCls: string;
}

const FEATURES: Feature[] = [
  {
    code: "featured_snippet",
    label: "Featured Snippet",
    icon: Star,
    activeCls: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300",
  },
  {
    code: "people_also_ask",
    label: "People Also Ask",
    icon: HelpCircle,
    activeCls: "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/30 dark:text-purple-300",
  },
  {
    code: "video",
    label: "Video Pack",
    icon: Play,
    activeCls: "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300",
  },
  {
    code: "images",
    label: "Image Pack",
    icon: ImageIcon,
    activeCls: "border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300",
  },
  {
    code: "local_pack",
    label: "Local Pack",
    icon: MapPin,
    activeCls: "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300",
  },
  {
    code: "shopping",
    label: "Shopping",
    icon: ShoppingCart,
    activeCls: "border-yellow-300 bg-yellow-50 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300",
  },
  {
    code: "ai_overview",
    label: "AI Overview",
    icon: Sparkles,
    activeCls: "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300",
  },
  {
    code: "top_stories",
    label: "Top Stories",
    icon: Newspaper,
    activeCls: "border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-300",
  },
  {
    code: "sitelinks",
    label: "Sitelinks",
    icon: LinkIcon,
    activeCls: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
  },
  {
    code: "knowledge_panel",
    label: "Knowledge Panel",
    icon: BookOpen,
    activeCls: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
  },
];

const INACTIVE_CLS =
  "border-border bg-muted/40 text-muted-foreground dark:bg-muted/20";

interface Props {
  serpItemTypes: string[];
}

export function SerpFeaturesGrid({ serpItemTypes }: Props) {
  const activeSet = new Set(serpItemTypes.map((t) => t.toLowerCase()));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">SERP Features</CardTitle>
        <p className="text-sm text-muted-foreground">
          Features appearing in Google results for this keyword
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {FEATURES.map((feature) => {
            const active = activeSet.has(feature.code);
            const Icon = feature.icon;
            return (
              <div
                key={feature.code}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 transition-colors",
                  active ? feature.activeCls : INACTIVE_CLS
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", !active && "opacity-50")} />
                <span className="text-xs font-medium">{feature.label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
