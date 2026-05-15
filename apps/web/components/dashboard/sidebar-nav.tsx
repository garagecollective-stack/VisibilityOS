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

// Shared class builders
const itemBase = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors border-l-2";
const itemActive = "border-blue-500 bg-blue-600/20 font-medium text-white";
const itemInactive = "border-transparent text-[#94A3B8] hover:text-white hover:bg-[#1E293B]";

const iconActive = "h-4 w-4 shrink-0 text-white";
const iconInactive = "h-4 w-4 shrink-0 text-[#94A3B8]";

export function SidebarNav() {
  const pathname = usePathname();
  const keywordsActive = pathname.startsWith("/dashboard/keywords");
  const [keywordsOpen, setKeywordsOpen] = useState(keywordsActive);

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
      {/* Dashboard */}
      {navItems.slice(0, 1).map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(itemBase, isActive ? itemActive : itemInactive)}
          >
            <item.icon className={isActive ? iconActive : iconInactive} />
            {item.label}
          </Link>
        );
      })}

      {/* Keyword Research (expandable) */}
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => setKeywordsOpen((open) => !open)}
          className={cn(
            "w-full",
            itemBase,
            keywordsActive ? itemActive : itemInactive
          )}
        >
          <Search className={keywordsActive ? iconActive : iconInactive} />
          <span className="flex-1 text-left">Keyword Research</span>
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 transition-transform",
              keywordsActive ? "text-white" : "text-[#94A3B8]",
              keywordsOpen && "rotate-90"
            )}
          />
        </button>

        {keywordsOpen && (
          <div className="ml-5 space-y-0.5 border-l border-white/[0.08] pl-3">
            {keywordChildren.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-md border-l-2 px-3 py-1.5 text-xs transition-colors",
                    isActive
                      ? "border-blue-500 font-semibold text-white"
                      : "border-transparent text-[#94A3B8] hover:text-white"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Remaining nav items */}
      {navItems.slice(1).map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(itemBase, isActive ? itemActive : itemInactive)}
          >
            <item.icon className={isActive ? iconActive : iconInactive} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
