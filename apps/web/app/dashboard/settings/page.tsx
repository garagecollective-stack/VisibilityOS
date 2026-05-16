"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectSettingsTab } from "@/components/settings/project-settings-tab";
import { OrgSettingsTab } from "@/components/settings/org-settings-tab";
import { NotificationsTab } from "@/components/settings/notifications-tab";
import { apiClient } from "@/lib/api";

interface Project {
  id: string;
  name: string;
  domain: string;
}

export default function SettingsPage() {
  const { getToken } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const token = await getToken();
      return apiClient<{ projects: Project[] }>("/projects", { token: token ?? undefined });
    },
  });

  const projects = projectsQuery.data?.projects ?? [];

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0]!.id);
    }
  }, [projects, selectedProjectId]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure your project and workspace preferences.
          </p>
        </div>
      </div>

      <Tabs defaultValue="project">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="project">Project</TabsTrigger>
            <TabsTrigger value="organization">Organization</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          {/* Project selector — only shown on the Project tab */}
          <div className="flex items-center gap-2">
            {projectsQuery.isLoading ? (
              <Skeleton className="h-9 w-56" />
            ) : projects.length > 0 ? (
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>

        {/* Tab 1 — Project Settings */}
        <TabsContent value="project" className="mt-6">
          {projectsQuery.isLoading ? (
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
          ) : !selectedProjectId ? (
            <div className="rounded-xl border bg-muted/30 p-12 text-center">
              <p className="text-sm text-muted-foreground">
                No projects yet. Create a project to configure its settings.
              </p>
            </div>
          ) : (
            <ProjectSettingsTab projectId={selectedProjectId} />
          )}
        </TabsContent>

        {/* Tab 2 — Organization Settings */}
        <TabsContent value="organization" className="mt-6">
          <OrgSettingsTab />
        </TabsContent>

        {/* Tab 3 — Global Notifications */}
        <TabsContent value="notifications" className="mt-6">
          <NotificationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
