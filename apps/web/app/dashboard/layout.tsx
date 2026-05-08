import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import Link from "next/link";
import { Settings } from "lucide-react";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 border-r bg-card flex flex-col shrink-0">
        {/* Brand */}
        <div className="px-4 h-14 border-b flex items-center">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground font-bold text-xs">V</span>
            </div>
            <span className="font-semibold text-sm">VisibilityOS</span>
          </Link>
        </div>

        {/* Org switcher */}
        <div className="px-3 py-3 border-b">
          <OrganizationSwitcher
            hidePersonal
            afterCreateOrganizationUrl="/dashboard"
            afterSelectOrganizationUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "w-full",
                organizationSwitcherTrigger:
                  "w-full justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition-colors",
              },
            }}
          />
        </div>

        {/* Nav */}
        <SidebarNav />

        {/* Bottom */}
        <div className="p-3 border-t space-y-0.5">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Settings className="w-4 h-4 shrink-0" />
            Settings
          </Link>
          <div className="flex items-center gap-3 px-3 py-2">
            <UserButton afterSignOutUrl="/sign-in" />
            <span className="text-sm text-muted-foreground">Account</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
