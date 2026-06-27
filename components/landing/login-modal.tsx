"use client";

import { X } from "lucide-react";
import { LoginView } from "@/components/dashboard/profile/login-view";

/**
 * Login as an in-page overlay (like the "See how it works" modal) instead of a
 * route navigation. Opening it just mounts this component — no page transition,
 * no route chunks, no full reload — so it appears instantly. After a successful
 * login/sign-up, LoginView itself navigates into the dashboard.
 *
 * Opaque background (no backdrop-blur) to keep the paint cheap on mobile.
 */
export function LoginModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-background px-4 py-16">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="fixed right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-[90] grid h-10 w-10 place-items-center rounded-full bg-muted text-foreground shadow-soft transition-transform active:scale-95"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="flex min-h-full items-center justify-center">
        <LoginView />
      </div>
    </div>
  );
}
