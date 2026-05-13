"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const ALL_INTENTS = [
  "Informational",
  "Commercial",
  "Transactional",
  "Navigational",
] as const;

export type Intent = (typeof ALL_INTENTS)[number];

export type WordCount = "any" | "2" | "3" | "4plus";

export interface IdeasFilters {
  volMin: number | null;
  volMax: number | null;
  kdMin: number | null;
  kdMax: number | null;
  cpcMin: number | null;
  cpcMax: number | null;
  intents: Intent[];
  include: string[];
  exclude: string[];
  wordCount: WordCount;
}

export const DEFAULT_FILTERS: IdeasFilters = {
  volMin: null,
  volMax: null,
  kdMin: null,
  kdMax: null,
  cpcMin: null,
  cpcMax: null,
  intents: [...ALL_INTENTS],
  include: [],
  exclude: [],
  wordCount: "any",
};

export function countActiveFilters(filters: IdeasFilters): number {
  let n = 0;
  if (filters.volMin != null || filters.volMax != null) n++;
  if (filters.kdMin != null || filters.kdMax != null) n++;
  if (filters.cpcMin != null || filters.cpcMax != null) n++;
  if (filters.intents.length < ALL_INTENTS.length) n++;
  if (filters.include.length > 0) n++;
  if (filters.exclude.length > 0) n++;
  if (filters.wordCount !== "any") n++;
  return n;
}

function splitTerms(text: string): string[] {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function joinTerms(terms: string[]): string {
  return terms.join(", ");
}

interface Props {
  filters: IdeasFilters;
  onApply: (filters: IdeasFilters) => void;
  onReset: () => void;
}

export function IdeasFilterPanel({ filters, onApply, onReset }: Props) {
  const [draft, setDraft] = useState<IdeasFilters>(filters);
  const [includeText, setIncludeText] = useState<string>(joinTerms(filters.include));
  const [excludeText, setExcludeText] = useState<string>(joinTerms(filters.exclude));

  const parseNum = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  };

  const setNum = (key: keyof IdeasFilters) => (value: string) => {
    setDraft((d) => ({ ...d, [key]: parseNum(value) }));
  };

  const toggleIntent = (intent: Intent, checked: boolean) => {
    setDraft((d) => ({
      ...d,
      intents: checked ? Array.from(new Set([...d.intents, intent])) : d.intents.filter((i) => i !== intent),
    }));
  };

  const handleApply = () => {
    onApply({
      ...draft,
      include: splitTerms(includeText),
      exclude: splitTerms(excludeText),
    });
  };

  const handleReset = () => {
    setDraft(DEFAULT_FILTERS);
    setIncludeText("");
    setExcludeText("");
    onReset();
  };

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RangeField
            label="Volume range"
            minPlaceholder="0"
            maxPlaceholder="Any"
            minValue={draft.volMin}
            maxValue={draft.volMax}
            onMin={setNum("volMin")}
            onMax={setNum("volMax")}
          />
          <RangeField
            label="KD range"
            minPlaceholder="0"
            maxPlaceholder="100"
            minValue={draft.kdMin}
            maxValue={draft.kdMax}
            onMin={setNum("kdMin")}
            onMax={setNum("kdMax")}
          />
          <RangeField
            label="CPC range ($)"
            minPlaceholder="0"
            maxPlaceholder="Any"
            minValue={draft.cpcMin}
            maxValue={draft.cpcMax}
            onMin={setNum("cpcMin")}
            onMax={setNum("cpcMax")}
            step="0.01"
          />
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Word Count
            </Label>
            <Select
              value={draft.wordCount}
              onValueChange={(v) => setDraft((d) => ({ ...d, wordCount: v as WordCount }))}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any length</SelectItem>
                <SelectItem value="2">2 words</SelectItem>
                <SelectItem value="3">3 words</SelectItem>
                <SelectItem value="4plus">4+ words</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Intent
          </Label>
          <div className="flex flex-wrap gap-2">
            {ALL_INTENTS.map((intent) => {
              const checked = draft.intents.includes(intent);
              return (
                <label
                  key={intent}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors",
                    checked
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary"
                    checked={checked}
                    onChange={(e) => toggleIntent(intent, e.target.checked)}
                  />
                  <span className="font-medium">{intent}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="include">Include keywords</Label>
            <Input
              id="include"
              placeholder="must contain these words"
              value={includeText}
              onChange={(e) => setIncludeText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Comma separated</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="exclude">Exclude keywords</Label>
            <Input
              id="exclude"
              placeholder="exclude these words"
              value={excludeText}
              onChange={(e) => setExcludeText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Comma separated</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t pt-4">
          <Button variant="link" size="sm" onClick={handleReset} className="text-muted-foreground">
            Reset
          </Button>
          <Button onClick={handleApply}>Apply Filters</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RangeField({
  label,
  minPlaceholder,
  maxPlaceholder,
  minValue,
  maxValue,
  onMin,
  onMax,
  step,
}: {
  label: string;
  minPlaceholder: string;
  maxPlaceholder: string;
  minValue: number | null;
  maxValue: number | null;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
  step?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          step={step ?? "1"}
          placeholder={minPlaceholder}
          value={minValue ?? ""}
          onChange={(e) => onMin(e.target.value)}
          className="h-9"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="number"
          inputMode="decimal"
          step={step ?? "1"}
          placeholder={maxPlaceholder}
          value={maxValue ?? ""}
          onChange={(e) => onMax(e.target.value)}
          className="h-9"
        />
      </div>
    </div>
  );
}
