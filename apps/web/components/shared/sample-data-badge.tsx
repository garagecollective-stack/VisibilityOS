import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function SampleDataBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
        className
      )}
      title="This section shows placeholder data. Connect the source to see real numbers."
    >
      <Sparkles className="h-2.5 w-2.5" />
      Sample Data
    </span>
  );
}
