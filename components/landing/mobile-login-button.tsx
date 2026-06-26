"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { useAuth } from "@/lib/store/auth";

/**
 * Mobile-only, top-right login/profile entry shown to signed-out visitors.
 *
 * Lives at the top of the screen (away from the iOS Safari bottom-toolbar zone,
 * where fixed bottom-bar taps are unreliable). Once signed in it disappears —
 * the profile then lives inside the Settings tab.
 */
export function MobileLoginButton() {
  const { user, hydrate } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Signed-out only, and not on the login page itself.
  if (user) return null;
  if (pathname?.startsWith("/dashboard/profile")) return null;

  return (
    <Link
      href="/dashboard/profile"
      prefetch
      aria-label="Log in"
      className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-50 grid h-10 w-10 place-items-center rounded-full border border-border/60 bg-background/95 text-foreground shadow-soft transition-colors hover:bg-muted md:hidden"
    >
      <User className="h-5 w-5" />
    </Link>
  );
}
