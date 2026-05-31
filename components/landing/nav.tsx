"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Three routes share the same morphing pill via Framer's `layoutId`.
// Whichever item is "active" renders <ActivePill/> inside itself; the rest
// don't. As the route changes, the pill animates from one link's bounds to
// another instead of fading out and fading in.
type ActiveKey = "home" | "about" | "dashboard";

function resolveActive(pathname: string | null): ActiveKey {
  if (!pathname) return "home";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/about")) return "about";
  return "home";
}

export function LandingNav() {
  const pathname = usePathname();
  const active = resolveActive(pathname);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center"
    >
      <nav className="glass-strong pointer-events-auto flex items-center gap-1 rounded-full px-2 py-2 shadow-soft">
        <NavItem
          href="/"
          isActive={active === "home"}
          className="gap-2 px-4 py-1.5 text-[15px] font-semibold tracking-tight text-foreground dark:text-white"
        >
          <Logo />
          NorthPay
        </NavItem>
        <NavItem
          href="/about"
          isActive={active === "about"}
          className="hidden px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
          activeTextClassName="text-foreground dark:text-white"
        >
          About
        </NavItem>
        <NavItem
          href="/dashboard"
          isActive={active === "dashboard"}
          className="ml-1 gap-1.5 px-3.5 py-1.5 text-[13px] font-medium text-foreground dark:text-white"
        >
          Start tracking
        </NavItem>
      </nav>
    </motion.header>
  );
}

function NavItem({
  href,
  isActive,
  className,
  activeTextClassName,
  children,
}: {
  href: string;
  isActive: boolean;
  className?: string;
  /** Optional override for text color when this item is active. Useful for
      items like "About" whose default state is muted. */
  activeTextClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
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
    <motion.span
      layoutId="nav-active-pill"
      transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.9 }}
      className="absolute inset-0 rounded-full bg-muted dark:bg-white/10"
    />
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
