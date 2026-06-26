"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { useProfile } from "@/lib/store/profile";
import { useAuth } from "@/lib/store/auth";
import { cn } from "@/lib/utils";

// No framer-motion here so the desktop nav doesn't pull framer onto the
// homepage's eager path. The active item gets a plain CSS pill; entrance is a
// pure-CSS (tailwindcss-animate) fade-down.
type ActiveKey = "home" | "about" | "dashboard" | "profile";

function resolveActive(pathname: string | null): ActiveKey {
  if (!pathname) return "home";
  if (pathname.startsWith("/dashboard/profile")) return "profile";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/about")) return "about";
  return "home";
}

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

  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-40 hidden justify-center duration-500 animate-in fade-in slide-in-from-top-2 md:flex">
      <nav className="glass-strong pointer-events-auto flex items-center gap-1 rounded-full px-2 py-2 shadow-soft">
        <NavItem
          href="/"
          isActive={active === "home"}
          className="gap-2 px-4 py-1.5 text-[15px] font-semibold tracking-tight text-foreground dark:text-white"
        >
          <Logo />
          NorthPay
        </NavItem>
        {isAuthed && (
          <NavItem
            href="/dashboard"
            isActive={active === "dashboard"}
            className="ml-1 gap-1.5 px-3.5 py-1.5 text-[13px] font-medium text-foreground dark:text-white"
          >
            Start tracking
          </NavItem>
        )}
        <NavItem
          href={isAuthed ? "/dashboard/profile" : "/login"}
          isActive={active === "profile"}
          className="ml-0.5 h-8 w-8 justify-center p-0 text-[12px] font-semibold text-foreground dark:text-white"
          aria-label={isAuthed ? "My profile" : "Log in"}
        >
          {initials ? (
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-400 text-white shadow-soft dark:from-rose-300 dark:to-amber-200 dark:text-black">
              {initials}
            </span>
          ) : (
            <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-muted-foreground">
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
  isActive,
  className,
  activeTextClassName,
  children,
  "aria-label": ariaLabel,
}: {
  href: string;
  isActive: boolean;
  className?: string;
  /** Optional override for text color when this item is active. Useful for
      items like "About" whose default state is muted. */
  activeTextClassName?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex items-center rounded-full",
        className,
        isActive && activeTextClassName,
      )}
    >
      {isActive && <ActivePill />}
      <span className="relative z-10 inline-flex items-center gap-[inherit]">
        {children}
      </span>
    </Link>
  );
}

function ActivePill() {
  return (
    <span className="absolute inset-0 rounded-full bg-muted dark:bg-white/10" />
  );
}

function Logo() {
  return (
    <span className="grid h-6 w-6 place-items-center rounded-lg bg-foreground text-background">
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
