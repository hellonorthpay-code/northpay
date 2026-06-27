"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/store/auth";

/**
 * Mobile-only, top-right "Log in" button for signed-out visitors.
 *
 * Uses Next <Link> (soft, in-app navigation), NOT a plain <a>. A plain <a> does
 * a full-page reload — which on mobile meant re-downloading/parsing the whole
 * app (~6s) just to reach /login, while every <Link>-based action (e.g. "See
 * how it works", "Start tracking") was instant. Now that the homepage is light
 * and its JS is responsive, the soft nav opens /login instantly with no reload.
 * Prefetched so it's ready before the tap. Hidden once signed in.
 */
export function MobileLoginButton() {
  const user = useAuth((s) => s.user);
  const hydrate = useAuth((s) => s.hydrate);
  const pathname = usePathname();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (user) return null;
  if (pathname === "/login" || pathname?.startsWith("/dashboard/profile")) {
    return null;
  }

  return (
    <Link
      href="/login"
      prefetch
      aria-label="Log in"
      className="fixed right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] inline-flex h-10 items-center rounded-full bg-foreground px-4 text-[13px] font-semibold text-background shadow-pop transition-transform active:scale-95 md:hidden"
    >
      Log in
    </Link>
  );
}
