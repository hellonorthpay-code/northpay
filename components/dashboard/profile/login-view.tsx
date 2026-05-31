"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_CREDENTIALS, useAuth } from "@/lib/store/auth";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

const ease = [0.22, 1, 0.36, 1] as const;

export function LoginView() {
  const login = useAuth((s) => s.login);
  const signup = useAuth((s) => s.signup);
  const loginWithGoogle = useAuth((s) => s.loginWithGoogle);

  const [mode, setMode] = useState<Mode>("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result =
      mode === "login"
        ? login(email, password)
        : signup({ firstName, lastName, email, password });
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      {/* ── Hero card ── */}
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-6 shadow-soft backdrop-blur-xl md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-rose-200/30 blur-3xl dark:bg-rose-500/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-500/10" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-foreground text-background">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 13V3l10 10V3"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Welcome
              </p>
              <p className="text-[20px] font-semibold leading-none tracking-tightest md:text-[24px]">
                {mode === "login" ? "Log in to NorthPay" : "Create your account"}
              </p>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-full border border-border/60 bg-muted/40 p-1 text-[12.5px] font-medium">
            <ModeTab active={mode === "login"} onClick={() => { setMode("login"); setError(null); }}>
              Log in
            </ModeTab>
            <ModeTab active={mode === "signup"} onClick={() => { setMode("signup"); setError(null); }}>
              Sign up
            </ModeTab>
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={loginWithGoogle}
            className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-[13.5px] font-medium tracking-tight text-foreground transition-colors hover:bg-muted/40"
          >
            <GoogleIcon className="h-4 w-4" />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="mt-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="h-px flex-1 bg-border/60" />
            <span>or</span>
            <span className="h-px flex-1 bg-border/60" />
          </div>

          {/* Form */}
          <form onSubmit={submit} className="mt-5 space-y-3">
            <AnimatePresence initial={false} mode="wait">
              {mode === "signup" && (
                <motion.div
                  key="names"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease }}
                  style={{ overflow: "hidden" }}
                >
                  <div className="grid grid-cols-2 gap-3 pb-3">
                    <IconField icon={User} label="First name">
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        autoComplete="given-name"
                      />
                    </IconField>
                    <IconField icon={User} label="Last name">
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        autoComplete="family-name"
                      />
                    </IconField>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <IconField icon={Mail} label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@northpay.ca"
              />
            </IconField>
            <IconField icon={Lock} label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="••••••••"
              />
            </IconField>

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

            <Button type="submit" disabled={busy} className="mt-2 w-full">
              {mode === "login" ? "Log in" : "Create account"}
            </Button>
          </form>
        </div>
      </section>

      {/* ── Demo credentials hint ── */}
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4 text-[12px] leading-relaxed text-muted-foreground">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
          Sample admin
        </p>
        <p className="mt-1.5">
          Email <span className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">{ADMIN_CREDENTIALS.email}</span>
          <br />
          Password <span className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">{ADMIN_CREDENTIALS.password}</span>
        </p>
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 transition-all duration-200",
        active
          ? "bg-background text-foreground shadow-soft"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function IconField({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
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
