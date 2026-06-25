"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "framer-motion";
import { FileText, Landmark, Play, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard/employees", label: "Employees", icon: Users },
  { href: "/dashboard/payroll", label: "Payroll", icon: Play },
  { href: "/dashboard/cra", label: "CRA", icon: Landmark },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-5 hidden h-[calc(100vh-40px)] w-[232px] shrink-0 md:block">
      <div className="glass-strong flex h-full flex-col rounded-3xl p-3 shadow-soft">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-3 text-[15px] font-semibold tracking-tight"
        >
          <span className="grid h-7 w-7 place-items-center rounded-xl bg-foreground text-background">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 13V3l10 10V3"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          NorthPay
        </Link>

        {/* `LayoutGroup` scopes the shared `layoutId` to just this nav,
            so the spring animation is always one continuous morph between
            sibling tabs — no remount can split it. */}
        <LayoutGroup id="sidebar-nav">
          <nav className="mt-4 flex flex-col gap-1">
            {tabs.map((tab) => {
              const active =
                pathname === tab.href || pathname.startsWith(tab.href + "/");
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    // `isolate` + the pill rendered above `relative z-0`
                    // content stops the pill flashing over the icon mid-
                    // morph (the previous `-z-10` would briefly disappear
                    // when the parent stacking context changed).
                    "group relative isolate flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-medium",
                    "transition-colors duration-300 ease-out",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active-pill"
                      // Smooth, near-critically-damped spring — no
                      // overshoot, no bounce-back, just a calm glide
                      // from the old tab to the new one. Eliminates the
                      // perceived "flicker" of the previous bouncy curve.
                      transition={{
                        type: "spring",
                        stiffness: 320,
                        damping: 34,
                        mass: 0.9,
                      }}
                      className="absolute inset-0 -z-10 rounded-2xl bg-muted/80 dark:bg-white/[0.08]"
                    />
                  )}
                  <tab.icon
                    className={cn(
                      "h-[18px] w-[18px] transition-transform duration-200",
                      active ? "" : "group-hover:scale-105",
                    )}
                  />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>

        <div className="mt-auto rounded-2xl border border-border/60 bg-background/40 p-4">
          <p className="text-[12px] font-medium tracking-tight">
            2026 CRA tables loaded
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Federal · CPP · EI · 9 provinces. Updated as values are finalized.
          </p>
        </div>
      </div>
    </aside>
  );
}
