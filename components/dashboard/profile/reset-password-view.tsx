"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/store/auth";

const ease = [0.22, 1, 0.36, 1] as const;

export function ResetPasswordView() {
  const router = useRouter();
  const params = useSearchParams();
  const presetEmail = params?.get("email") ?? "";

  const resetPassword = useAuth((s) => s.resetPassword);
  const hydrateAuth = useAuth((s) => s.hydrate);

  const [email, setEmail] = useState(presetEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    const result = resetPassword(email, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
    // Bounce back to login after a beat so the success state can land.
    setTimeout(() => router.replace("/dashboard/profile"), 1400);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-6 shadow-soft backdrop-blur-xl md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-rose-200/30 blur-3xl dark:bg-rose-500/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-500/10" />

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
                Choose something at least 6 characters.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <IconField icon={Mail} label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                readOnly={!!presetEmail}
                className={presetEmail ? "bg-muted/30" : ""}
              />
            </IconField>
            <IconField icon={Lock} label="New password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </IconField>
            <IconField icon={Lock} label="Confirm password">
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
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
              {done && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease }}
                  className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-[12.5px] font-medium text-success"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Password updated. Redirecting…
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" className="mt-2 w-full" disabled={done}>
              Update password
            </Button>
          </form>

          <Link
            href="/dashboard/profile"
            className="mt-3 flex items-center justify-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to log in
          </Link>
        </div>
      </section>
    </div>
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
