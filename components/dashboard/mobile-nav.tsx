"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Landmark, Play, Settings, Users } from "lucide-react";
import { useAuth } from "@/lib/store/auth";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

// Middle pill items (icon + text). Home and Settings live in their OWN
// separate circles either side of this pill.
const MIDDLE: Tab[] = [
  { href: "/dashboard/employees", label: "Employees", icon: Users },
  { href: "/dashboard/payroll", label: "Payroll", icon: Play },
  { href: "/dashboard/cra", label: "CRA", icon: Landmark },
];

const SHELL =
  "pointer-events-auto rounded-full border border-border/60 bg-background/95 shadow-pop";

export function MobileNav() {
  const pathname = usePathname();
  const { user, hydrate: hydrateAuth } = useAuth();

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  const isAuthed = !!user;

  const homeActive = pathname === "/";
  const settingsActive =
    pathname.startsWith("/dashboard/settings") ||
    pathname.startsWith("/dashboard/profile");

  function middleActive(href: string) {
    if (href === "/dashboard/employees")
      return pathname.startsWith("/dashboard/employees");
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      {/* Home — its own circle on the left */}
      <div className={SHELL}>
        <CircleLink href="/" label="Home" icon={Home} active={homeActive} />
      </div>

      {isAuthed && (
        <>
          {/* Middle pill — Employees · Payroll · CRA (icon + text) */}
          <div className={cn(SHELL, "flex items-center gap-0.5 p-1")}>
            {MIDDLE.map((tab) => {
              const active = middleActive(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  prefetch
                  aria-label={tab.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 transition-all duration-200",
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
                  <span className="text-[11.5px] font-medium tracking-tight">
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Settings — its own circle on the right */}
          <div className={SHELL}>
            <CircleLink
              href="/dashboard/settings"
              label="Settings"
              icon={Settings}
              active={settingsActive}
            />
          </div>
        </>
      )}
    </nav>
  );
}

function CircleLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "m-1 grid h-11 w-11 place-items-center rounded-full transition-all duration-200",
        active
          ? "bg-muted text-foreground dark:bg-white/[0.12]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 transition-transform duration-200",
          active ? "scale-110" : "",
        )}
      />
    </Link>
  );
}
