"use client";

import { useOrganization, useClerk } from "@clerk/nextjs";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function roleLabel(role: string | undefined): string {
  if (!role) return "Member";
  const part = role.split(":").pop() ?? role;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TeamMembersSection() {
  const { organization, memberships, isLoaded } = useOrganization({
    memberships: { infinite: true },
  });
  const { openOrganizationProfile } = useClerk();

  const memberList = memberships?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              {isLoaded ? `${organization?.membersCount ?? 0} member${(organization?.membersCount ?? 0) !== 1 ? "s" : ""} in this organization` : "Loading members…"}
            </CardDescription>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => openOrganizationProfile({ afterLeaveOrganizationUrl: "/dashboard" })}
          >
            <Users className="h-4 w-4" />
            Invite Member
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!isLoaded ? (
          <div className="divide-y">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : memberList.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No members found.
          </div>
        ) : (
          <div className="divide-y">
            {memberList.map((m) => {
              const name =
                [m.publicUserData?.firstName, m.publicUserData?.lastName]
                  .filter(Boolean)
                  .join(" ") || m.publicUserData?.identifier;
              return (
                <div key={m.id} className="flex items-center gap-3 px-6 py-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={m.publicUserData?.imageUrl} />
                    <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{name || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.publicUserData?.identifier}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {roleLabel(m.role)}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
