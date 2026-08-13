"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Landmark, Play, Settings, Users } from "lucide-react";
import { useAuth } from "@/lib/store/auth";
import { isRecovery, RESET_PATH } from "@/lib/auth/recovery";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
  requiresAuth?: boolean;
  /** Icon-only (no label) — used for Home (left) and Settings (right). */
  iconOnly?: boolean;
};

// Order = layout: Home (left) · Employees · Payroll · CRA (middle, icon+text)
// · Settings (right).
const tabs: Tab[] = [
  { href: "/", label: "Home", icon: Home, exact: true, iconOnly: true },
  { href: "/dashboard/employees", label: "Employees", icon: Users, requiresAuth: true },
  { href: "/dashboard/payroll", label: "Payroll", icon: Play, requiresAuth: true },
  { href: "/dashboard/cra", label: "CRA", icon: Landmark, requiresAuth: true },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, requiresAuth: true, iconOnly: true },
];

export function MobileNav() {
  const pathname = usePathname();
  const { user, hydrate: hydrateAuth } = useAuth();

  // Hydrate auth on mount so marketing pages (which don't mount the
  // dashboard layout) still see the current session.
  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  // A password-reset session is a real session — hide the nav so it can't be
  // used to walk into the app before a new password is actually set.
  const [inRecovery, setInRecovery] = useState(false);
  useEffect(() => {
    setInRecovery(isRecovery() || pathname === RESET_PATH);
  }, [pathname]);

  const isAuthed = !!user;
  const visibleTabs = tabs.filter((t) => (t.requiresAuth ? isAuthed : true));

  function isActive(tab: Tab) {
    if (tab.exact) return pathname === tab.href;
    if (tab.href === "/dashboard/employees")
      return pathname.startsWith("/dashboard/employees");
    if (tab.href === "/dashboard/settings")
      // Profile lives under Settings, so Settings owns that highlight too.
      return (
        pathname.startsWith("/dashboard/settings") ||
        pathname.startsWith("/dashboard/profile")
      );
    return pathname === tab.href || pathname.startsWith(tab.href + "/");
  }

  if (inRecovery) return null;

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      {/* Segmented pill — Home (icon) · Employees/Payroll/CRA (icon+text) ·
          Settings (icon). No framer / no backdrop-blur: smooth via CSS only, so
          it stays cheap to paint and never blocks taps. Active item carries the
          existing muted highlight (colour scheme unchanged). */}
      <div className="pointer-events-auto flex max-w-full items-center gap-0.5 rounded-full border border-border/60 bg-background/95 p-1 shadow-pop">
        {visibleTabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full transition-all duration-200",
                tab.iconOnly ? "w-11" : "px-3",
                active
                  ? "bg-muted text-foreground dark:bg-white/[0.12]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-transform duration-200",
                  active ? "scale-110" : "",
                )}
              />
              {!tab.iconOnly && (
                <span className="text-[11.5px] font-medium tracking-tight">
                  {tab.label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
