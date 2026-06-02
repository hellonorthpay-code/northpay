"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

/**
 * OAuth callback — CLIENT side.
 *
 * The PKCE code verifier lives in the browser (localStorage), so the
 * code→session exchange must happen here, not in a server route handler.
 *
 * The browser Supabase client auto-detects the `?code=` in the URL on
 * load (detectSessionInUrl), but we also call exchangeCodeForSession
 * explicitly as a belt-and-suspenders so we control the redirect timing.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let done = false;

    async function finish() {
      try {
        // Try explicit exchange first (PKCE flow with ?code=)
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // Confirm we actually have a session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        async function routeForUser() {
          // New users (e.g. fresh Google sign-in) have no first_name yet —
          // send them through the welcome/onboarding screen once.
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return "/dashboard/profile?error=oauth";

          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name")
            .eq("id", user.id)
            .single();

          const hasName = !!(profile?.first_name && profile.first_name.trim());
          return hasName ? "/dashboard" : "/dashboard/welcome";
        }

        if (!done) {
          done = true;
          if (session) {
            router.replace(await routeForUser());
          } else {
            // Some flows resolve via onAuthStateChange a beat later
            setTimeout(async () => {
              const {
                data: { session: s2 },
              } = await supabase.auth.getSession();
              router.replace(s2 ? await routeForUser() : "/dashboard/profile?error=oauth");
            }, 600);
          }
        }
      } catch (e) {
        if (!done) {
          done = true;
          setError(e instanceof Error ? e.message : "Sign-in failed.");
          setTimeout(() => router.replace("/dashboard/profile?error=oauth"), 1500);
        }
      }
    }

    void finish();
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
