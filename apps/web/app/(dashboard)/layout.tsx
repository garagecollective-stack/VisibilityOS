import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/keywords", label: "Keywords" },
  { href: "/dashboard/rank-tracker", label: "Rank Tracker" },
  { href: "/dashboard/audit", label: "Site Audit" },
  { href: "/dashboard/backlinks", label: "Backlinks" },
  { href: "/dashboard/competitors", label: "Competitors" },
  { href: "/dashboard/geo-tracker", label: "GEO Tracker" },
  { href: "/dashboard/content", label: "Content" },
  { href: "/dashboard/reports", label: "Reports" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">V</span>
            </div>
            <span className="font-semibold text-sm">VisibilityOS</span>
          </Link>
        </div>

        <div className="p-4 border-b">
          <OrganizationSwitcher
            hidePersonal
            afterCreateOrganizationUrl="/dashboard"
            afterSelectOrganizationUrl="/dashboard"
          />
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-2"
          >
            Settings
          </Link>
          <div className="flex items-center gap-2 px-3 py-2">
            <UserButton afterSignOutUrl="/sign-in" />
            <span className="text-sm text-muted-foreground">Account</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
