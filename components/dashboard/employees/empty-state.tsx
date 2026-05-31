"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Clock, Plus, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

const ease = [0.22, 1, 0.36, 1] as const;

interface Props {
  /** Called with the viewport-space centre of the CTA so the AddEmployee
      modal can swell out of the exact pixel the user tapped. */
  onAdd: (origin: { x: number; y: number }) => void;
}

/**
 * First-run hero shown when the operator has zero employees on file.
 *
 * Vocabulary borrowed straight from the rest of NorthPay:
 *   • rounded-3xl glass card with rose/sky background orbs
 *   • iOS easing curve, soft springy bobs
 *
 * Visual story: three avatar bubbles bobbing in an arc, the middle one
 * is a tappable "+" slot wrapped in two concentric ripple rings. Below it
 * a step counter signals how short the onboarding actually is so the
 * user feels like clicking is safe.
 */
export function EmployeesEmpty({ onAdd }: Props) {
  const ctaRef = useRef<HTMLButtonElement>(null);
  const heroCtaRef = useRef<HTMLButtonElement>(null);

  function fireOrigin(ref: React.RefObject<HTMLElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onAdd({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease }}
      className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 px-6 py-12 text-center shadow-soft backdrop-blur-xl md:px-10 md:py-16"
    >
      {/* Background orbs — same vocabulary as PayrollView summary */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-rose-200/35 blur-3xl dark:bg-rose-500/15" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-sky-200/35 blur-3xl dark:bg-sky-500/15" />

      <div className="relative mx-auto max-w-md">
        {/* ── Floating trio ── */}
        <div className="relative mx-auto flex h-40 w-72 items-end justify-center md:h-48 md:w-80">
          {/* Left placeholder avatar */}
          <FloatingAvatar
            className="absolute bottom-2 left-3 h-14 w-14 bg-gradient-to-br from-rose-300 to-amber-200 dark:from-rose-300 dark:to-amber-200"
            delay={0}
            duration={3.6}
            travel={8}
          >
            <span className="text-[14px] font-semibold text-white drop-shadow">A</span>
          </FloatingAvatar>

          {/* Right placeholder avatar */}
          <FloatingAvatar
            className="absolute bottom-2 right-3 h-14 w-14 bg-gradient-to-br from-sky-300 to-emerald-200 dark:from-sky-300 dark:to-emerald-200"
            delay={0.7}
            duration={4.2}
            travel={10}
          >
            <span className="text-[14px] font-semibold text-white drop-shadow">M</span>
          </FloatingAvatar>

          {/* Centre: the tappable add-slot with concentric pulse rings */}
          <motion.button
            ref={heroCtaRef}
            type="button"
            onClick={() => fireOrigin(heroCtaRef)}
            aria-label="Add your first employee"
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.25 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            className="relative grid h-24 w-24 place-items-center rounded-[28px] bg-foreground text-background shadow-pop transition-shadow hover:shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45)] dark:bg-white dark:text-black md:h-28 md:w-28"
          >
            <Plus className="h-9 w-9 md:h-10 md:w-10" strokeWidth={2.4} />

            {/* Ripple rings (looping) */}
            <PulseRing delay={0} />
            <PulseRing delay={1.1} />

            {/* Sparkle pin */}
            <motion.span
              animate={{ rotate: [0, 12, 0, -12, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-success text-success-foreground shadow-soft"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </motion.span>
          </motion.button>
        </div>

        {/* ── Copy ── */}
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease, delay: 0.15 }}
          className="mt-8 text-[24px] font-semibold tracking-tightest md:text-[28px]"
        >
          Build your team
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease, delay: 0.22 }}
          className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-muted-foreground md:text-[14px]"
        >
          Add your first employee to start tracking pay, taxes, and time off.
          Everything you enter stays on this device until you run payroll.
        </motion.p>

        {/* ── Primary CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease, delay: 0.3 }}
          className="mt-6"
        >
          <Button
            ref={ctaRef}
            size="lg"
            onClick={() => fireOrigin(ctaRef)}
            className="px-6"
          >
            <Plus className="h-4 w-4" />
            Add your first employee
          </Button>
        </motion.div>

        {/* ── Three-step hint ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease, delay: 0.45 }}
          className="mx-auto mt-8 flex max-w-sm items-center justify-between gap-1 rounded-2xl border border-border/60 bg-background/40 px-3 py-2.5"
        >
          <Step icon={Sparkles} label="Identity" />
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <Step icon={Wallet} label="Pay & hours" />
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <Step icon={Clock} label="~1 min" />
        </motion.div>
      </div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Floating avatar bubble — gentle infinite y bob, staggered by `delay`.
// ─────────────────────────────────────────────────────────────────────────
function FloatingAvatar({
  className,
  delay,
  duration,
  travel,
  children,
}: {
  className?: string;
  delay: number;
  duration: number;
  travel: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      animate={{ y: [0, -travel, 0] }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
      className={`grid place-items-center rounded-2xl shadow-pop ${className ?? ""}`}
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Continuous outward ripple from the central CTA. Two staggered instances
// give the classic Apple "active beacon" feel.
// ─────────────────────────────────────────────────────────────────────────
function PulseRing({ delay }: { delay: number }) {
  return (
    <motion.span
      initial={{ scale: 1, opacity: 0.4 }}
      animate={{ scale: 1.7, opacity: 0 }}
      transition={{
        duration: 2.2,
        repeat: Infinity,
        ease: "easeOut",
        delay,
      }}
      className="pointer-events-none absolute inset-0 rounded-[28px] border border-foreground/40 dark:border-white/50"
    />
  );
}

function Step({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
