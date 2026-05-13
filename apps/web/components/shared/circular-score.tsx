import { cn } from "@/lib/utils";

interface CircularScoreProps {
  score: number | null;
  size?: number;
  thickness?: number;
  showLabel?: boolean;
  className?: string;
}

export function scoreColor(score: number | null): string {
  if (score === null) return "#94a3b8";
  if (score >= 90) return "#22c55e";
  if (score >= 70) return "#3b82f6";
  if (score >= 50) return "#eab308";
  return "#ef4444";
}

export function scoreLabel(score: number | null): string {
  if (score === null) return "—";
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Work";
  return "Critical";
}

export function CircularScore({
  score,
  size = 80,
  thickness = 8,
  showLabel = false,
  className,
}: CircularScoreProps) {
  const value = score ?? 0;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = scoreColor(score);
  const half = size / 2;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle
          cx={half}
          cy={half}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={thickness}
        />
        {score !== null && (
          <circle
            cx={half}
            cy={half}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-xl font-bold tabular-nums leading-none" style={{ color }}>
          {score ?? "—"}
        </div>
        {showLabel && (
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {scoreLabel(score)}
          </div>
        )}
      </div>
    </div>
  );
}
