"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

/**
 * OAuth callback — CLIENT side.
 *
 * Our Supabase client has `detectSessionInUrl: true`, so it AUTOMATICALLY
 * exchanges the `?code=` for a session as soon as it initialises. We must
 * NOT call exchangeCodeForSession ourselves — the code is single-use, and
 * a second exchange throws ("code already used"), which previously dumped
 * users on /profile?error=oauth and skipped onboarding entirely.
 *
 * So here we just WAIT for the session to materialise (via onAuthStateChange
 * or a short poll), then route:
 *   • brand-new account (no first_name yet) → /dashboard/welcome
 *   • returning account                     → /dashboard
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let done = false;

    async function routeForUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return "/dashboard/profile?error=oauth";

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", user.id)
        .maybeSingle();

      const hasName = !!(profile?.first_name && profile.first_name.trim());
      return hasName ? "/dashboard" : "/dashboard/welcome";
    }

    async function go() {
      if (done) return;
      done = true;
      router.replace(await routeForUser());
    }

    // 1) React the instant the session is established.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        void go();
      }
    });

    // 2) Belt-and-suspenders poll — the session may already be present
    //    (detectSessionInUrl resolved before this effect ran), or land a
    //    beat later. Check a handful of times, then give up.
    let tries = 0;
    const poll = window.setInterval(async () => {
      tries += 1;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        window.clearInterval(poll);
        void go();
      } else if (tries >= 12) {
        // ~4.8s with nothing → genuine failure
        window.clearInterval(poll);
        if (!done) {
          done = true;
          setError("Sign-in didn't complete. Please try again.");
          setTimeout(() => router.replace("/dashboard/profile?error=oauth"), 1400);
        }
      }
    }, 400);

    return () => {
      subscription.unsubscribe();
      window.clearInterval(poll);
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-foreground text-background">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <path d="M3 13V3l10 10V3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {error ? (
          <p className="text-[13.5px] text-destructive">{error}</p>
        ) : (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
            <p className="text-[13.5px] text-muted-foreground">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}
