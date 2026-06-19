"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Lock, Mail, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/store/auth";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup" | "forgot";

const ease = [0.22, 1, 0.36, 1] as const;

export function LoginView() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const signup = useAuth((s) => s.signup);
  const loginWithGoogle = useAuth((s) => s.loginWithGoogle);
  const requestPasswordReset = useAuth((s) => s.requestPasswordReset);

  const [mode, setMode] = useState<Mode>("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [premiumReveal, setPremiumReveal] = useState(false);

  // After successful signup, auto-flip to login (with email prefilled) after a
  // beat — the success screen plays, then the form slides back in.
  useEffect(() => {
    if (!signupSuccess) return;
    const t = window.setTimeout(() => {
      setSignupSuccess(false);
      switchMode("login");
      setPassword("");
    }, 2400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signupSuccess]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setResetSent(false);
  }

  function isFirstLogin(): boolean {
    if (typeof window === "undefined") return false;
    return !window.localStorage.getItem("northpay:hasLoggedIn");
  }

  function markLoggedIn() {
    try {
      window.localStorage.setItem("northpay:hasLoggedIn", "1");
    } catch {}
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (mode === "login") {
        const result = await login(email, password);
        if (!result.ok) {
          setError(result.error);
        } else {
          // First-time login → play the premium reveal before routing.
          if (isFirstLogin()) {
            markLoggedIn();
            setPremiumReveal(true);
            window.setTimeout(() => {
              router.replace("/dashboard/employees");
            }, 2200);
          } else {
            markLoggedIn();
            router.replace("/dashboard/employees");
          }
        }
        return;
      }

      if (mode === "signup") {
        const result = await signup({ firstName, lastName, email, password, phone });
        if (!result.ok) {
          setError(result.error);
        } else {
          setSignupSuccess(true);
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
      <PremiumReveal show={premiumReveal} />

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
            {signupSuccess ? (
              <motion.div
                key="signup-success"
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

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease, delay: 0.2 }}
                >
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Welcome to NorthPay
                  </p>
                  <p className="mt-2 text-[22px] font-semibold leading-tight tracking-tightest">
                    Account created!
                  </p>
                  <p className="mx-auto mt-2 max-w-[260px] text-[13.5px] leading-relaxed text-muted-foreground">
                    Taking you to log in…
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                  className="mx-auto mt-6 h-1 w-32 overflow-hidden rounded-full bg-muted"
                >
                  <motion.div
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 1.8, ease: "easeInOut", delay: 0.35 }}
                    className="h-full w-full rounded-full bg-gradient-to-r from-transparent via-foreground to-transparent dark:via-white"
                  />
                </motion.div>
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

                {/* Google */}
                {mode !== "forgot" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void loginWithGoogle()}
                      className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-[13.5px] font-medium tracking-tight text-foreground transition-colors hover:bg-muted/40"
                    >
                      <GoogleIcon className="h-4 w-4" />
                      Continue with Google
                    </button>
                    <div className="mt-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      <span className="h-px flex-1 bg-border/60" />
                      <span>or</span>
                      <span className="h-px flex-1 bg-border/60" />
                    </div>
                  </>
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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8a12 12 0 1 1 7.9-21.1l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.8 28L6.2 33A20 20 0 0 0 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C41 35.3 44 30.2 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

/**
 * Apple-style premium reveal shown the very first time a user logs in.
 * A full-bleed dark overlay fades up with the logo, an aurora glow, the
 * brand wordmark, and a thin shimmer bar — held ~2.2s before the router
 * navigates into the dashboard.
 */
function PremiumReveal({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="premium-reveal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease }}
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-[#0a0a0c]"
        >
          {/* Aurora glows */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 0.7, scale: 1 }}
            transition={{ duration: 1.6, ease }}
            className="pointer-events-none absolute -top-1/4 left-1/2 h-[60vh] w-[60vh] -translate-x-1/2 rounded-full bg-rose-500/30 blur-[120px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 0.6, scale: 1 }}
            transition={{ duration: 1.8, ease, delay: 0.1 }}
            className="pointer-events-none absolute -bottom-1/4 right-1/4 h-[55vh] w-[55vh] rounded-full bg-sky-500/25 blur-[120px]"
          />

          <div className="relative flex flex-col items-center">
            {/* Logo with gentle spring-in + breath */}
            <motion.div
              initial={{ scale: 0.4, opacity: 0, filter: "blur(12px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.9, ease }}
              className="grid h-20 w-20 place-items-center rounded-3xl bg-white text-black shadow-[0_20px_80px_-10px_rgba(255,255,255,0.35)]"
            >
              <svg width="34" height="34" viewBox="0 0 16 16" fill="none">
                <path d="M3 13V3l10 10V3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 14, letterSpacing: "0.4em" }}
              animate={{ opacity: 1, y: 0, letterSpacing: "0.02em" }}
              transition={{ duration: 1.0, ease, delay: 0.45 }}
              className="mt-8 text-[28px] font-semibold tracking-tightest text-white md:text-[34px]"
            >
              Welcome to NorthPay
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.95 }}
              className="mt-2 text-[12.5px] uppercase tracking-[0.28em] text-white/55"
            >
              Canadian payroll, finally beautiful
            </motion.p>

            {/* Shimmer bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.25 }}
              className="relative mt-10 h-[2px] w-48 overflow-hidden rounded-full bg-white/10"
            >
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 1.4, ease: "easeInOut", delay: 1.25 }}
                className="h-full w-full bg-gradient-to-r from-transparent via-white to-transparent"
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
