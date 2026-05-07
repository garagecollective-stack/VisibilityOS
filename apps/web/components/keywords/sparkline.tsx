"use client";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

interface MonthlyPoint {
  year: number;
  month: number;
  search_volume: number;
}

interface SparklineProps {
  data: MonthlyPoint[];
  height?: number;
  color?: string;
}

export function Sparkline({ data, height = 40, color = "hsl(var(--primary))" }: SparklineProps) {
  if (!data || data.length === 0) {
    return <div className="text-xs text-muted-foreground">No trend data</div>;
  }

  const sorted = [...data].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={sorted} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload as MonthlyPoint;
            return (
              <div className="bg-popover border rounded px-2 py-1 text-xs shadow-sm">
                {new Date(d.year, d.month - 1).toLocaleString("default", { month: "short", year: "numeric" })}:{" "}
                <strong>{d.search_volume.toLocaleString()}</strong>
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="search_volume"
          stroke={color}
          dot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
