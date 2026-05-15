"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Circle,
  ListChecks,
  Search,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProfileTab } from "@/components/account/profile-tab";
import { OrgTab } from "@/components/account/org-tab";
import { IntegrationsTab } from "@/components/account/integrations-tab";
import { BillingTab } from "@/components/account/billing-tab";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

type TabId = "profile" | "organization" | "integrations" | "billing";

const TABS: { id: TabId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "organization", label: "Organization" },
  { id: "integrations", label: "Connected Accounts" },
  { id: "billing", label: "Billing & Plan" },
];

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

interface BillingResponse {
  plan: string;
  subscription: {
    id?: string;
    status?: string;
    currentPeriodEnd?: string | null;
    razorpaySubscriptionId?: string | null;
  } | null;
  limits: {
    name: string;
    price_inr: number | null;
    price_usd: number | null;
    projects: number;
    keywords: number;
  };
}

interface UsageResponse {
  projectsCount: number;
  keywordsCount: number;
  auditsThisMonth: number;
}

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pro: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  agency: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  enterprise: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const TIPS = [
  {
    icon: Search,
    label: "Connect Google Search Console",
    href: "/dashboard/account?tab=integrations",
    iconCls: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
  },
  {
    icon: ListChecks,
    label: "Add keywords to track rankings",
    href: "/dashboard/keywords/lists",
    iconCls: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
  },
  {
    icon: ShieldCheck,
    label: "Run a site audit to find issues",
    href: "/dashboard/audit",
    iconCls: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
  },
  {
    icon: Users,
    label: "Add competitors to track their keywords",
    href: "/dashboard/competitors",
    iconCls: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
  },
];

const INTEGRATION_LABELS = [
  { key: "gsc", name: "Google Search Console", type: "oauth" },
  { key: "ga4", name: "Google Analytics 4", type: "oauth" },
  { key: "googleAds", name: "Google Ads", type: "oauth" },
  { key: "dataForSEO", name: "DataForSEO", type: "key" },
  { key: "anthropic", name: "Anthropic (Claude AI)", type: "key" },
] as const;

function getIntegrationActive(
  data: IntegrationsData,
  key: (typeof INTEGRATION_LABELS)[number]["key"],
  type: "oauth" | "key"
): boolean {
  if (type === "oauth") {
    return (data[key as keyof Pick<IntegrationsData, "gsc" | "ga4" | "googleAds">] as { connected: boolean }).connected;
  }
  return (data[key as keyof Pick<IntegrationsData, "dataForSEO" | "anthropic">] as { configured: boolean }).configured;
}

// ── Sidebar cards ─────────────────────────────────────────────────────────────

function QuickStatsCard({
  billing,
  usage,
  loading,
}: {
  billing: BillingResponse | null | undefined;
  usage: UsageResponse | null | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const planKey = billing?.plan?.toLowerCase() ?? "starter";
  const planLabel = billing?.limits?.name ?? "Starter";

  const rows = [
    {
      label: "Plan",
      value: (
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
            PLAN_COLORS[planKey] ?? PLAN_COLORS.starter
          )}
        >
          {planLabel}
        </span>
      ),
    },
    {
      label: "Projects",
      value:
        billing?.limits?.projects === -1 ? (
          <span className="text-green-600 text-xs font-medium">Unlimited</span>
        ) : (
          <span className="tabular-nums text-sm font-medium">
            {usage?.projectsCount ?? "—"}
            <span className="text-muted-foreground font-normal"> / {billing?.limits?.projects ?? "—"}</span>
          </span>
        ),
    },
    {
      label: "Keywords tracked",
      value:
        billing?.limits?.keywords === -1 ? (
          <span className="text-green-600 text-xs font-medium">Unlimited</span>
        ) : (
          <span className="tabular-nums text-sm font-medium">
            {usage?.keywordsCount ?? "—"}
            <span className="text-muted-foreground font-normal"> / {billing?.limits?.keywords ?? "—"}</span>
          </span>
        ),
    },
    {
      label: "Audits this month",
      value: (
        <span className="tabular-nums text-sm font-medium">{usage?.auditsThisMonth ?? "—"}</span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <CardTitle>Usage Summary</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{row.label}</span>
            {row.value}
          </div>
        ))}
        <div className="pt-1">
          <Link
            href="/dashboard/account?tab=billing"
            className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
          >
            View billing details
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function TipsCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Getting started</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {TIPS.map((tip, i) => {
          const Icon = tip.icon;
          return (
            <Link
              key={i}
              href={tip.href}
              className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors border-b last:border-0 group"
            >
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", tip.iconCls)}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm flex-1 leading-tight">{tip.label}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

function IntegrationStatusCard({
  data,
  loading,
}: {
  data: IntegrationsData | null | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Integration Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {INTEGRATION_LABELS.map(({ key, name, type }) => {
          const active = data ? getIntegrationActive(data, key, type) : false;
          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-sm truncate">{name}</span>
              {active ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400 shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {type === "key" ? "Active" : "Connected"}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground shrink-0">
                  <Circle className="h-3.5 w-3.5" />
                  {type === "key" ? "Not configured" : "Not connected"}
                </span>
              )}
            </div>
          );
        })}
        <div className="pt-1">
          <Link
            href="/dashboard/account?tab=integrations"
            className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
          >
            Manage integrations
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function AccountPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getToken } = useAuth();

  const tabParam = searchParams.get("tab") as TabId | null;
  const gscParam = searchParams.get("gsc");
  const [activeTab, setActiveTab] = useState<TabId>(
    tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "profile"
  );
  const [gscBanner, setGscBanner] = useState<"connected" | "error" | null>(
    gscParam === "connected" ? "connected" : gscParam === "error" ? "error" : null
  );

  useEffect(() => {
    if (gscParam) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("gsc");
      router.replace(
        `/dashboard/account${params.size > 0 ? "?" + params.toString() : ""}`,
        { scroll: false }
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleTabChange(tab: string) {
    const t = tab as TabId;
    setActiveTab(t);
    const params = new URLSearchParams(searchParams.toString());
    if (t === "profile") params.delete("tab");
    else params.set("tab", t);
    router.replace(`/dashboard/account${params.size > 0 ? "?" + params.toString() : ""}`, { scroll: false });
  }

  const integrationsQuery = useQuery({
    queryKey: ["account-integrations"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<IntegrationsData>("/account/integrations", { token: token ?? undefined });
    },
  });

  const billingQuery = useQuery({
    queryKey: ["billing-subscription"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<BillingResponse>("/billing/subscription", { token: token ?? undefined });
    },
  });

  const usageQuery = useQuery({
    queryKey: ["account-usage"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<UsageResponse>("/account/usage", { token: token ?? undefined });
    },
  });

  return (
    <div className="p-6 space-y-6">
      {/* GSC OAuth result banner */}
      {gscBanner && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm",
            gscBanner === "connected"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
          )}
        >
          <span>
            {gscBanner === "connected"
              ? "Google Search Console connected successfully. Your first sync is running."
              : "Failed to connect Google Search Console. Please try again."}
          </span>
          <button
            onClick={() => setGscBanner(null)}
            className="shrink-0 text-current opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage your profile, organization, integrations, and billing
        </p>
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT — Tabs */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full justify-start h-auto flex-wrap gap-1 bg-transparent p-0 border-b rounded-none">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2 text-sm"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="mt-6">
              <TabsContent value="profile" className="mt-0">
                <ProfileTab />
              </TabsContent>

              <TabsContent value="organization" className="mt-0">
                <OrgTab plan={billingQuery.data?.plan ?? "starter"} />
              </TabsContent>

              <TabsContent value="integrations" className="mt-0">
                <IntegrationsTab
                  data={integrationsQuery.data ?? null}
                  loading={integrationsQuery.isLoading}
                  error={integrationsQuery.isError}
                />
              </TabsContent>

              <TabsContent value="billing" className="mt-0">
                <BillingTab
                  billing={billingQuery.data ?? null}
                  usage={usageQuery.data ?? null}
                  loading={billingQuery.isLoading || usageQuery.isLoading}
                  error={billingQuery.isError}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* RIGHT — Sticky sidebar */}
        <div className="space-y-4 lg:sticky lg:top-6">
          <QuickStatsCard
            billing={billingQuery.data}
            usage={usageQuery.data}
            loading={billingQuery.isLoading || usageQuery.isLoading}
          />
          <TipsCard />
          <IntegrationStatusCard
            data={integrationsQuery.data}
            loading={integrationsQuery.isLoading}
          />
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-32" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        </div>
      }
    >
      <AccountPageInner />
    </Suspense>
  );
}
