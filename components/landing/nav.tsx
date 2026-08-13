"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { useProfile } from "@/lib/store/profile";
import { useAuth } from "@/lib/store/auth";
import { isRecovery, RESET_PATH } from "@/lib/auth/recovery";
import { cn } from "@/lib/utils";

// No framer-motion here so the desktop nav doesn't pull framer onto the
// homepage's eager path. The fluid bit is a single absolutely-positioned
// highlight pill that MEASURES the active item and glides to it with a CSS
// transition (left/width/top/height, iOS ease) — same feel as framer's
// layoutId, zero bundle cost. Entrance stays pure-CSS fade-down.
type ActiveKey = "home" | "about" | "dashboard" | "profile";

function resolveActive(pathname: string | null): ActiveKey {
  if (!pathname) return "home";
  if (pathname.startsWith("/dashboard/profile")) return "profile";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/about")) return "about";
  return "home";
}

const IOS_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function LandingNav() {
  const pathname = usePathname();
  const active = resolveActive(pathname);
  const profile = useProfile((s) => s.profile);
  const { user, hydrate: hydrateAuth } = useAuth();

  // Auth lives outside the dashboard layout, so hydrate it here too.
  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  const isAuthed = !!user;
  const initials =
    (profile.firstName[0] ?? "").toUpperCase() +
    (profile.lastName[0] ?? "").toUpperCase();

  // A password-reset session is a real session — hide the nav so it can't be
  // used to walk into the app before a new password is actually set.
  const [inRecovery, setInRecovery] = useState(false);
  useEffect(() => {
    setInRecovery(isRecovery() || pathname === RESET_PATH);
  }, [pathname]);

  // ── Sliding highlight ──
  // Measure the active item relative to the nav and glide the pill to it.
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [pill, setPill] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    visible: boolean;
  }>({ left: 0, top: 0, width: 0, height: 0, visible: false });
  // Skip the glide on the very first paint so the pill doesn't fly in from
  // the corner — it appears in place, then animates on later changes.
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    function measure() {
      const nav = navRef.current;
      const el = itemRefs.current[active];
      if (!nav || !el) {
        setPill((p) => ({ ...p, visible: false }));
        return;
      }
      const navBox = nav.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      setPill({
        left: box.left - navBox.left,
        top: box.top - navBox.top,
        width: box.width,
        height: box.height,
        visible: true,
      });
      // Enable transitions one frame after the first successful measure.
      requestAnimationFrame(() => setReady(true));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // Re-measure when the active item, auth state (adds/removes "Start
    // tracking"), or initials (avatar swap) change the nav's layout.
  }, [active, isAuthed, initials]);

  if (inRecovery) return null;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-40 hidden justify-center duration-500 animate-in fade-in slide-in-from-top-2 md:flex">
      <nav
        ref={navRef}
        className="glass-strong pointer-events-auto relative flex items-center gap-1 rounded-full px-2 py-2 shadow-soft"
      >
        {/* The one gliding highlight — replaces per-item static pills. */}
        <span
          aria-hidden
          className="absolute rounded-full bg-muted dark:bg-white/10"
          style={{
            left: pill.left,
            top: pill.top,
            width: pill.width,
            height: pill.height,
            opacity: pill.visible ? 1 : 0,
            transition: ready
              ? `left 420ms ${IOS_EASE}, width 420ms ${IOS_EASE}, top 420ms ${IOS_EASE}, height 420ms ${IOS_EASE}, opacity 220ms ease`
              : "none",
          }}
        />
        <NavItem
          href="/"
          navKey="home"
          itemRefs={itemRefs}
          isActive={active === "home"}
          className="gap-2 px-4 py-1.5 text-[15px] font-semibold tracking-tight text-foreground dark:text-white"
        >
          <Logo />
          NorthPay
        </NavItem>
        {isAuthed && (
          <NavItem
            href="/dashboard"
            navKey="dashboard"
            itemRefs={itemRefs}
            isActive={active === "dashboard"}
            className="ml-1 gap-1.5 px-3.5 py-1.5 text-[13px] font-medium text-foreground dark:text-white"
          >
            Start tracking
          </NavItem>
        )}
        <NavItem
          href={isAuthed ? "/dashboard/profile" : "/login"}
          navKey="profile"
          itemRefs={itemRefs}
          isActive={active === "profile"}
          className="ml-0.5 h-8 w-8 justify-center p-0 text-[12px] font-semibold text-foreground dark:text-white"
          aria-label={isAuthed ? "My profile" : "Log in"}
        >
          {initials ? (
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-400 text-white shadow-soft transition-transform duration-300 ease-out group-hover:scale-110 dark:from-rose-300 dark:to-amber-200 dark:text-black">
              {initials}
            </span>
          ) : (
            <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-muted-foreground transition-transform duration-300 ease-out group-hover:scale-110">
              <User className="h-3.5 w-3.5" />
            </span>
          )}
        </NavItem>
      </nav>
    </header>
  );
}

function NavItem({
  href,
  navKey,
  itemRefs,
  isActive,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  href: string;
  navKey: string;
  itemRefs: React.MutableRefObject<Record<string, HTMLAnchorElement | null>>;
  isActive: boolean;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      ref={(el) => {
        itemRefs.current[navKey] = el;
      }}
      className={cn(
        // `group` lets children (avatar) react to hover; hover bg only when
        // NOT active so it never fights the gliding pill underneath.
        "group relative inline-flex items-center rounded-full transition-[background-color,transform] duration-200 ease-out active:scale-[0.96]",
        !isActive && "hover:bg-muted/50 dark:hover:bg-white/[0.06]",
        className,
      )}
    >
      <span className="relative z-10 inline-flex items-center gap-[inherit]">
        {children}
      </span>
    </Link>
  );
}

function Logo() {
  return (
    <span className="grid h-6 w-6 place-items-center rounded-lg bg-foreground text-background transition-transform duration-300 ease-out group-hover:scale-105 group-active:scale-95">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <path
          d="M3 13V3l10 10V3"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
