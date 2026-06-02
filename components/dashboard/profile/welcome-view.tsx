"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Phone, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";
import { useProfile } from "@/lib/store/profile";
import { PingPongVideo } from "@/components/ui/ping-pong-video";

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
  /** "form" while collecting details, "celebrating" during the success splash. */
  const [phase, setPhase] = useState<"form" | "celebrating">("form");

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
    // Celebrate, then hard-navigate into the app. A full load (rather than
    // a soft router.replace) guarantees /dashboard mounts fresh — the
    // celebration screen's video/canvas work is fully torn down first, so
    // there's no transient client-side exception on the dashboard.
    setPhase("celebrating");
    setTimeout(() => {
      // Go straight to the employees page (skip the /dashboard redirect hop).
      window.location.assign("/dashboard/employees");
    }, 2600);
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
      {/* ── Looping ping-pong video backdrop — full viewport, fixed ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <PingPongVideo
          src="https://videos.pexels.com/video-files/34645692/14684158_2560_1440_30fps.mp4"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 0.9 }}
        />
        {/* Light scrim only behind the card area for legibility — the rest
            of the video stays fully visible edge to edge. */}
        <div className="absolute inset-0 bg-background/10" />
      </div>

      {/* Confetti burst */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-full">
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
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border/70 bg-card/85 p-7 shadow-pop backdrop-blur-xl md:p-8"
      >
        <AnimatePresence mode="wait">
          {phase === "form" ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3, ease }}
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
                  Almost there
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
                    {busy ? "Setting up…" : "Continue"}
                    {!busy && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </motion.form>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="celebrate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35, ease }}
              className="flex flex-col items-center py-6 text-center"
            >
              {/* Check burst — concentric rings + spring-in check */}
              <div className="relative mb-6 grid h-24 w-24 place-items-center">
                {[0, 0.18, 0.36].map((d, i) => (
                  <motion.span
                    key={i}
                    initial={{ scale: 0.4, opacity: 0.5 }}
                    animate={{ scale: 2.4, opacity: 0 }}
                    transition={{ duration: 1.4, delay: d, ease: "easeOut", repeat: Infinity, repeatDelay: 0.4 }}
                    className="absolute h-20 w-20 rounded-full border-2 border-success/50"
                  />
                ))}
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
                  className="relative grid h-20 w-20 place-items-center rounded-full bg-success text-success-foreground shadow-[0_0_50px_-6px_hsl(var(--success)/0.6)]"
                >
                  <motion.span
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Check className="h-10 w-10" strokeWidth={3} />
                  </motion.span>
                </motion.div>
              </div>

              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease, delay: 0.35 }}
                className="text-[26px] font-semibold tracking-tightest md:text-[30px]"
              >
                You're all set, {firstName.trim() || "there"}! 🎉
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease, delay: 0.5 }}
                className="mx-auto mt-2 max-w-[300px] text-[13.5px] leading-relaxed text-muted-foreground"
              >
                Your NorthPay account is ready. Taking you to your dashboard…
              </motion.p>

              {/* Loading shimmer bar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-muted"
              >
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 1.8, ease: "easeInOut", delay: 0.7 }}
                  className="h-full w-full rounded-full bg-gradient-to-r from-transparent via-foreground to-transparent dark:via-white"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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
