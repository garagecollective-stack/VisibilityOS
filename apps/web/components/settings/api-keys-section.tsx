"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Copy, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";

interface IntegrationsData {
  dataForSEO: { configured: boolean };
  anthropic: { configured: boolean };
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="bg-green-50 text-green-700 border-green-200 gap-1" variant="outline">
      <CheckCircle className="h-3 w-3" />
      Active
    </Badge>
  ) : (
    <Badge className="bg-red-50 text-red-700 border-red-200 gap-1" variant="outline">
      <XCircle className="h-3 w-3" />
      Not configured
    </Badge>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <Copy className="h-3.5 w-3.5 mr-1" />
      {copied ? "Copied!" : "Copy"}
    </Button>
  );
}

export function ApiKeysSection() {
  const { getToken } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<IntegrationsData>("/account/integrations", { token: token ?? undefined });
    },
  });

  const rows = [
    {
      name: "VisibilityOS API Key",
      masked: "vos_••••••••••••••••••••••••••",
      badge: <Badge variant="outline" className="text-xs">Coming soon</Badge>,
      copyValue: null as string | null,
    },
    {
      name: "DataForSEO",
      masked: "Configured in environment",
      badge: isLoading
        ? <Skeleton className="h-5 w-20" />
        : <StatusBadge active={data?.dataForSEO.configured ?? false} />,
      copyValue: null,
    },
    {
      name: "Anthropic (Claude AI)",
      masked: "Configured in environment",
      badge: isLoading
        ? <Skeleton className="h-5 w-20" />
        : <StatusBadge active={data?.anthropic.configured ?? false} />,
      copyValue: null,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys &amp; Integrations</CardTitle>
        <CardDescription>Status of connected data providers and API keys.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {rows.map((row) => (
            <div key={row.name} className="flex items-center justify-between px-6 py-3.5 gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{row.masked}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {row.badge}
                {row.copyValue && <CopyButton text={row.copyValue} />}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
