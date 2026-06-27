"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/store/auth";

/**
 * Mobile-only, top-right "Log in" button for signed-out visitors.
 *
 * Deliberately a PLAIN <a>, not a Next <Link>: a native anchor navigates the
 * instant it's tapped, handled by the browser itself — it does NOT wait for
 * React to hydrate or for the main thread to be free. That's the fix for the
 * "tap does nothing for a few seconds, then it opens" problem: a <Link> needs
 * JS to handle the click, so taps were queued while the homepage was still
 * becoming interactive. The destination /login is edge-cached, so the plain
 * navigation is fast.
 *
 * Hidden once signed in (profile lives in Settings).
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
    <a
      href="/login"
      aria-label="Log in"
      className="fixed right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] inline-flex h-10 items-center rounded-full bg-foreground px-4 text-[13px] font-semibold text-background shadow-pop transition-transform active:scale-95 md:hidden"
    >
      Log in
    </a>
  );
}
