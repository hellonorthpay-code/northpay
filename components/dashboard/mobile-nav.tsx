"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

const IOS_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

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

  const activeHref = visibleTabs.find((t) => isActive(t))?.href ?? null;

  // ── Sliding highlight (framer-free, same as the desktop navs) ──
  // One absolutely-positioned pill measures the active tab and glides
  // horizontally to it with a CSS transition, instead of the highlight
  // snapping between items.
  const rowRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [pill, setPill] = useState({ left: 0, width: 0, visible: false });
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    function measure() {
      const row = rowRef.current;
      const el = activeHref ? itemRefs.current[activeHref] : null;
      if (!row || !el) {
        setPill((p) => ({ ...p, visible: false }));
        return;
      }
      const rowBox = row.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      setPill({ left: box.left - rowBox.left, width: box.width, visible: true });
      requestAnimationFrame(() => setReady(true));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // isAuthed changes the tab list, shifting positions.
  }, [activeHref, isAuthed]);

  if (inRecovery) return null;

  return (
    // Lifted off the screen edge: the floor goes 0.75rem → 1.5rem.
    //
    // env(safe-area-inset-bottom) only resolves once the viewport is declared
    // `viewport-fit: cover`, which this app never set — so the inset is 0 and
    // this expression has always been deciding the position on its own. The
    // floor IS the gap, which is why 12px read as hugging the bottom.
    //
    // Kept as max() rather than calc(): CSS requires whitespace around `+`
    // inside calc(), and a Tailwind arbitrary value can't contain spaces, so
    // calc(1.5rem+env(…)) parses as invalid and the padding silently drops to
    // zero — the opposite of what's wanted here.
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:hidden">
      {/* Segmented pill — Home (icon) · Employees/Payroll/CRA (icon+text) ·
          Settings (icon). No framer / no backdrop-blur: the glide is a pure
          CSS transition on one absolutely-positioned highlight, so it stays
          cheap to paint and never blocks taps. */}
      <div
        ref={rowRef}
        className="pointer-events-auto relative flex max-w-full items-center gap-0.5 rounded-full border border-border/60 bg-background/95 p-1 shadow-pop"
      >
        {/* The one gliding highlight. */}
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-full bg-muted dark:bg-white/[0.12]"
          style={{
            left: pill.left,
            width: pill.width,
            opacity: pill.visible ? 1 : 0,
            transition: ready
              ? `left 380ms ${IOS_EASE}, width 380ms ${IOS_EASE}, opacity 200ms ease`
              : "none",
          }}
        />
        {visibleTabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch
              ref={(el) => {
                itemRefs.current[tab.href] = el;
              }}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full transition-[color,transform] duration-300 active:scale-95",
                tab.iconOnly ? "w-11" : "px-3",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon
                className={cn(
                  "relative z-10 h-[18px] w-[18px] shrink-0 transition-transform duration-300",
                  active ? "scale-110" : "",
                )}
              />
              {!tab.iconOnly && (
                <span className="relative z-10 text-[11.5px] font-medium tracking-tight">
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
