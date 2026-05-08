"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/keywords/overview", label: "Overview", exact: true },
  { href: "/dashboard/keywords/ideas", label: "Ideas" },
  { href: "/dashboard/keywords/bulk", label: "Bulk Analysis" },
  { href: "/dashboard/keywords/strategy", label: "Strategy Builder" },
  { href: "/dashboard/keywords/lists", label: "Lists" },
];

export default function KeywordsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-background px-6 pb-0 pt-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Keyword Research</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Explore search demand, cluster opportunities, and manage keyword lists.
          </p>
        </div>
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "border-b-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "border-orange-500 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
