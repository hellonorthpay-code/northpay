"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "framer-motion";
import { Home, Play, PlayCircle, Settings } from "lucide-react";
import { useAuth } from "@/lib/store/auth";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
  requiresAuth?: boolean;
};

const tabs: Tab[] = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/dashboard/employees", label: "Tracking", icon: Play, requiresAuth: true },
  { href: "/dashboard/payroll", label: "Payroll", icon: PlayCircle, requiresAuth: true },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, requiresAuth: true },
];

export function MobileNav() {
  const pathname = usePathname();
  const { user, hydrate: hydrateAuth } = useAuth();

  // Hydrate auth on mount so marketing pages (which don't mount the
  // dashboard layout) still see the current session.
  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  const isAuthed = !!user;
  const visibleTabs = tabs.filter((t) => isAuthed || !t.requiresAuth);

  function isActive(tab: Tab) {
    if (tab.exact) return pathname === tab.href;
    if (tab.href === "/dashboard/employees")
      return pathname.startsWith("/dashboard/employees");
    if (tab.href === "/dashboard/settings")
      return pathname.startsWith("/dashboard/settings") || pathname.startsWith("/dashboard/profile");
    return pathname === tab.href || pathname.startsWith(tab.href + "/");
  }

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <LayoutGroup id="mobile-nav">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/60 bg-background/70 p-1.5 shadow-pop backdrop-blur-2xl">
          {visibleTabs.map((tab) => {
            const active = isActive(tab);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                className={cn(
                  "relative grid h-12 w-12 place-items-center rounded-full transition-colors duration-200",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-active-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.8 }}
                    className="absolute inset-0 -z-10 rounded-full bg-muted dark:bg-white/[0.12]"
                  />
                )}
                <tab.icon className={cn("h-5 w-5 transition-transform duration-200", active ? "scale-110" : "")} />
              </Link>
            );
          })}
        </div>
      </LayoutGroup>
    </nav>
  );
}
