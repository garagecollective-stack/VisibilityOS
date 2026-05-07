"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const COUNTRIES = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "UAE" },
  { code: "DE", name: "Germany" },
];

function normalizeDomain(input: string): string {
  return input
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .toLowerCase()
    .trim();
}

export default function AddProjectPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [domain, setDomain] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("IN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const cleanDomain = normalizeDomain(domain);

    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          domain: cleanDomain,
          name: name || cleanDomain,
          countryCode: country,
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to create project");
      }

      router.push("/onboarding/choose-plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">✓</span>
        <span className="text-muted-foreground line-through">Create your workspace</span>
        <span>›</span>
        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
        <span className="font-medium text-foreground">Add your first project</span>
        <span>›</span>
        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">3</span>
        <span>Choose a plan</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add your first website</CardTitle>
          <CardDescription>
            Enter the domain you want to track. You can add more projects after setup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Website domain</Label>
              <Input
                id="domain"
                placeholder="yourwebsite.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={loading}
                autoFocus
              />
              {domain && (
                <p className="text-xs text-muted-foreground">
                  Tracking: <strong>{normalizeDomain(domain)}</strong>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Project name (optional)</Label>
              <Input
                id="name"
                placeholder={normalizeDomain(domain) || "My Website"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Primary target country</Label>
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/onboarding/choose-plan")}
                disabled={loading}
                className="flex-1"
              >
                Skip for now
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading || !domain.trim()}
              >
                {loading ? "Adding…" : "Add project →"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
