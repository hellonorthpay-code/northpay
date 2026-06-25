"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Lock, Mail, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/store/auth";
import { useWelcome } from "@/lib/store/welcome";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup" | "forgot";

const ease = [0.22, 1, 0.36, 1] as const;

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
          // Email confirmation required — can't sign them in yet.
          setAwaitingConfirmation(true);
        } else {
          // Signed in straight away → welcome overlay, then into the app.
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
    <>
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        {/* The card owns the ONE entrance animation for the home→login
            transition — a calm rise + settle + fade. The dashboard layout
            paints its chrome instantly (no wrapper/page fade on this route),
            so this is the only motion and nothing flickers against it.

            No `layout` prop here: it locks an explicit pixel height, and when
            mismeasured (mobile) `overflow-hidden` clips the form. Letting the
            card size to its content avoids that; inner field height animations
            still give a smooth login↔signup resize. */}
        <motion.section
          // Opacity + a small rise only — NO scale. Animating `scale` on a
          // backdrop-blurred element forces the mobile GPU to re-rasterize the
          // blur every frame, which is what made the entrance lag on phones.
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease }}
          className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-6 shadow-soft backdrop-blur-xl md:p-8"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-rose-200/30 blur-3xl dark:bg-rose-500/10" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-500/10" />

          <AnimatePresence mode="wait" initial={false}>
            {awaitingConfirmation ? (
              <motion.div
                key="confirm-email"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98, y: -8 }}
                transition={{ duration: 0.4, ease }}
                className="relative text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.1 }}
                  className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-success/15"
                >
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </motion.div>

                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Almost there
                </p>
                <p className="mt-2 text-[22px] font-semibold leading-tight tracking-tightest">
                  Check your email
                </p>
                <p className="mx-auto mt-2 max-w-[280px] text-[13.5px] leading-relaxed text-muted-foreground">
                  We sent a confirmation link to{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                  Click it, then log in.
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
              </motion.div>
            ) : (
              <motion.div
                key="form-shell"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease }}
                className="relative"
              >
                {/* Logo + title */}
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-foreground text-background">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                      <path d="M3 13V3l10 10V3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.p
                        key={`eyebrow-${mode}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18, ease }}
                        className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
                      >
                        {mode === "forgot" ? "Recover" : "Welcome"}
                      </motion.p>
                    </AnimatePresence>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.p
                        key={`title-${mode}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.22, ease }}
                        className="truncate text-[20px] font-semibold leading-none tracking-tightest md:text-[22px]"
                      >
                        {mode === "login" ? "Log in to NorthPay" : mode === "signup" ? "Create your account" : "Reset your password"}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Mode toggle — shared layoutId on the active pill */}
                {mode !== "forgot" && (
                  <div className="mt-5 grid grid-cols-2 gap-1 rounded-full border border-border/60 bg-muted/40 p-1 text-[12.5px] font-medium">
                    <ModeTab active={mode === "login"} onClick={() => switchMode("login")}>Log in</ModeTab>
                    <ModeTab active={mode === "signup"} onClick={() => switchMode("signup")}>Sign up</ModeTab>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={submit} className="mt-5 space-y-3">
                  <AnimatePresence initial={false}>
                    {mode === "signup" && (
                      <motion.div
                        key="signup-fields"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          height: { duration: 0.32, ease },
                          opacity: { duration: 0.22, ease, delay: 0.05 },
                        }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="space-y-3 pb-3">
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
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <IconField icon={Mail} label="Email">
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@northpay.ca" />
                  </IconField>

                  <AnimatePresence initial={false}>
                    {mode !== "forgot" && (
                      <motion.div
                        key="password-field"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          height: { duration: 0.28, ease },
                          opacity: { duration: 0.2, ease },
                        }}
                        style={{ overflow: "hidden" }}
                      >
                        <IconField icon={Lock} label="Password">
                          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="••••••••" />
                        </IconField>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Confirm password — sign-up only, so the password is entered twice. */}
                  <AnimatePresence initial={false}>
                    {mode === "signup" && (
                      <motion.div
                        key="confirm-password-field"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          height: { duration: 0.28, ease },
                          opacity: { duration: 0.2, ease },
                        }}
                        style={{ overflow: "hidden" }}
                      >
                        <IconField icon={Lock} label="Confirm password">
                          <Input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            autoComplete="new-password"
                            placeholder="••••••••"
                            aria-invalid={
                              confirmPassword.length > 0 && confirmPassword !== password
                            }
                          />
                        </IconField>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {mode === "login" && (
                    <div className="flex justify-end">
                      <button type="button" onClick={() => switchMode("forgot")} className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                        Forgot password?
                      </button>
                    </div>
                  )}

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
                    {mode === "forgot" && resetSent && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22, ease }}
                        className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-[12.5px] text-success"
                      >
                        <p className="flex items-center gap-2 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Reset link sent — check your email.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

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
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </div>
    </>
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
        <motion.span
          layoutId="auth-mode-tab"
          transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.7 }}
          className="absolute inset-0 rounded-full bg-background shadow-soft"
        />
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

