"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "framer-motion";
import { Landmark, Play, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard/employees", label: "Employees", icon: Users },
  { href: "/dashboard/payroll", label: "Payroll", icon: Play },
  { href: "/dashboard/cra", label: "CRA", icon: Landmark },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Frosted glass bar */}
      <div className="border-t border-border/60 bg-background/80 backdrop-blur-2xl">
        <LayoutGroup id="mobile-nav">
          <div className="flex items-stretch">
            {tabs.map((tab) => {
              const active =
                pathname === tab.href || pathname.startsWith(tab.href + "/");
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "relative flex flex-1 flex-col items-center gap-1 py-2.5 pb-safe",
                    "transition-colors duration-200",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="mobile-active-pill"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 36,
                        mass: 0.8,
                      }}
                      className="absolute inset-x-2 inset-y-1 -z-10 rounded-2xl bg-muted/80 dark:bg-white/[0.08]"
                    />
                  )}
                  <tab.icon
                    className={cn(
                      "h-5 w-5 transition-transform duration-200",
                      active ? "scale-110" : "",
                    )}
                  />
                  <span className="text-[10px] font-medium tracking-tight">
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </LayoutGroup>
        {/* Safe area spacer for iPhone home indicator */}
        <div className="h-safe-bottom" />
      </div>
    </nav>
  );
}
