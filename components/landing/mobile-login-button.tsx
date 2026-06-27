"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/store/auth";

// Lazy, client-only — loads on first open (like the "See how it works" modal),
// so it never weighs on the homepage.
const LoginModal = dynamic(
  () => import("./login-modal").then((m) => m.LoginModal),
  { ssr: false }
);

/**
 * Mobile-only, top-right "Log in" button for signed-out visitors.
 *
 * Opens the login form as an IN-PAGE modal (no route navigation), exactly like
 * the instant "See how it works" modal — tapping it just mounts the overlay, so
 * there's no page transition or reload. That's the fix for login being slow
 * while everything else was instant. Hidden once signed in (profile → Settings).
 */
export function MobileLoginButton() {
  const user = useAuth((s) => s.user);
  const hydrate = useAuth((s) => s.hydrate);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (user) return null;
  if (pathname === "/login" || pathname?.startsWith("/dashboard/profile")) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Log in"
        className="fixed right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] inline-flex h-10 items-center rounded-full bg-foreground px-4 text-[13px] font-semibold text-background shadow-pop transition-transform active:scale-95 md:hidden"
      >
        Log in
      </button>
      {open && <LoginModal onClose={() => setOpen(false)} />}
    </>
  );
}
