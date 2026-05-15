"use client";

import { AlertCircle, ArrowUpRight, CreditCard, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface BillingData {
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

interface UsageData {
  projectsCount: number;
  keywordsCount: number;
  auditsThisMonth: number;
}

interface Props {
  billing: BillingData | null;
  usage: UsageData | null;
  loading: boolean;
  error: boolean;
}

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pro: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  agency: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  enterprise: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

function UsageBar({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number;
}) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min(100, Math.round((current / limit) * 100));
  const isHigh = pct >= 80;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {unlimited ? (
            <span className="text-green-600">Unlimited</span>
          ) : (
            <>
              <span className={cn(isHigh && "text-orange-600")}>{current}</span>
              <span className="text-muted-foreground"> / {limit}</span>
            </>
          )}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-500" : "bg-primary"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function BillingTab({ billing, usage, loading, error }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-52 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !billing) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive/60" />
          Failed to load billing details.
        </CardContent>
      </Card>
    );
  }

  const planKey = billing.plan.toLowerCase();
  const planLabel = billing.limits.name;
  const isEnterprise = planKey === "enterprise";

  const renewalDate = billing.subscription?.currentPeriodEnd
    ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const priceDisplay = (() => {
    if (isEnterprise) return "Custom pricing";
    if (billing.limits.price_usd === 0) return "Free";
    if (billing.limits.price_usd) return `$${billing.limits.price_usd}/mo`;
    return "—";
  })();

  return (
    <div className="space-y-4">
      {/* Plan card */}
      <Card>
        <CardHeader>
          <CardTitle>Billing & Plan</CardTitle>
          <CardDescription>Your current plan, usage, and billing details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current plan */}
          <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-5 py-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="font-semibold">{planLabel} Plan</span>
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                    PLAN_COLORS[planKey] ?? PLAN_COLORS.starter
                  )}
                >
                  {planLabel}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{priceDisplay}</p>
              {renewalDate && (
                <p className="text-xs text-muted-foreground">
                  Renews on {renewalDate}
                </p>
              )}
            </div>
            {!isEnterprise && (
              <Button className="gap-1.5" asChild>
                <a href="mailto:hello@visibilityos.com">
                  <ArrowUpRight className="h-4 w-4" />
                  Upgrade Plan
                </a>
              </Button>
            )}
          </div>

          <Separator />

          {/* Usage */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Usage</h3>
            <div className="space-y-4">
              <UsageBar
                label="Projects"
                current={usage?.projectsCount ?? 0}
                limit={billing.limits.projects}
              />
              <UsageBar
                label="Tracked Keywords"
                current={usage?.keywordsCount ?? 0}
                limit={billing.limits.keywords}
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Audits this month</span>
                <span className="font-medium tabular-nums">{usage?.auditsThisMonth ?? 0}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Billing actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="gap-1.5">
              <CreditCard className="h-4 w-4" />
              Manage Billing
            </Button>
            {billing.subscription?.status && (
              <Badge
                variant="outline"
                className={cn(
                  "capitalize",
                  billing.subscription.status === "active" && "border-green-500 text-green-600"
                )}
              >
                {billing.subscription.status}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan comparison hint */}
      {!isEnterprise && (
        <Card className="border-dashed">
          <CardContent className="py-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">Need more capacity?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upgrade to unlock more projects, keywords, and advanced features.
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <a href="mailto:hello@visibilityos.com" className="gap-1.5">
                View Plans
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
