"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Loader2,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { CompetitorCard, CompetitorCardSkeleton } from "@/components/competitors/competitor-card";
import { CompetitorSelector } from "@/components/competitors/competitor-selector";
import { DiscoverCompetitorsDialog } from "@/components/competitors/discover-competitors-dialog";
import { KeywordGapTable } from "@/components/competitors/keyword-gap-table";
import { CommonKeywordsTable } from "@/components/competitors/common-keywords-table";
import { TopPagesTable } from "@/components/competitors/top-pages-table";
import { BacklinkComparison } from "@/components/competitors/backlink-comparison";
import { DashboardProjectSelector } from "@/components/dashboard/project-selector";
import { EmptyState } from "@/components/shared/empty-state";
import { SampleDataBadge } from "@/components/shared/sample-data-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  domain: string;
  countryCode: string;
}

interface Competitor {
  id: string;
  domain: string;
  organicKeywords: number | null;
  organicTraffic: number | null;
  domainRank: number | null;
  commonKeywords: number | null;
  lastFetchedAt: string | null;
  projectId: string;
  orgId: string;
}

interface SuggestedCompetitor {
  domain: string;
  sharedKeywords: number;
  traffic: number;
  avgPosition: number;
}

interface GapKeyword {
  keyword: string;
  competitorPosition: number;
  volume: number;
  kd: number | null;
  cpc: number;
  intent: string;
}

interface CommonKeyword {
  keyword: string;
  yourPosition: number;
  competitorPosition: number;
  volume: number;
  kd: number | null;
  winner: "you" | "competitor" | "tie";
}

interface TopPage {
  url: string;
  traffic: number;
  keywords: number;
  topKeyword: string;
  topPosition: number;
}

interface BacklinkData {
  domain: string;
  referringDomains: number;
  totalBacklinks: number;
  domainRank: number;
  newBacklinks: number;
  lostBacklinks: number;
}

type AnalysisTab = "gap" | "common" | "top-pages";

// ─── Sub-tab bar ──────────────────────────────────────────────────────────────

function AnalysisTabs({
  active,
  onChange,
}: {
  active: AnalysisTab;
  onChange: (t: AnalysisTab) => void;
}) {
  const tabs: { id: AnalysisTab; label: string }[] = [
    { id: "gap", label: "Keyword Gap" },
    { id: "common", label: "Common Keywords" },
    { id: "top-pages", label: "Top Pages" },
  ];
  return (
    <div className="flex items-center gap-1 border-b">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
            active === t.id
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Add manually dialog ──────────────────────────────────────────────────────

function AddManuallyDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (domain: string) => Promise<void>;
}) {
  const [domain, setDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!clean) { setError("Enter a domain."); return; }
    setError("");
    setAdding(true);
    try {
      await onAdd(clean);
      setDomain("");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add competitor");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Competitor</DialogTitle>
          <DialogDescription>Enter a competitor domain to track.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="domain-input">Domain</Label>
            <Input
              id="domain-input"
              placeholder="competitor.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
          <Button className="w-full" onClick={handleAdd} disabled={adding || !domain.trim()}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Competitor"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
  isMock,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  isMock?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {title}
            {isMock && <SampleDataBadge />}
          </h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CompetitorsPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedCompetitorDomain, setSelectedCompetitorDomain] = useState("");
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>("gap");
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [addManuallyOpen, setAddManuallyOpen] = useState(false);
  const [discoverTriggered, setDiscoverTriggered] = useState(false);

  const initializedRef = useRef(false);

  // ── Projects ────────────────────────────────────────────────────────────────

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ projects: Project[] }>("/projects", { token: token ?? undefined });
    },
  });

  const projectList = projectsQuery.data?.projects ?? [];
  const selectedProject = projectList.find((p) => p.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (initializedRef.current || projectList.length === 0) return;
    initializedRef.current = true;
    setSelectedProjectId(projectList[0].id);
  }, [projectList]);

  // ── Competitors ──────────────────────────────────────────────────────────────

  const competitorsQuery = useQuery({
    queryKey: ["competitors", selectedProjectId],
    enabled: !!selectedProjectId,
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ competitors: Competitor[] }>(
        `/competitors/projects/${selectedProjectId}`,
        { token: token ?? undefined }
      );
    },
  });

  const competitorList = competitorsQuery.data?.competitors ?? [];

  useEffect(() => {
    if (competitorList.length > 0 && !selectedCompetitorDomain) {
      setSelectedCompetitorDomain(competitorList[0].domain);
    }
  }, [competitorList, selectedCompetitorDomain]);

  // ── Discover ─────────────────────────────────────────────────────────────────

  const discoverQuery = useQuery({
    queryKey: ["discover", selectedProjectId, selectedProject?.domain],
    enabled: discoverTriggered && !!selectedProjectId && !!selectedProject,
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ competitors: SuggestedCompetitor[]; isMock: boolean }>(
        `/competitors/projects/${selectedProjectId}/discover`,
        {
          method: "POST",
          token: token ?? undefined,
          body: JSON.stringify({ yourDomain: selectedProject!.domain }),
        }
      );
    },
  });

  function openDiscover() {
    setDiscoverTriggered(true);
    setDiscoverOpen(true);
  }

  // ── Add competitor ────────────────────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: async (domain: string) => {
      const token = await getToken();
      return apiClient<{ competitor: Competitor }>(
        `/competitors/projects/${selectedProjectId}/add`,
        {
          method: "POST",
          token: token ?? undefined,
          body: JSON.stringify({ domain }),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors", selectedProjectId] });
    },
  });

  async function handleAddSingle(domain: string) {
    await addMutation.mutateAsync(domain);
  }

  async function handleAddMany(domains: string[]) {
    for (const d of domains) {
      await addMutation.mutateAsync(d);
    }
  }

  // ── Remove competitor ─────────────────────────────────────────────────────────

  const removeMutation = useMutation({
    mutationFn: async (competitorId: string) => {
      const token = await getToken();
      return apiClient<{ ok: boolean }>(
        `/competitors/projects/${selectedProjectId}/${competitorId}`,
        { method: "DELETE", token: token ?? undefined }
      );
    },
    onSuccess: (_, competitorId) => {
      queryClient.invalidateQueries({ queryKey: ["competitors", selectedProjectId] });
      const removed = competitorList.find((c) => c.id === competitorId);
      if (removed?.domain === selectedCompetitorDomain) {
        const remaining = competitorList.filter((c) => c.id !== competitorId);
        setSelectedCompetitorDomain(remaining[0]?.domain ?? "");
      }
    },
  });

  // ── Analysis data ─────────────────────────────────────────────────────────────

  const gapQuery = useQuery({
    queryKey: ["gap", selectedProjectId, selectedCompetitorDomain],
    enabled: !!selectedProjectId && !!selectedCompetitorDomain && analysisTab === "gap",
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ keywords: GapKeyword[]; isMock: boolean }>(
        `/competitors/projects/${selectedProjectId}/gap?competitorDomain=${encodeURIComponent(selectedCompetitorDomain)}`,
        { token: token ?? undefined }
      );
    },
  });

  const commonQuery = useQuery({
    queryKey: ["common", selectedProjectId, selectedCompetitorDomain],
    enabled: !!selectedProjectId && !!selectedCompetitorDomain && analysisTab === "common",
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ keywords: CommonKeyword[]; isMock: boolean }>(
        `/competitors/projects/${selectedProjectId}/common?competitorDomain=${encodeURIComponent(selectedCompetitorDomain)}`,
        { token: token ?? undefined }
      );
    },
  });

  const topPagesQuery = useQuery({
    queryKey: ["top-pages", selectedCompetitorDomain],
    enabled: !!selectedProjectId && !!selectedCompetitorDomain && analysisTab === "top-pages",
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ pages: TopPage[]; isMock: boolean }>(
        `/competitors/projects/${selectedProjectId}/top-pages?competitorDomain=${encodeURIComponent(selectedCompetitorDomain)}`,
        { token: token ?? undefined }
      );
    },
  });

  const backlinksQuery = useQuery({
    queryKey: ["competitor-backlinks", selectedProjectId, selectedCompetitorDomain],
    enabled: !!selectedProjectId && !!selectedCompetitorDomain,
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ you: BacklinkData | null; competitor: BacklinkData | null; isMock: boolean }>(
        `/competitors/projects/${selectedProjectId}/backlinks?competitorDomain=${encodeURIComponent(selectedCompetitorDomain)}`,
        { token: token ?? undefined }
      );
    },
  });

  // ── Your domain card data ─────────────────────────────────────────────────────

  const yourCard: Competitor | null = selectedProject
    ? {
        id: "you",
        domain: selectedProject.domain,
        organicKeywords: null,
        organicTraffic: null,
        domainRank: backlinksQuery.data?.you?.domainRank ?? null,
        commonKeywords: null,
        lastFetchedAt: null,
        projectId: selectedProjectId,
        orgId: "",
      }
    : null;

  // ── Render ────────────────────────────────────────────────────────────────────

  if (projectsQuery.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Competitors</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Track, compare, and outrank your competition
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {projectList.length > 0 && (
            <DashboardProjectSelector
              projects={projectList}
              value={selectedProjectId}
              onValueChange={(id) => {
                setSelectedProjectId(id);
                setSelectedCompetitorDomain("");
              }}
            />
          )}
          {selectedProjectId && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={openDiscover}>
                <Sparkles className="h-4 w-4" />
                Discover
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => setAddManuallyOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Competitor
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── No project selected ────────────────────────────────────────────── */}
      {!selectedProjectId && (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Select a project to get started"
          description="Choose a project from the dropdown above to manage competitors."
        />
      )}

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {selectedProjectId && (
        <>
          {/* ── Section 1: Competitor Management / Overview Cards ─────────── */}
          {competitorsQuery.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <CompetitorCardSkeleton key={i} />
              ))}
            </div>
          ) : competitorList.length === 0 ? (
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title="No competitors added yet"
              description="Discover competitors automatically or add them manually."
              action={
                <div className="flex items-center gap-2">
                  <Button className="gap-1.5" onClick={openDiscover}>
                    <Sparkles className="h-4 w-4" />
                    Discover Competitors
                  </Button>
                  <Button variant="outline" onClick={() => setAddManuallyOpen(true)}>
                    Add Manually
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Your domain card */}
              {yourCard && (
                <CompetitorCard data={yourCard} isYou />
              )}
              {/* Competitor cards */}
              {competitorList.map((c) => (
                <CompetitorCard
                  key={c.id}
                  data={c}
                  onRemove={(id) => removeMutation.mutate(id)}
                />
              ))}
            </div>
          )}

          {/* ── Section 2–4: Analysis (only when competitors added) ───────── */}
          {competitorList.length > 0 && (
            <>
              {/* Competitor selector */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Analyzing competitor:</p>
                <CompetitorSelector
                  competitors={competitorList}
                  selected={selectedCompetitorDomain}
                  onSelect={setSelectedCompetitorDomain}
                />
              </div>

              {selectedCompetitorDomain && (
                <>
                  {/* Analysis tabs */}
                  <div className="space-y-6">
                    <AnalysisTabs active={analysisTab} onChange={setAnalysisTab} />

                    {/* ── Keyword Gap ─────────────────────────────────────── */}
                    {analysisTab === "gap" && (
                      <Section
                        title={`Keywords ${selectedCompetitorDomain} ranks for that you don't`}
                        subtitle="These are your biggest opportunities to close the gap"
                        isMock={gapQuery.data?.isMock}
                      >
                        <KeywordGapTable
                          keywords={gapQuery.data?.keywords ?? []}
                          loading={gapQuery.isLoading}
                          isMock={gapQuery.data?.isMock ?? false}
                          competitorDomain={selectedCompetitorDomain}
                        />
                      </Section>
                    )}

                    {/* ── Common Keywords ─────────────────────────────────── */}
                    {analysisTab === "common" && (
                      <Section
                        title={`Keywords both you and ${selectedCompetitorDomain} rank for`}
                        subtitle="See where you're ahead and where you're losing"
                        isMock={commonQuery.data?.isMock}
                      >
                        <CommonKeywordsTable
                          keywords={commonQuery.data?.keywords ?? []}
                          loading={commonQuery.isLoading}
                          isMock={commonQuery.data?.isMock ?? false}
                          competitorDomain={selectedCompetitorDomain}
                        />
                      </Section>
                    )}

                    {/* ── Top Pages ───────────────────────────────────────── */}
                    {analysisTab === "top-pages" && (
                      <Section
                        title={`${selectedCompetitorDomain}'s Top Performing Pages`}
                        subtitle="Pages driving the most organic traffic to their site"
                        isMock={topPagesQuery.data?.isMock}
                      >
                        <TopPagesTable
                          pages={topPagesQuery.data?.pages ?? []}
                          loading={topPagesQuery.isLoading}
                          isMock={topPagesQuery.data?.isMock ?? false}
                          competitorDomain={selectedCompetitorDomain}
                        />
                      </Section>
                    )}
                  </div>

                  {/* ── Backlink Comparison ─────────────────────────────────── */}
                  <Section
                    title="Backlink Profile Comparison"
                    isMock={backlinksQuery.data?.isMock}
                  >
                    <BacklinkComparison
                      you={backlinksQuery.data?.you ?? null}
                      competitor={backlinksQuery.data?.competitor ?? null}
                      loading={backlinksQuery.isLoading}
                      isMock={backlinksQuery.data?.isMock ?? false}
                    />
                  </Section>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      <DiscoverCompetitorsDialog
        open={discoverOpen}
        onOpenChange={setDiscoverOpen}
        yourDomain={selectedProject?.domain ?? ""}
        suggestions={discoverQuery.data?.competitors ?? []}
        loading={discoverQuery.isLoading}
        onAdd={handleAddMany}
        isMock={discoverQuery.data?.isMock}
      />

      <AddManuallyDialog
        open={addManuallyOpen}
        onOpenChange={setAddManuallyOpen}
        onAdd={handleAddSingle}
      />
    </div>
  );
}
