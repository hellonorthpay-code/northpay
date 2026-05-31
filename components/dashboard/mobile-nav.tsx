"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "framer-motion";
import { Home, Users, Banknote, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/dashboard/employees", label: "Employees", icon: Users, exact: false },
  { href: "/dashboard/payroll", label: "Payroll", icon: Banknote, exact: false },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, exact: false },
];

export function MobileNav() {
  const pathname = usePathname();

  function isActive(tab: (typeof tabs)[number]) {
    if (tab.exact) return pathname === tab.href;
    if (tab.href === "/dashboard/employees")
      return pathname.startsWith("/dashboard/employees");
    return pathname === tab.href || pathname.startsWith(tab.href + "/");
  }

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:hidden">
      <LayoutGroup id="mobile-nav">
        <div className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-1 rounded-[26px] border border-border/60 bg-background/70 px-2 py-1.5 shadow-pop backdrop-blur-2xl">
          {tabs.map((tab) => {
            const active = isActive(tab);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-[46px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[18px] transition-colors duration-200",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground/70 hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-active-pill"
                    transition={{
                      type: "spring",
                      stiffness: 420,
                      damping: 36,
                      mass: 0.7,
                    }}
                    className="absolute inset-0 -z-10 rounded-[18px] bg-muted dark:bg-white/[0.12]"
                  />
                )}
                <motion.div
                  animate={{ scale: active ? 1 : 0.92 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  <tab.icon
                    className="h-[19px] w-[19px]"
                    strokeWidth={active ? 2 : 1.75}
                    fill={active ? "currentColor" : "none"}
                    fillOpacity={active ? 0.18 : 0}
                  />
                </motion.div>
                <span
                  className={cn(
                    "text-[10px] leading-none tracking-tight transition-all duration-200",
                    active ? "font-semibold" : "font-medium"
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </LayoutGroup>
    </nav>
  );
}
