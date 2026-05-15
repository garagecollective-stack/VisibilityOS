import { cn } from "@/lib/utils";

// ── Card wrapper ──────────────────────────────────────────────────────────────

interface SemWidgetProps {
  title: string;
  accentColor?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function SemWidget({
  title,
  accentColor = "#5B5BD6",
  headerRight,
  children,
  footer,
  className,
  bodyClassName,
}: SemWidgetProps) {
  return (
    <div
      className={cn("rounded-lg bg-white shadow-sm overflow-hidden", className)}
      style={{ border: "1px solid #F0F0F5" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-4 px-5 py-3.5"
        style={{ borderBottom: "1px solid #F0F0F5" }}
      >
        <h2 className="text-base font-bold" style={{ color: "#1A1A2E" }}>
          <span style={{ borderBottom: `3px solid ${accentColor}`, paddingBottom: "2px" }}>
            {title}
          </span>
        </h2>
        {headerRight && <div className="flex items-center gap-2 shrink-0">{headerRight}</div>}
      </div>

      {/* Body */}
      <div className={cn("px-5 py-4", bodyClassName)}>{children}</div>

      {/* Footer */}
      {footer && (
        <div className="px-5 pb-4">{footer}</div>
      )}
    </div>
  );
}

// ── "View full report" link ───────────────────────────────────────────────────

export function ViewReport({ href, label = "View full report" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      className="block w-full text-center text-sm px-3 py-1.5 rounded transition-colors"
      style={{
        color: "#4285F4",
        border: "1px solid #E5E7EB",
        backgroundColor: "transparent",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
    >
      {label} →
    </a>
  );
}

// ── SVG sparkline (no Recharts, no ResponsiveContainer) ──────────────────────

export function Sparkline({
  data,
  color,
  width = 72,
  height = 28,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * (width - 4) + 2;
      const y = height - 2 - ((v - min) / range) * (height - 4) + 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </svg>
  );
}

// ── Delta badge ───────────────────────────────────────────────────────────────

export function Delta({
  value,
  suffix = "%",
  invert = false,
}: {
  value: number;
  suffix?: string;
  invert?: boolean;
}) {
  const positive = invert ? value < 0 : value > 0;
  const color = positive ? "#00C48C" : "#F34E4E";
  return (
    <span className="text-xs font-medium tabular-nums" style={{ color }}>
      {value > 0 ? "↑ +" : "↓ "}
      {value}
      {suffix}
    </span>
  );
}

// ── Semrush-palette constants ─────────────────────────────────────────────────

export const SC = {
  purple: "#5B5BD6",
  blue: "#4285F4",
  orange: "#FF8C00",
  green: "#00C48C",
  red: "#F34E4E",
  pink: "#E91E8C",
  text: "#1A1A2E",
  muted: "#6B7280",
  border: "#F0F0F5",
} as const;
