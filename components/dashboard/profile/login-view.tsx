"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Lock, Mail, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/store/auth";
import { useWelcome } from "@/lib/store/welcome";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup" | "forgot";

// NOTE: no framer-motion here on purpose. The login route must open instantly
// on mobile, so animations are pure CSS (tailwindcss-animate) and the mode
// switches use plain conditional rendering instead of height/AnimatePresence.
export function LoginView() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const signup = useAuth((s) => s.signup);
  const requestPasswordReset = useAuth((s) => s.requestPasswordReset);
  const triggerWelcome = useWelcome((s) => s.trigger);

  const [mode, setMode] = useState<Mode>("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  // Only shown when the Supabase project has email confirmation enabled — then
  // sign-up returns no session and the user must confirm before logging in.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setResetSent(false);
  }

  function markLoggedIn() {
    try {
      window.localStorage.setItem("northpay:hasLoggedIn", "1");
    } catch {}
  }

  // Shared post-auth handoff → into the app at Employees. On sign-up we also
  // play the welcome overlay (it lives in the dashboard layout, so it survives
  // this navigation); regular login goes straight through.
  function enterApp(withWelcome: boolean) {
    markLoggedIn();
    if (withWelcome) triggerWelcome();
    router.replace("/dashboard/employees");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (mode === "login") {
        const result = await login(email, password);
        if (!result.ok) setError(result.error);
        else enterApp(false);
        return;
      }

      if (mode === "signup") {
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords don't match.");
          return;
        }
        const result = await signup({ firstName, lastName, email, password, phone });
        if (!result.ok) {
          setError(result.error);
        } else if (result.needsConfirmation) {
          setAwaitingConfirmation(true);
        } else {
          enterApp(true);
        }
        return;
      }

      // forgot password
      const result = await requestPasswordReset(email);
      if (!result.ok) setError(result.error);
      else setResetSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/95 p-6 shadow-soft duration-500 animate-in fade-in slide-in-from-bottom-4 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-rose-200/30 blur-3xl dark:bg-rose-500/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-500/10" />

        {awaitingConfirmation ? (
          <div className="relative text-center">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-success/15">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Almost there
            </p>
            <p className="mt-2 text-[22px] font-semibold leading-tight tracking-tightest">
              Check your email
            </p>
            <p className="mx-auto mt-2 max-w-[280px] text-[13.5px] leading-relaxed text-muted-foreground">
              We sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{email}</span>. Click
              it, then log in.
            </p>
            <button
              type="button"
              onClick={() => {
                setAwaitingConfirmation(false);
                switchMode("login");
              }}
              className="mt-6 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Back to log in
            </button>
          </div>
        ) : (
          <div className="relative">
            {/* Logo + title */}
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-foreground text-background">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <path d="M3 13V3l10 10V3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {mode === "forgot" ? "Recover" : "Welcome"}
                </p>
                <p className="truncate text-[20px] font-semibold leading-none tracking-tightest md:text-[22px]">
                  {mode === "login"
                    ? "Log in to NorthPay"
                    : mode === "signup"
                    ? "Create your account"
                    : "Reset your password"}
                </p>
              </div>
            </div>

            {/* Mode toggle */}
            {mode !== "forgot" && (
              <div className="mt-5 grid grid-cols-2 gap-1 rounded-full border border-border/60 bg-muted/40 p-1 text-[12.5px] font-medium">
                <ModeTab active={mode === "login"} onClick={() => switchMode("login")}>
                  Log in
                </ModeTab>
                <ModeTab active={mode === "signup"} onClick={() => switchMode("signup")}>
                  Sign up
                </ModeTab>
              </div>
            )}

            {/* Form */}
            <form onSubmit={submit} className="mt-5 space-y-3">
              {mode === "signup" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <IconField icon={User} label="First name">
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                    </IconField>
                    <IconField icon={User} label="Last name">
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                    </IconField>
                  </div>
                  <IconField icon={Phone} label="Phone (optional)">
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoComplete="tel"
                      placeholder="(416) 555-0100"
                    />
                  </IconField>
                </div>
              )}

              <IconField icon={Mail} label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@northpay.ca" />
              </IconField>

              {mode !== "forgot" && (
                <IconField icon={Lock} label="Password">
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="••••••••" />
                </IconField>
              )}

              {mode === "signup" && (
                <IconField icon={Lock} label="Confirm password">
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    aria-invalid={confirmPassword.length > 0 && confirmPassword !== password}
                  />
                </IconField>
              )}

              {mode === "login" && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => switchMode("forgot")} className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                    Forgot password?
                  </button>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12.5px] font-medium text-destructive duration-200 animate-in fade-in">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              )}

              {mode === "forgot" && resetSent && (
                <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-[12.5px] text-success duration-200 animate-in fade-in">
                  <p className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Reset link sent — check your email.
                  </p>
                  <p className="mt-1 text-[11.5px] opacity-80">
                    From noreply@thenorthpay.com · link expires in 1 hour. Check
                    spam if you don&rsquo;t see it.
                  </p>
                </div>
              )}

              {!resetSent && (
                <Button type="submit" disabled={busy} className="mt-2 w-full">
                  {busy ? "Please wait…" : mode === "login" ? "Log in" : mode === "signup" ? "Create account" : "Send reset link"}
                </Button>
              )}

              {mode === "forgot" && (
                <button type="button" onClick={() => switchMode("login")} className="block w-full pt-1 text-center text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                  ← Back to log in
                </button>
              )}
            </form>
          </div>
        )}
      </section>
    </div>
  );
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative rounded-full px-3 py-1.5 transition-colors duration-200",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <span className="absolute inset-0 rounded-full bg-background shadow-soft" />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

function IconField({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="flex items-center gap-1.5 text-[11.5px]">
        <Icon className="h-3 w-3 text-muted-foreground" />
        {label}
      </Label>
      {children}
    </div>
  );
}
