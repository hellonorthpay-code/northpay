"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Phone, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/store/profile";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * First-login onboarding. Shown once for new accounts (typically Google
 * sign-ups, where we have an email but no first/last name yet). Captures
 * the name + optional phone with a celebratory entrance, then drops the
 * user into the dashboard.
 */
export function WelcomeView() {
  const router = useRouter();
  const setProfile = useProfile((s) => s.setProfile);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  // Prefill from Google metadata if present
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/dashboard/profile");
        return;
      }
      const m = user.user_metadata ?? {};
      setFirstName(m.given_name || m.first_name || (m.name ? String(m.name).split(" ")[0] : "") || "");
      setLastName(m.family_name || m.last_name || (m.name ? String(m.name).split(" ").slice(1).join(" ") : "") || "");
      setReady(true);
    })();
  }, [router]);

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) return;
    setBusy(true);
    await setProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
    });
    router.replace("/dashboard");
  }

  // Confetti positions — deterministic so SSR + client match
  const confetti = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        id: i,
        x: (i / 14) * 100,
        delay: (i % 7) * 0.06,
        hue: ["bg-rose-400", "bg-sky-400", "bg-amber-400", "bg-emerald-400", "bg-violet-400"][i % 5],
        size: 6 + (i % 3) * 3,
      })),
    []
  );

  return (
    <div className="relative flex min-h-[calc(100vh-120px)] items-center justify-center overflow-hidden px-4">
      {/* Background orbs */}
      <div className="pointer-events-none absolute -left-40 top-10 h-[420px] w-[420px] rounded-full bg-rose-300/20 blur-[100px]" />
      <div className="pointer-events-none absolute -right-40 bottom-10 h-[420px] w-[420px] rounded-full bg-sky-300/20 blur-[100px]" />

      {/* Confetti burst */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-full">
        {confetti.map((c) => (
          <motion.span
            key={c.id}
            initial={{ y: -40, opacity: 0, rotate: 0 }}
            animate={{ y: ["-5%", "60%"], opacity: [0, 1, 1, 0], rotate: 360 }}
            transition={{ duration: 2.4, delay: c.delay, ease: "easeIn", repeat: Infinity, repeatDelay: 1.6 }}
            className={`absolute rounded-[2px] ${c.hue}`}
            style={{ left: `${c.x}%`, width: c.size, height: c.size }}
          />
        ))}
      </div>

      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/70 bg-card/85 p-7 shadow-pop backdrop-blur-xl md:p-8"
      >
        {/* Celebration badge */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.15 }}
          className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-foreground to-foreground/70 text-background shadow-soft dark:from-white dark:to-white/80 dark:text-black"
        >
          <Sparkles className="h-7 w-7" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease, delay: 0.28 }}
          className="text-center"
        >
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            You're in 🎉
          </p>
          <h1 className="mt-2 text-[24px] font-semibold tracking-tightest md:text-[28px]">
            Welcome to NorthPay
          </h1>
          <p className="mx-auto mt-2 max-w-[320px] text-[13.5px] leading-relaxed text-muted-foreground">
            Let's set up your profile. This is how you'll appear across the app.
          </p>
        </motion.div>

        {ready && (
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: 0.4 }}
            onSubmit={finish}
            className="mt-6 space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <Field icon={User} label="First name">
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
              </Field>
              <Field icon={User} label="Last name">
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </Field>
            </div>
            <Field icon={Phone} label="Phone (optional)">
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(416) 555-0100" />
            </Field>

            <Button type="submit" disabled={busy || !firstName.trim()} className="mt-2 w-full">
              {busy ? "Setting up…" : "Continue to dashboard"}
              {!busy && <ArrowRight className="h-4 w-4" />}
            </Button>
          </motion.form>
        )}
      </motion.section>
    </div>
  );
}

function Field({
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
