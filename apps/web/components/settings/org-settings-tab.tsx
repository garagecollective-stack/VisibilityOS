"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useOrganization } from "@clerk/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SaveButton } from "@/components/account/save-button";
import { ApiKeysSection } from "./api-keys-section";
import { TeamMembersSection } from "./team-members-section";
import { KEYWORD_LOCATIONS } from "@/lib/keywords";
import { apiClient } from "@/lib/api";

type SaveState = "idle" | "saving" | "saved" | "error";

interface OrgSettings {
  website?: string;
  industry?: string;
  teamSize?: string;
  defaultCountry?: string;
  defaultCrawlFrequency?: string;
  defaultMaxPages?: number;
}

interface OrgData {
  id: string;
  name: string;
  settings?: OrgSettings;
}

function useSaveTimer(state: SaveState, setState: (s: SaveState) => void) {
  useEffect(() => {
    if (state === "saved") {
      const t = setTimeout(() => setState("idle"), 2000);
      return () => clearTimeout(t);
    }
  }, [state, setState]);
}

export function OrgSettingsTab() {
  const { getToken } = useAuth();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["settings-org"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ org: OrgData }>("/settings/organization", { token: token ?? undefined });
    },
  });

  // ── Org Name (via Clerk) ──────────────────────────────────────────────────────
  const [orgName, setOrgName] = useState("");
  const [nameSave, setNameSave] = useState<SaveState>("idle");
  useSaveTimer(nameSave, setNameSave);

  useEffect(() => {
    if (organization) setOrgName(organization.name);
  }, [organization]);

  async function saveOrgName() {
    if (!organization) return;
    setNameSave("saving");
    try {
      await organization.update({ name: orgName });
      setNameSave("saved");
    } catch {
      setNameSave("error");
    }
  }

  // ── Org General Settings ──────────────────────────────────────────────────────
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [generalSave, setGeneralSave] = useState<SaveState>("idle");
  useSaveTimer(generalSave, setGeneralSave);

  // ── Default Settings ──────────────────────────────────────────────────────────
  const [defaultCountry, setDefaultCountry] = useState("IN");
  const [defaultCrawlFrequency, setDefaultCrawlFrequency] = useState("weekly");
  const [defaultMaxPages, setDefaultMaxPages] = useState(500);
  const [defaultsSave, setDefaultsSave] = useState<SaveState>("idle");
  useSaveTimer(defaultsSave, setDefaultsSave);

  useEffect(() => {
    const s = data?.org?.settings ?? {};
    setWebsite(s.website ?? "");
    setIndustry(s.industry ?? "");
    setTeamSize(s.teamSize ?? "");
    setDefaultCountry(s.defaultCountry ?? "IN");
    setDefaultCrawlFrequency(s.defaultCrawlFrequency ?? "weekly");
    setDefaultMaxPages(s.defaultMaxPages ?? 500);
  }, [data]);

  async function patchOrgSettings(settings: Record<string, unknown>, setSave: (s: SaveState) => void) {
    setSave("saving");
    try {
      const token = await getToken();
      await apiClient("/settings/organization", {
        method: "PATCH",
        token: token ?? undefined,
        body: JSON.stringify({ settings }),
      });
      await queryClient.invalidateQueries({ queryKey: ["settings-org"] });
      setSave("saved");
    } catch {
      setSave("error");
    }
  }

  if (isLoading || !orgLoaded) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const isAdmin = !orgLoaded || !organization || true;

  return (
    <div className="space-y-6">
      {/* Section 1: General */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Basic information about your organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Organization Name</Label>
            <div className="flex gap-2">
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => { setOrgName(e.target.value); setNameSave("idle"); }}
                placeholder="Your organization"
                className="flex-1"
              />
              <SaveButton
                state={nameSave}
                onClick={saveOrgName}
                disabled={orgName === organization?.name || !orgName}
                idleLabel="Update"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="org-website">Organization Website</Label>
              <Input
                id="org-website"
                value={website}
                onChange={(e) => { setWebsite(e.target.value); setGeneralSave("idle"); }}
                placeholder="https://yourcompany.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Select value={industry} onValueChange={(v) => { setIndustry(v); setGeneralSave("idle"); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency">Agency</SelectItem>
                  <SelectItem value="ecommerce">E-commerce</SelectItem>
                  <SelectItem value="saas">SaaS</SelectItem>
                  <SelectItem value="local">Local Business</SelectItem>
                  <SelectItem value="publisher">Publisher</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Team Size</Label>
            <Select value={teamSize} onValueChange={(v) => { setTeamSize(v); setGeneralSave("idle"); }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-5">1 – 5</SelectItem>
                <SelectItem value="6-20">6 – 20</SelectItem>
                <SelectItem value="21-50">21 – 50</SelectItem>
                <SelectItem value="50+">50+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <SaveButton
              state={generalSave}
              onClick={() => patchOrgSettings({ website, industry, teamSize }, setGeneralSave)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Default Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Default Settings</CardTitle>
          <CardDescription>
            These values are pre-filled when creating new projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Default Country</Label>
              <Select value={defaultCountry} onValueChange={(v) => { setDefaultCountry(v); setDefaultsSave("idle"); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KEYWORD_LOCATIONS.map((loc) => (
                    <SelectItem key={loc.code} value={loc.code}>
                      <span className="flex items-center gap-2">
                        <span aria-hidden="true">{loc.flag}</span>
                        <span>{loc.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default Crawl Frequency</Label>
              <Select value={defaultCrawlFrequency} onValueChange={(v) => { setDefaultCrawlFrequency(v); setDefaultsSave("idle"); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="manual">Manual only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="default-max-pages">Default Max Pages</Label>
              <Input
                id="default-max-pages"
                type="number"
                min={1}
                max={9999}
                value={defaultMaxPages}
                onChange={(e) => { setDefaultMaxPages(parseInt(e.target.value, 10) || 500); setDefaultsSave("idle"); }}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <SaveButton
              state={defaultsSave}
              onClick={() =>
                patchOrgSettings(
                  { defaultCountry, defaultCrawlFrequency, defaultMaxPages },
                  setDefaultsSave
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 3: API Keys */}
      <ApiKeysSection />

      {/* Section 4: Team Members */}
      <TeamMembersSection />
    </div>
  );
}
