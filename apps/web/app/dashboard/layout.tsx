import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import Link from "next/link";
import { Settings, UserCircle } from "lucide-react";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col shrink-0 bg-[#0F172A] border-r border-white/[0.06]">

        {/* Brand */}
        <div className="px-4 h-14 flex items-center border-b border-white/[0.06] shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">V</span>
            </div>
            <span className="font-bold text-sm tracking-tight text-white">VisibilityOS</span>
          </Link>
        </div>

        {/* Org switcher */}
        <div className="px-3 py-3 border-b border-white/[0.06] shrink-0">
          <OrganizationSwitcher
            hidePersonal
            afterCreateOrganizationUrl="/dashboard"
            afterSelectOrganizationUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "w-full",
                organizationSwitcherTrigger:
                  "w-full justify-between rounded-md px-3 py-2 text-sm text-[#94A3B8] hover:text-white hover:bg-[#1E293B] border border-white/[0.1] transition-colors bg-transparent",
                organizationSwitcherTriggerIcon: "text-[#94A3B8]",
                organizationPreviewMainIdentifier: "!text-white text-sm font-medium",
                organizationPreviewSecondaryIdentifier: "!text-[#94A3B8] text-xs",
                organizationPreviewAvatarBox: "w-5 h-5",
              },
            }}
          />
        </div>

        {/* Nav */}
        <SidebarNav />

        {/* Bottom */}
        <div className="shrink-0 p-3 space-y-0.5 border-t border-white/[0.06]">
          <Link
            href="/dashboard/account"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors"
          >
            <UserCircle className="w-4 h-4 shrink-0" />
            Account
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors"
          >
            <Settings className="w-4 h-4 shrink-0" />
            Settings
          </Link>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1E293B] transition-colors cursor-pointer">
            <UserButton
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: {
                  avatarBox: "w-6 h-6",
                },
              }}
            />
            <span className="text-sm text-[#94A3B8]">Your account</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
