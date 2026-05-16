"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { SaveButton } from "@/components/account/save-button";
import { DangerZone } from "./danger-zone";
import { KEYWORD_LOCATIONS } from "@/lib/keywords";
import { apiClient } from "@/lib/api";

type SaveState = "idle" | "saving" | "saved" | "error";

interface NotifyOn {
  criticalIssues?: boolean;
  rankDrops?: boolean;
  newBacklinks?: boolean;
  gscSync?: boolean;
  reportGenerated?: boolean;
}

interface ProjectSettings {
  maxPagesToCrawl?: number;
  crawlFrequency?: string;
  userAgent?: string;
  respectRobots?: boolean;
  notificationsEnabled?: boolean;
  notifyOn?: NotifyOn;
  notificationEmail?: string;
}

interface ProjectData {
  id: string;
  name: string;
  domain: string;
  countryCode: string;
  languageCode: string;
  settings: ProjectSettings;
}

interface Props {
  projectId: string;
}

function useSaveTimer(state: SaveState, setState: (s: SaveState) => void) {
  useEffect(() => {
    if (state === "saved") {
      const t = setTimeout(() => setState("idle"), 2000);
      return () => clearTimeout(t);
    }
  }, [state, setState]);
}

export function ProjectSettingsTab({ projectId }: Props) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["settings-project", projectId],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ project: ProjectData }>(`/settings/projects/${projectId}`, {
        token: token ?? undefined,
      });
    },
    enabled: !!projectId,
  });

  const project = data?.project;

  // ── General ──────────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [countryCode, setCountryCode] = useState("IN");
  const [languageCode, setLanguageCode] = useState("en");
  const [generalSave, setGeneralSave] = useState<SaveState>("idle");
  useSaveTimer(generalSave, setGeneralSave);

  // ── Crawl ─────────────────────────────────────────────────────────────────────
  const [maxPages, setMaxPages] = useState(500);
  const [crawlFrequency, setCrawlFrequency] = useState("weekly");
  const [userAgent, setUserAgent] = useState("visibilityos");
  const [respectRobots, setRespectRobots] = useState(true);
  const [crawlSave, setCrawlSave] = useState<SaveState>("idle");
  useSaveTimer(crawlSave, setCrawlSave);

  // ── Notifications ─────────────────────────────────────────────────────────────
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [criticalIssues, setCriticalIssues] = useState(true);
  const [rankDrops, setRankDrops] = useState(true);
  const [newBacklinks, setNewBacklinks] = useState(true);
  const [gscSync, setGscSync] = useState(true);
  const [reportGenerated, setReportGenerated] = useState(true);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [notifSave, setNotifSave] = useState<SaveState>("idle");
  useSaveTimer(notifSave, setNotifSave);

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setDomain(project.domain);
    setCountryCode(project.countryCode);
    setLanguageCode(project.languageCode);
    const s = project.settings ?? {};
    setMaxPages(s.maxPagesToCrawl ?? 500);
    setCrawlFrequency(s.crawlFrequency ?? "weekly");
    setUserAgent(s.userAgent ?? "visibilityos");
    setRespectRobots(s.respectRobots ?? true);
    setNotificationsEnabled(s.notificationsEnabled ?? true);
    const n = s.notifyOn ?? {};
    setCriticalIssues(n.criticalIssues ?? true);
    setRankDrops(n.rankDrops ?? true);
    setNewBacklinks(n.newBacklinks ?? true);
    setGscSync(n.gscSync ?? true);
    setReportGenerated(n.reportGenerated ?? true);
    setNotificationEmail(s.notificationEmail ?? "");
  }, [project]);

  async function patchProject(body: Record<string, unknown>, setSave: (s: SaveState) => void) {
    setSave("saving");
    try {
      const token = await getToken();
      await apiClient(`/settings/projects/${projectId}`, {
        method: "PATCH",
        token: token ?? undefined,
        body: JSON.stringify(body),
      });
      await queryClient.invalidateQueries({ queryKey: ["settings-project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setSave("saved");
    } catch {
      setSave("error");
    }
  }

  const domainError =
    domain.startsWith("http")
      ? "Remove the https:// prefix"
      : domain.endsWith("/")
      ? "Remove the trailing slash"
      : null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-6 space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-56" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!project) {
    return <p className="text-sm text-muted-foreground">Project not found.</p>;
  }

  const notifyItems = [
    { id: "critical", label: "Critical audit issues found", val: criticalIssues, set: setCriticalIssues },
    { id: "rank", label: "Keyword ranking drops (more than 5 positions)", val: rankDrops, set: setRankDrops },
    { id: "backlinks", label: "New backlinks detected", val: newBacklinks, set: setNewBacklinks },
    { id: "gsc", label: "GSC data synced", val: gscSync, set: setGscSync },
    { id: "report", label: "Report generated", val: reportGenerated, set: setReportGenerated },
  ];

  return (
    <div className="space-y-6">
      {/* Section 1: General */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Basic information about this project.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="proj-name">Project Name</Label>
              <Input
                id="proj-name"
                value={name}
                onChange={(e) => { setName(e.target.value); setGeneralSave("idle"); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-domain">Domain</Label>
              <Input
                id="proj-domain"
                value={domain}
                onChange={(e) => { setDomain(e.target.value); setGeneralSave("idle"); }}
                placeholder="example.com"
              />
              {domainError && (
                <p className="text-xs text-destructive">{domainError}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Primary Country</Label>
              <Select value={countryCode} onValueChange={(v) => { setCountryCode(v); setGeneralSave("idle"); }}>
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
              <Label>Primary Language</Label>
              <Select value={languageCode} onValueChange={(v) => { setLanguageCode(v); setGeneralSave("idle"); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="pt">Portuguese</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                  <SelectItem value="zh">Chinese</SelectItem>
                  <SelectItem value="ja">Japanese</SelectItem>
                  <SelectItem value="ko">Korean</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <SaveButton
              state={generalSave}
              onClick={() =>
                patchProject({ name, domain, countryCode, languageCode }, setGeneralSave)
              }
              disabled={!!domainError}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Crawl Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Crawl Settings</CardTitle>
          <CardDescription>Configure how VisibilityOS crawls your site.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="max-pages">Max Pages to Crawl</Label>
              <Input
                id="max-pages"
                type="number"
                min={1}
                max={9999}
                value={maxPages}
                onChange={(e) => { setMaxPages(parseInt(e.target.value, 10) || 500); setCrawlSave("idle"); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Crawl Frequency</Label>
              <Select value={crawlFrequency} onValueChange={(v) => { setCrawlFrequency(v); setCrawlSave("idle"); }}>
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
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>User Agent</Label>
              <Select value={userAgent} onValueChange={(v) => { setUserAgent(v); setCrawlSave("idle"); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visibilityos">VisibilityOS Bot</SelectItem>
                  <SelectItem value="googlebot">Googlebot</SelectItem>
                  <SelectItem value="default">Default</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                id="respect-robots"
                checked={respectRobots}
                onCheckedChange={(v) => { setRespectRobots(v); setCrawlSave("idle"); }}
              />
              <Label htmlFor="respect-robots" className="cursor-pointer font-normal">
                Respect robots.txt
              </Label>
            </div>
          </div>
          <div className="flex justify-end">
            <SaveButton
              state={crawlSave}
              onClick={() =>
                patchProject(
                  { settings: { maxPagesToCrawl: maxPages, crawlFrequency, userAgent, respectRobots } },
                  setCrawlSave
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Control when you get notified about this project.</CardDescription>
            </div>
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={(v) => { setNotificationsEnabled(v); setNotifSave("idle"); }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {notifyItems.map(({ id, label, val, set }) => (
              <label key={id} className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={val}
                  onCheckedChange={(checked) => { set(!!checked); setNotifSave("idle"); }}
                  disabled={!notificationsEnabled}
                />
                <span className={`text-sm ${!notificationsEnabled ? "text-muted-foreground" : ""}`}>
                  {label}
                </span>
              </label>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notif-email">Notification Email</Label>
            <Input
              id="notif-email"
              type="email"
              value={notificationEmail}
              onChange={(e) => { setNotificationEmail(e.target.value); setNotifSave("idle"); }}
              placeholder="you@example.com"
            />
          </div>
          <div className="flex justify-end">
            <SaveButton
              state={notifSave}
              onClick={() =>
                patchProject(
                  {
                    settings: {
                      notificationsEnabled,
                      notifyOn: { criticalIssues, rankDrops, newBacklinks, gscSync, reportGenerated },
                      notificationEmail,
                    },
                  },
                  setNotifSave
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Danger Zone */}
      <DangerZone projectId={projectId} projectName={project.name} />
    </div>
  );
}
