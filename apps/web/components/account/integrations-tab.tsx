"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Circle, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface GscProject {
  id: string;
  name: string;
  connected: boolean;
  email: string | null;
  lastSyncedAt: string | null;
}

interface IntegrationsData {
  gsc: { connected: boolean; projects: GscProject[] };
  ga4: { connected: boolean };
  googleAds: { connected: boolean };
  dataForSEO: { configured: boolean };
  anthropic: { configured: boolean };
}

interface Props {
  data: IntegrationsData | null;
  loading: boolean;
  error: boolean;
}

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

function StatusBadge({ active, label }: { active: boolean; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
        active
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
      )}
    >
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
      {label ?? (active ? "Connected" : "Not connected")}
    </span>
  );
}

function ConfigBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
        active
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
      )}
    >
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      {active ? "Active" : "Not configured"}
    </span>
  );
}

interface IntegrationRowProps {
  logo: React.ReactNode;
  name: string;
  description: string;
  unlocks: string;
  status: React.ReactNode;
  action?: React.ReactNode;
  detail?: React.ReactNode;
}

function IntegrationRow({ logo, name, description, unlocks, status, action, detail }: IntegrationRowProps) {
  return (
    <div className="flex items-start gap-4 py-4 border-b last:border-0">
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xl mt-0.5">
        {logo}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{name}</span>
          {status}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        <p className="text-xs text-primary/80 mt-0.5">
          <span className="font-medium">Unlocks:</span> {unlocks}
        </p>
        {detail && <div className="mt-2">{detail}</div>}
      </div>
      {action && <div className="shrink-0 mt-0.5">{action}</div>}
    </div>
  );
}

// ── Per-project GSC row ───────────────────────────────────────────────────────

function GscProjectRow({ project, onSynced }: { project: GscProject; onSynced: () => void }) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return apiClient(`/gsc/disconnect/${project.id}`, { method: "DELETE", token: token ?? undefined });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["account-integrations"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return apiClient(`/gsc/sync/${project.id}`, { method: "POST", token: token ?? undefined });
    },
    onSuccess: onSynced,
  });

  const lastSynced = project.lastSyncedAt
    ? new Date(project.lastSyncedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-muted/40 text-sm">
      <div className="min-w-0">
        <span className="font-medium truncate block">{project.name}</span>
        {project.connected && (
          <span className="text-xs text-muted-foreground">
            {project.email && <>{project.email} · </>}
            {lastSynced ? `Last synced ${lastSynced}` : "Not yet synced"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {project.connected ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Sync
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
            <a href={`${API_URL}/api/gsc/auth/start?projectId=${project.id}`}>
              Connect
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function IntegrationsTab({ data, loading, error }: Props) {
  const [syncedMsg, setSyncedMsg] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-4 border-b last:border-0">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive/60" />
          Failed to load integration status.
        </CardContent>
      </Card>
    );
  }

  const gscProjects = data.gsc.projects ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Accounts</CardTitle>
        <CardDescription>Manage integrations that power your SEO data</CardDescription>
      </CardHeader>
      <CardContent>
        <IntegrationRow
          logo="🔍"
          name="Google Search Console"
          description="Connect your GSC property to import real click and impression data."
          unlocks="Real click and impression data, top queries, page performance"
          status={<StatusBadge active={data.gsc.connected} />}
          detail={
            gscProjects.length > 0 ? (
              <div className="space-y-1.5">
                {gscProjects.map((p) => (
                  <GscProjectRow
                    key={p.id}
                    project={p}
                    onSynced={() => {
                      setSyncedMsg(true);
                      setTimeout(() => setSyncedMsg(false), 3000);
                    }}
                  />
                ))}
                {syncedMsg && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Sync started — data will appear in a few minutes.
                  </p>
                )}
              </div>
            ) : undefined
          }
        />

        <IntegrationRow
          logo="📊"
          name="Google Analytics 4"
          description="Pull GA4 traffic and conversion data into your dashboard."
          unlocks="Session data, goal completions, audience insights"
          status={<StatusBadge active={data.ga4.connected} />}
          action={
            !data.ga4.connected ? (
              <Button size="sm" variant="outline" disabled>
                Coming soon
              </Button>
            ) : undefined
          }
        />

        <IntegrationRow
          logo="📢"
          name="Google Ads"
          description="Access keyword volume data through the Google Ads API at no cost."
          unlocks="Free keyword volume data, CPC estimates, competition data"
          status={<StatusBadge active={false} label="Not connected" />}
          action={
            <Button size="sm" variant="outline" asChild>
              <a
                href="https://developers.google.com/google-ads/api/docs/start"
                target="_blank"
                rel="noopener noreferrer"
                className="gap-1.5"
              >
                Apply for Access
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          }
        />

        <IntegrationRow
          logo="⚡"
          name="DataForSEO"
          description="Powers all keyword research, SERP data, and competitor analysis."
          unlocks="Keyword data, SERP results, backlinks, competitor insights"
          status={<ConfigBadge active={data.dataForSEO.configured} />}
          action={
            !data.dataForSEO.configured ? (
              <Button size="sm" variant="outline" asChild>
                <a
                  href="https://dataforseo.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-1.5"
                >
                  Get API Key
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            ) : undefined
          }
        />

        <IntegrationRow
          logo="🤖"
          name="Anthropic (Claude AI)"
          description="Powers the AI keyword strategy builder and content suggestions."
          unlocks="AI-powered strategy builder, cluster analysis, content calendar"
          status={<ConfigBadge active={data.anthropic.configured} />}
          action={
            !data.anthropic.configured ? (
              <Button size="sm" variant="outline" asChild>
                <a
                  href="https://console.anthropic.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-1.5"
                >
                  Get API Key
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            ) : undefined
          }
        />
      </CardContent>
    </Card>
  );
}
