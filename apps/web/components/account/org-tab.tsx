"use client";

import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { Building2, ExternalLink, Users } from "lucide-react";
import { SaveButton } from "@/components/account/save-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

type SaveState = "idle" | "saving" | "saved" | "error";

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pro: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  agency: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  enterprise: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

interface Props {
  plan: string;
}

export function OrgTab({ plan }: Props) {
  const { organization, isLoaded, membership } = useOrganization({ memberships: {} });

  const [orgName, setOrgName] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    if (organization) setOrgName(organization.name);
  }, [organization]);

  useEffect(() => {
    if (saveState === "saved") {
      const t = setTimeout(() => setSaveState("idle"), 2000);
      return () => clearTimeout(t);
    }
  }, [saveState]);

  async function handleSave() {
    if (!organization) return;
    setSaveState("saving");
    try {
      await organization.update({ name: orgName });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  const isDirty = orgName !== (organization?.name ?? "");
  const isAdmin = membership?.role === "org:admin";

  if (!isLoaded) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const planKey = plan.toLowerCase();
  const planLabel = planKey.charAt(0).toUpperCase() + planKey.slice(1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization</CardTitle>
        <CardDescription>Manage your organization details and plan</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo + name display */}
        <div className="flex items-center gap-4">
          {organization?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organization.imageUrl}
              alt={organization.name}
              className="h-14 w-14 rounded-xl object-cover ring-2 ring-border"
            />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center">
              <Building2 className="h-7 w-7 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="font-semibold text-base">{organization?.name}</p>
            <p className="text-sm text-muted-foreground">
              {organization?.slug ?? ""}
            </p>
          </div>
        </div>

        <Separator />

        {/* Org name — editable by admins */}
        <div className="space-y-1.5">
          <Label htmlFor="org-name">Organization Name</Label>
          <Input
            id="org-name"
            value={orgName}
            onChange={(e) => { setOrgName(e.target.value); setSaveState("idle"); }}
            disabled={!isAdmin}
            placeholder="Your organization name"
          />
          {!isAdmin && (
            <p className="text-xs text-muted-foreground">Only admins can edit the organization name.</p>
          )}
        </div>

        {/* Member count */}
        <div className="space-y-1.5">
          <Label>Members</Label>
          <div className="flex items-center gap-2 h-10">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {organization?.membersCount ?? "—"} member{(organization?.membersCount ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <Separator />

        {/* Plan */}
        <div className="space-y-3">
          <Label>Current Plan</Label>
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${PLAN_COLORS[planKey] ?? PLAN_COLORS.starter}`}
              >
                {planLabel}
              </span>
              {planKey !== "enterprise" && (
                <span className="text-sm text-muted-foreground">
                  {planKey === "starter" ? "Free forever" : "Billed monthly"}
                </span>
              )}
            </div>
            {planKey !== "enterprise" && (
              <Button size="sm" asChild>
                <Link href="/dashboard/account?tab=billing">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Upgrade
                </Link>
              </Button>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end pt-2">
            <SaveButton
              state={saveState}
              onClick={handleSave}
              disabled={!isDirty}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
