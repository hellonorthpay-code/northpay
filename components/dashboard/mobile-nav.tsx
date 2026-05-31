"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "framer-motion";
import { Home, Info, Play, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/dashboard/employees", label: "Tracking", icon: Play, exact: false },
  { href: "/about", label: "About", icon: Info, exact: false },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, exact: false },
];

export function MobileNav() {
  const pathname = usePathname();

  function isActive(tab: (typeof tabs)[number]) {
    if (tab.exact) return pathname === tab.href;
    if (tab.href === "/dashboard/employees")
      return pathname.startsWith("/dashboard");
    return pathname === tab.href || pathname.startsWith(tab.href + "/");
  }

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      {/* Floating Wealthsimple-style capsule */}
      <LayoutGroup id="mobile-nav">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/60 bg-background/70 p-1.5 shadow-pop backdrop-blur-2xl">
          {tabs.map((tab) => {
            const active = isActive(tab);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                className={cn(
                  "relative grid h-12 w-12 place-items-center rounded-full transition-colors duration-200",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-active-pill"
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 34,
                      mass: 0.8,
                    }}
                    className="absolute inset-0 -z-10 rounded-full bg-muted dark:bg-white/[0.12]"
                  />
                )}
                <tab.icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    active ? "scale-110" : "",
                  )}
                />
              </Link>
            );
          })}
        </div>
      </LayoutGroup>
    </nav>
  );
}
