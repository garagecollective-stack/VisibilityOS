"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  ChevronRight,
  FileText,
  Globe,
  LayoutDashboard,
  Link2,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";

const keywordChildren = [
  { href: "/dashboard/keywords/overview", label: "Keyword Overview" },
  { href: "/dashboard/keywords/ideas", label: "Keyword Ideas" },
  { href: "/dashboard/keywords/bulk", label: "Keyword Bulk Analysis" },
  { href: "/dashboard/keywords/strategy", label: "Keyword Strategy Builder" },
  { href: "/dashboard/keywords/lists", label: "Keyword Lists" },
];

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/rank-tracker", label: "Rank Tracker", icon: TrendingUp },
  { href: "/dashboard/audit", label: "Site Audit", icon: ShieldCheck },
  { href: "/dashboard/backlinks", label: "Backlinks", icon: Link2 },
  { href: "/dashboard/competitors", label: "Competitors", icon: Users },
  { href: "/dashboard/geo-tracker", label: "GEO Tracker", icon: Globe },
  { href: "/dashboard/content", label: "Content", icon: FileText },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
];

export function SidebarNav() {
  const pathname = usePathname();
  const keywordsActive = pathname.startsWith("/dashboard/keywords");
  const [keywordsOpen, setKeywordsOpen] = useState(keywordsActive);

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
      {navItems.slice(0, 1).map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}

      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => setKeywordsOpen((open) => !open)}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            keywordsActive
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Keyword Research</span>
          <ChevronRight
            className={cn("h-4 w-4 shrink-0 transition-transform", keywordsOpen && "rotate-90")}
          />
        </button>

        {keywordsOpen && (
          <div className="ml-5 space-y-0.5 border-l border-border/80 pl-3">
            {keywordChildren.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block border-l-2 px-3 py-1.5 text-xs transition-colors",
                    isActive
                      ? "border-l-orange-500 font-semibold text-foreground"
                      : "border-l-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {navItems.slice(1).map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
