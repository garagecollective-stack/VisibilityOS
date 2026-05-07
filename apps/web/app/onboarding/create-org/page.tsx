"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganizationList, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function CreateOrgPage() {
  const router = useRouter();
  const { createOrganization, setActive } = useOrganizationList();
  const { user } = useUser();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !createOrganization || !setActive) return;
    setLoading(true);
    setError("");

    try {
      const org = await createOrganization({ name: name.trim() });
      await setActive({ organization: org.id });
      router.push("/onboarding/add-project");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
        <span className="font-medium text-foreground">Create your workspace</span>
        <span className="text-muted-foreground">›</span>
        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">2</span>
        <span>Add your first project</span>
        <span className="text-muted-foreground">›</span>
        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">3</span>
        <span>Choose a plan</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create your workspace</CardTitle>
          <CardDescription>
            Your workspace is your agency or company name. Team members you invite will share
            the same projects and data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workspace name</Label>
              <Input
                id="name"
                placeholder="e.g. Acme Digital Agency"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                autoFocus
                maxLength={60}
              />
              {name && (
                <p className="text-xs text-muted-foreground">
                  URL: app.garageseo.ai/<strong>{slugify(name) || "your-workspace"}</strong>
                </p>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
              {loading ? "Creating…" : "Create workspace →"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Hi {user?.firstName ?? "there"}! You can always rename your workspace later in Settings.
      </p>
    </div>
  );
}
