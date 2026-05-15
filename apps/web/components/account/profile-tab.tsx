"use client";

import { useEffect, useState } from "react";
import { useUser, useOrganization, useClerk } from "@clerk/nextjs";
import { UserCircle } from "lucide-react";
import { SaveButton } from "@/components/account/save-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

type SaveState = "idle" | "saving" | "saved" | "error";

function roleLabelFromClerk(role: string | undefined): string {
  if (!role) return "Member";
  // Clerk roles look like "org:admin", "org:member", etc.
  const part = role.split(":").pop() ?? role;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export function ProfileTab() {
  const { user, isLoaded } = useUser();
  const { membership } = useOrganization();
  const { openUserProfile } = useClerk();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? "");
      setLastName(user.lastName ?? "");
    }
  }, [user]);

  // Auto-reset "saved" state after 2 s
  useEffect(() => {
    if (saveState === "saved") {
      const t = setTimeout(() => setSaveState("idle"), 2000);
      return () => clearTimeout(t);
    }
  }, [saveState]);

  async function handleSave() {
    if (!user) return;
    setSaveState("saving");
    try {
      await user.update({ firstName, lastName });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  const isDirty =
    firstName !== (user?.firstName ?? "") || lastName !== (user?.lastName ?? "");

  if (!isLoaded) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-56 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const email = user?.emailAddresses[0]?.emailAddress ?? "";
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Manage your personal information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          {user?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.imageUrl}
              alt={user.fullName ?? "Profile photo"}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <UserCircle className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="font-medium">{user?.fullName ?? "—"}</p>
            <button
              type="button"
              onClick={() => openUserProfile()}
              className="text-sm text-primary hover:underline mt-0.5"
            >
              Change photo
            </button>
          </div>
        </div>

        <Separator />

        {/* Name fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="first-name">First Name</Label>
            <Input
              id="first-name"
              value={firstName}
              onChange={(e) => { setFirstName(e.target.value); setSaveState("idle"); }}
              placeholder="First name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last-name">Last Name</Label>
            <Input
              id="last-name"
              value={lastName}
              onChange={(e) => { setLastName(e.target.value); setSaveState("idle"); }}
              placeholder="Last name"
            />
          </div>
        </div>

        {/* Email — read only */}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email Address</Label>
          <div className="relative">
            <Input
              id="email"
              value={email}
              readOnly
              className="bg-muted text-muted-foreground cursor-not-allowed pr-20"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              Via Clerk
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Email is managed by your sign-in provider and cannot be changed here.
          </p>
        </div>

        <Separator />

        {/* Read-only meta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <div className="flex items-center h-10">
              <Badge variant="outline" className="capitalize">
                {roleLabelFromClerk(membership?.role)}
              </Badge>
            </div>
          </div>
          {memberSince && (
            <div className="space-y-1.5">
              <Label>Member Since</Label>
              <div className="flex items-center h-10 text-sm text-muted-foreground">
                {memberSince}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <SaveButton
            state={saveState}
            onClick={handleSave}
            disabled={!isDirty}
          />
        </div>
      </CardContent>
    </Card>
  );
}
