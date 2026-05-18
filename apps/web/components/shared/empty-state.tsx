import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent
        className={cn(
          "flex flex-col items-center justify-center text-center",
          compact ? "py-8" : "py-14"
        )}
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.08] text-primary">{icon}</div>
        <p className="text-base font-semibold mt-1">{title}</p>
        {description && (
          <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
        {action && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>
  );
}
