"use client";

import { useEffect, useState } from "react";
import { BarChart2, FileText, Shield, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ReportType = "full_seo" | "keyword_report" | "audit_report" | "custom";

interface Project {
  id: string;
  name: string;
  domain: string;
  gscConnected?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  defaultProjectId?: string;
  onGenerated: (reportId: string) => void;
  generateFn: (payload: {
    projectId: string;
    title: string;
    type: ReportType;
    sections: string[];
    dateRange: string;
  }) => Promise<{ reportId: string }>;
}

const REPORT_TYPES = [
  {
    id: "audit_report" as ReportType,
    label: "Site Audit Report",
    icon: Shield,
    description: "Technical SEO issues, health score, crawled pages analysis",
    includes: ["Health Score", "Issues list", "CWV scores", "AI Search visibility"],
    requires: "A completed site audit",
    color: "#FF8C00",
  },
  {
    id: "keyword_report" as ReportType,
    label: "Keyword Performance",
    icon: TrendingUp,
    description: "Keyword rankings, visibility score, position changes",
    includes: ["Tracked keywords", "Positions", "Top movers"],
    requires: "Tracked keywords",
    color: "#00C48C",
  },
  {
    id: "custom" as ReportType,
    label: "GSC Performance",
    icon: BarChart2,
    description: "Real clicks, impressions, CTR from Google Search Console",
    includes: ["Top queries", "Top pages", "Clicks/impressions", "Position data"],
    requires: "GSC connected",
    color: "#4285F4",
  },
  {
    id: "full_seo" as ReportType,
    label: "Full SEO Report",
    icon: Star,
    description: "Complete SEO overview combining all available data",
    includes: ["Everything above combined"],
    requires: "At least one audit",
    color: "#F59E0B",
    popular: true,
  },
] as const;

const ALL_SECTIONS = [
  { id: "executive_summary", label: "Executive Summary" },
  { id: "site_health", label: "Site Health Score" },
  { id: "technical_issues", label: "Technical Issues" },
  { id: "cwv", label: "Core Web Vitals" },
  { id: "keywords", label: "Keyword Rankings" },
  { id: "gsc", label: "GSC Performance" },
  { id: "ai_search", label: "AI Search Visibility" },
  { id: "recommendations", label: "Recommendations" },
] as const;

const DEFAULT_SECTIONS_BY_TYPE: Record<ReportType, string[]> = {
  audit_report: ["executive_summary", "site_health", "technical_issues", "cwv", "ai_search", "recommendations"],
  keyword_report: ["executive_summary", "keywords", "recommendations"],
  custom: ["executive_summary", "gsc", "recommendations"],
  full_seo: ALL_SECTIONS.map((s) => s.id),
};

function buildTitle(projectName: string): string {
  const d = new Date();
  const month = d.toLocaleString("default", { month: "long" });
  return `${projectName} SEO Report — ${month} ${d.getFullYear()}`;
}

export function GenerateReportDialog({ open, onClose, projects, defaultProjectId, onGenerated, generateFn }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [type, setType] = useState<ReportType>("full_seo");
  const [title, setTitle] = useState("");
  const [dateRange, setDateRange] = useState("30d");
  const [sections, setSections] = useState<string[]>(DEFAULT_SECTIONS_BY_TYPE["full_seo"]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const selectedProject = projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (open) {
      setStep(1);
      setType("full_seo");
      setDateRange("30d");
      setSections(DEFAULT_SECTIONS_BY_TYPE["full_seo"]);
      setGenerating(false);
      setError("");
      const proj = projects.find((p) => p.id === (defaultProjectId ?? projects[0]?.id));
      setTitle(buildTitle(proj?.name ?? "Project"));
      setProjectId(defaultProjectId ?? projects[0]?.id ?? "");
    }
  }, [open, defaultProjectId, projects]);

  function selectType(t: ReportType) {
    setType(t);
    setSections(DEFAULT_SECTIONS_BY_TYPE[t]);
  }

  function toggleSection(id: string) {
    setSections((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function handleGenerate() {
    if (!projectId) return;
    setGenerating(true);
    setError("");
    try {
      const result = await generateFn({ projectId, title, type, sections, dateRange });
      onGenerated(result.reportId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report.");
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !generating) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "Choose Report Type"}
            {step === 2 && "Configure Report"}
            {step === 3 && "Review & Generate"}
          </DialogTitle>
          <div className="flex gap-1 pt-1">
            {([1, 2, 3] as const).map((s) => (
              <div
                key={s}
                className={cn("h-1 flex-1 rounded-full transition-colors", step >= s ? "bg-primary" : "bg-muted")}
              />
            ))}
          </div>
        </DialogHeader>

        {/* ── Step 1: Type selection ── */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3 py-2">
            {REPORT_TYPES.map((rt) => {
              const Icon = rt.icon;
              const selected = type === rt.id;
              return (
                <button
                  key={rt.id}
                  onClick={() => selectType(rt.id)}
                  className={cn(
                    "relative text-left rounded-lg border-2 p-4 transition-all",
                    selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  )}
                >
                  {"popular" in rt && rt.popular && (
                    <span className="absolute right-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Most Popular
                    </span>
                  )}
                  <div
                    className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${rt.color}18` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: rt.color }} />
                  </div>
                  <p className="text-sm font-semibold">{rt.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{rt.description}</p>
                  <ul className="mt-2 space-y-0.5">
                    {rt.includes.map((item) => (
                      <li key={item} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="text-green-500">✓</span> {item}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[10px] text-muted-foreground">Requires: {rt.requires}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Step 2: Configure ── */}
        {step === 2 && (
          <div className="space-y-5 py-2">
            {projects.length > 1 && (
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={projectId} onValueChange={(v) => {
                  setProjectId(v);
                  const p = projects.find((pr) => pr.id === v);
                  setTitle(buildTitle(p?.name ?? "Project"));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {p.domain}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Report title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="SEO Report — June 2025" />
            </div>

            <div className="space-y-2">
              <Label>Date range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="180d">Last 6 months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Include sections</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_SECTIONS.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <Checkbox
                      id={s.id}
                      checked={sections.includes(s.id)}
                      onCheckedChange={() => toggleSection(s.id)}
                    />
                    <label htmlFor={s.id} className="text-sm cursor-pointer">{s.label}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Review + Generate ── */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/40 p-4 space-y-2">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">
                Project: {selectedProject?.name} ({selectedProject?.domain})
              </p>
              <p className="text-xs text-muted-foreground">
                Type: {REPORT_TYPES.find((r) => r.id === type)?.label} · {dateRange === "30d" ? "Last 30 days" : dateRange === "90d" ? "Last 90 days" : "Last 6 months"}
              </p>
              <p className="text-xs text-muted-foreground">
                Sections: {sections.map((s) => ALL_SECTIONS.find((a) => a.id === s)?.label).filter(Boolean).join(", ")}
              </p>
            </div>

            {generating ? (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground text-center">Generating your report...</div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "70%" }} />
                </div>
                <p className="text-xs text-muted-foreground text-center">This takes 10–30 seconds</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Claude AI will generate an executive summary based on your data.
                  The report will be available immediately after generation.
                </p>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && !generating && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>Back</Button>
          )}
          {step < 3 && (
            <Button
              onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              disabled={step === 2 && (sections.length === 0 || !title.trim())}
            >
              Next
            </Button>
          )}
          {step === 3 && (
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? "Generating..." : "Generate Report"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
