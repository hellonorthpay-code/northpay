"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/store/auth";

/**
 * Mobile-only, top-right "Log in" button for signed-out visitors.
 *
 * Goes to the standalone /login route (outside the dashboard layout) so it
 * opens on the first tap. Sits at the top of the screen — away from the iOS
 * Safari bottom-toolbar tap dead-zone — and prefetches /login so the page is
 * ready before the tap. Hidden once signed in (profile lives in Settings).
 */
export function MobileLoginButton() {
  const user = useAuth((s) => s.user);
  const hydrate = useAuth((s) => s.hydrate);
  const pathname = usePathname();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (user) return null;
  // Don't show it on the login page itself (or the legacy profile route).
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
