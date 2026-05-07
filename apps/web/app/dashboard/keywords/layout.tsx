"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/keywords", label: "Overview", exact: true },
  { href: "/dashboard/keywords/ideas", label: "Keyword Ideas" },
  { href: "/dashboard/keywords/lists", label: "My Lists" },
];

export default function KeywordsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Header + sub-nav */}
      <div className="border-b bg-background px-6 pt-6 pb-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Keywords</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Research and manage your keyword strategy</p>
        </div>
        <nav className="flex gap-1">
          {TABS.map((tab) => {
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
