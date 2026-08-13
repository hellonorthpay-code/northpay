"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/store/auth";
import { supabase } from "@/lib/supabase/client";

const ease = [0.22, 1, 0.36, 1] as const;

// The reset link signs the visitor into a temporary "recovery" session when
// the page loads (Supabase processes the URL). Three states:
//   checking → waiting for that session to appear
//   ready    → session present, show the new-password form
//   invalid  → no session / expired-link error in the URL
type LinkState = "checking" | "ready" | "invalid";

export function ResetPasswordView() {
  const router = useRouter();
  const resetPassword = useAuth((s) => s.resetPassword);
  const hydrateAuth = useAuth((s) => s.hydrate);

  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const settled = useRef(false);

  useEffect(() => {
    void hydrateAuth();
  }, [hydrateAuth]);

  // Decide whether this link is usable.
  useEffect(() => {
    // Expired/used links come back with error params in the URL fragment,
    // e.g. #error=access_denied&error_description=Email+link+is+invalid+or+has+expired
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const desc =
      hash.get("error_description") || query.get("error_description");
    if (hash.get("error") || query.get("error") || desc) {
      settled.current = true;
      setLinkError(
        desc?.replace(/\+/g, " ") ??
          "This reset link is invalid or has expired."
      );
      setLinkState("invalid");
      return;
    }

    // Our reset emails link here directly with ?token_hash=… (never through
    // Supabase's /verify redirect, which email scanners pre-click and burn).
    // Exchange it for a recovery session now — scanners don't execute JS, so
    // the token survives until the person actually opens the page.
    const tokenHash = query.get("token_hash");
    if (tokenHash) {
      void supabase.auth
        .verifyOtp({ type: "recovery", token_hash: tokenHash })
        .then(async ({ error }) => {
          if (settled.current) return;
          if (!error) {
            settled.current = true;
            setLinkState("ready");
            return;
          }
          // Token already used (e.g. the link was opened twice) — if this
          // browser still holds the recovery session, let them proceed.
          const {
            data: { session },
          } = await supabase.auth.getSession();
          settled.current = true;
          if (session) {
            setLinkState("ready");
          } else {
            setLinkError("This reset link is invalid or has expired.");
            setLinkState("invalid");
          }
        });
      return;
    }

    // Wait for Supabase to turn the link into a session (it processes the
    // URL asynchronously on load). Listen for the auth event AND poll as a
    // fallback; give up after ~6s.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (settled.current) return;
      if (session) {
        settled.current = true;
        setLinkState("ready");
      }
    });

    let tries = 0;
    const poll = setInterval(async () => {
      if (settled.current) {
        clearInterval(poll);
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        settled.current = true;
        setLinkState("ready");
        clearInterval(poll);
        return;
      }
      tries += 1;
      if (tries >= 12) {
        settled.current = true;
        setLinkState("invalid");
        clearInterval(poll);
      }
    }, 500);

    return () => {
      sub.subscription.unsubscribe();
      clearInterval(poll);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    const result = await resetPassword(password);

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    // Success → show the confirmation, end the recovery session, and send
    // them back to sign in with their new password.
    setDone(true);
    setBusy(false);
    await supabase.auth.signOut();
    setTimeout(() => router.replace("/login"), 2200);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-6 shadow-soft backdrop-blur-xl md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-rose-200/30 blur-3xl dark:bg-rose-500/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-500/10" />

        {/* ── Checking the link ── */}
        {linkState === "checking" && (
          <div className="relative flex flex-col items-center py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="mt-4 text-[13.5px] text-muted-foreground">
              Verifying your reset link…
            </p>
          </div>
        )}

        {/* ── Invalid / expired link ── */}
        {linkState === "invalid" && (
          <div className="relative text-center">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Reset link
            </p>
            <p className="mt-2 text-[22px] font-semibold leading-tight tracking-tightest">
              This link isn&rsquo;t valid anymore
            </p>
            <p className="mx-auto mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-muted-foreground">
              {linkError ??
                "Reset links expire after 1 hour and can only be used once."}{" "}
              Request a new one and try again.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-[13.5px] font-semibold text-background transition-transform duration-200 hover:scale-[1.02] active:scale-95"
            >
              Request a new link
            </Link>
          </div>
        )}

        {/* ── Success ── */}
        {linkState === "ready" && done && (
          <div className="relative text-center duration-300 animate-in fade-in zoom-in-95">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-success/15">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              All set
            </p>
            <p className="mt-2 text-[22px] font-semibold leading-tight tracking-tightest">
              Password saved successfully
            </p>
            <p className="mx-auto mt-2 max-w-[280px] text-[13.5px] leading-relaxed text-muted-foreground">
              Use your new password the next time you log in.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-[13.5px] font-semibold text-background transition-transform duration-200 hover:scale-[1.02] active:scale-95"
            >
              Back to sign in
            </Link>
            <p className="mt-3 text-[11.5px] text-muted-foreground">
              Taking you there automatically…
            </p>
          </div>
        )}

        {/* ── New-password form ── */}
        {linkState === "ready" && !done && (
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-foreground text-background">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Account
                </p>
                <p className="text-[20px] font-semibold leading-none tracking-tightest md:text-[22px]">
                  Set a new password
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  At least 6 characters.
                </p>
              </div>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-3">
              <div className="flex flex-col gap-1.5">
                <Label className="flex items-center gap-1.5 text-[11.5px]">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  New password
                </Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="flex items-center gap-1.5 text-[11.5px]">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  Confirm password
                </Label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  aria-invalid={confirm.length > 0 && confirm !== password}
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease }}
                    className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12.5px] font-medium text-destructive"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <Button type="submit" className="mt-2 w-full" disabled={busy}>
                {busy ? "Saving…" : "Save new password"}
              </Button>
            </form>

            <Link
              href="/login"
              className="mt-3 flex items-center justify-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to sign in
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
