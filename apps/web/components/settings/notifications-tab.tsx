"use client";

import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { SaveButton } from "@/components/account/save-button";
import { apiClient } from "@/lib/api";

type SaveState = "idle" | "saving" | "saved" | "error";

interface OrgData {
  settings?: {
    weeklyDigest?: boolean;
    monthlyReport?: boolean;
    productUpdates?: boolean;
    notificationEmail?: string;
  };
}

export function NotificationsTab() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["settings-org"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ org: OrgData }>("/settings/organization", { token: token ?? undefined });
    },
  });

  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [monthlyReport, setMonthlyReport] = useState(true);
  const [productUpdates, setProductUpdates] = useState(true);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    if (saveState === "saved") {
      const t = setTimeout(() => setSaveState("idle"), 2000);
      return () => clearTimeout(t);
    }
  }, [saveState]);

  useEffect(() => {
    const s = data?.org?.settings ?? {};
    setWeeklyDigest(s.weeklyDigest ?? true);
    setMonthlyReport(s.monthlyReport ?? true);
    setProductUpdates(s.productUpdates ?? true);
    setNotificationEmail(
      s.notificationEmail ??
        user?.primaryEmailAddress?.emailAddress ??
        ""
    );
  }, [data, user]);

  async function handleSave() {
    setSaveState("saving");
    try {
      const token = await getToken();
      await apiClient("/settings/organization", {
        method: "PATCH",
        token: token ?? undefined,
        body: JSON.stringify({
          settings: { weeklyDigest, monthlyReport, productUpdates, notificationEmail },
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["settings-org"] });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  const toggleItems = [
    {
      id: "weekly",
      label: "Weekly SEO digest",
      description: "A weekly summary of your SEO performance across all projects.",
      val: weeklyDigest,
      set: setWeeklyDigest,
    },
    {
      id: "monthly",
      label: "Monthly performance report",
      description: "An auto-generated monthly report delivered to your inbox.",
      val: monthlyReport,
      set: setMonthlyReport,
    },
    {
      id: "updates",
      label: "Product updates and tips",
      description: "Feature announcements, tips, and platform improvements.",
      val: productUpdates,
      set: setProductUpdates,
    },
  ] satisfies { id: string; label: string; description: string; val: boolean; set: (v: boolean) => void }[];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Choose which emails you receive from VisibilityOS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {toggleItems.map(({ id, label, description, val, set }) => (
            <div key={id} className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3.5">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
              <Switch
                checked={val}
                onCheckedChange={(v) => { set(v); setSaveState("idle"); }}
              />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="global-notif-email">Notification Email</Label>
          <Input
            id="global-notif-email"
            type="email"
            value={notificationEmail}
            onChange={(e) => { setNotificationEmail(e.target.value); setSaveState("idle"); }}
            placeholder="you@example.com"
          />
        </div>
        <div className="flex justify-end">
          <SaveButton state={saveState} onClick={handleSave} />
        </div>
      </CardContent>
    </Card>
  );
}
