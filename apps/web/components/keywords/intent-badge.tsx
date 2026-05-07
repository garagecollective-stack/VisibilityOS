import { cn } from "@/lib/utils";

type Intent = "Transactional" | "Informational" | "Navigational" | "Commercial";

const STYLES: Record<Intent, string> = {
  Informational: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Transactional: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Navigational: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Commercial: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

interface IntentBadgeProps {
  intent: string;
  className?: string;
}

export function IntentBadge({ intent, className }: IntentBadgeProps) {
  const style = STYLES[intent as Intent] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", style, className)}>
      {intent}
    </span>
  );
}
