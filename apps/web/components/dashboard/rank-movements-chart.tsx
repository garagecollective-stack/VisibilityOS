"use client";

import { useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { LineChart as LineChartIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { apiClient } from "@/lib/api";

type VisibilityPoint = { date: string; visibility_score: number; estimated_traffic: number };

interface Props {
  projectId: string;
}

function generateSamplePoints(): VisibilityPoint[] {
  const out: VisibilityPoint[] = [];
  let base = 42;
  for (let i = 29; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    base += (Math.random() - 0.35) * 4;
    base = Math.max(15, Math.min(90, base));
    out.push({
      date: day.toISOString().split("T")[0],
      visibility_score: Math.round(base * 10) / 10,
      estimated_traffic: Math.round(120 + base * 18),
    });
  }
  return out;
}

export function RankMovementsChart({ projectId }: Props) {
  const { getToken } = useAuth();

  const query = useQuery({
    queryKey: ["visibility", projectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ visibility: VisibilityPoint[] }>(
        `/rank/projects/${projectId}/visibility`,
        { token: token ?? undefined }
      );
    },
    enabled: !!projectId,
    retry: false,
  });

  const realPoints = query.data?.visibility ?? [];
  const usingSample = !query.isLoading && realPoints.length === 0;
  const points = useMemo(
    () => (realPoints.length > 0 ? [...realPoints].reverse() : generateSamplePoints()),
    [realPoints]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Rank Movements (30d)</CardTitle>
          <InfoTooltip content="Visibility score is a 0–100 estimate of how visible your tracked keywords are in Google search results." />
        </div>
        {usingSample && <SampleDataBadge />}
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="visibilityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) =>
                    new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                  }
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={36}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelFormatter={(value) =>
                    new Date(String(value)).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  }
                  formatter={(value: number) => [`${value}`, "Visibility"]}
                />
                <Area
                  type="monotone"
                  dataKey="visibility_score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#visibilityGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
