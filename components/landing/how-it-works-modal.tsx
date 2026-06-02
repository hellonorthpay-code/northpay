"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, type MotionValue } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  X,
  Users,
  Clock,
  Play,
  FileText,
  Calculator,
  Award,
  Check,
} from "lucide-react";
import Link from "next/link";

/*
 * ─── HowItWorksModal ─────────────────────────────────────────────────────
 *
 * Triggered by the hero's "See how it works" button. A full-viewport
 * backdrop-blurred sheet shows six interactive steps:
 *
 *   01 · Add employees
 *   02 · Add hours
 *   03 · Run payroll
 *   04 · Generate paystubs
 *   05 · Calculate remittance
 *   06 · Generate T4 slips
 *
 * Each step has:
 *   • a left side with eyebrow + step title + lead copy + bullet points
 *   • a right side with a unique mini-visualization that animates on enter
 *
 * Interactions:
 *   • Next / Back buttons
 *   • Clickable progress dots to jump to any step
 *   • ← → arrow keys to move between steps
 *   • Esc to close
 *   • Body scroll is locked while the modal is open
 *   • Final step's Next becomes a "Start tracking →" link to /dashboard
 *
 * Theme-aware: uses bg-background / text-foreground / border-border so the
 * modal lands correctly in both light and dark mode.
 * ─────────────────────────────────────────────────────────────────────────
 */

const EASE = [0.22, 1, 0.36, 1] as const;

type Step = {
  id: string;
  number: string;
  icon: typeof Users;
  title: string;
  Visual: React.FC;
};

// Title + visualization only. No lead copy, no bullets — the per-step mini
// mock-up communicates the entire step on its own.
const STEPS: Step[] = [
  {
    id: "employees",
    number: "01",
    icon: Users,
    title: "Add your team",
    Visual: EmployeesVisual,
  },
  {
    id: "hours",
    number: "02",
    icon: Clock,
    title: "Log this period",
    Visual: HoursVisual,
  },
  {
    id: "run",
    number: "03",
    icon: Play,
    title: "Run payroll",
    Visual: RunPayrollVisual,
  },
  {
    id: "paystubs",
    number: "04",
    icon: FileText,
    title: "Send paystubs",
    Visual: PaystubsVisual,
  },
  {
    id: "remittance",
    number: "05",
    icon: Calculator,
    title: "File your PD7A",
    Visual: RemittanceVisual,
  },
  {
    id: "t4",
    number: "06",
    icon: Award,
    title: "Ship year-end T4s",
    Visual: T4Visual,
  },
];

export function HowItWorksModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);

  // Reset to step 0 each time the modal opens.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  // Keyboard navigation: Esc to close, ← → to step.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight")
        setStep((s) => Math.min(STEPS.length - 1, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Only portal on the client. Render via document.body so the modal escapes
  // any transformed ancestor (the route PageTransition wrapper applies a
  // transform, which would otherwise trap `position: fixed` and stop the
  // modal from covering the viewport — making it look like the button is
  // "not working").
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: EASE }}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl"
          onClick={onClose}
        >
          <div
            className="absolute inset-0 grid place-items-center overflow-y-auto p-4 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="relative w-full max-w-5xl rounded-[28px] border border-border bg-background p-7 shadow-2xl md:p-11"
              role="dialog"
              aria-modal="true"
              aria-label="How NorthPay works"
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Progress dots only — kept on the LEFT so they don't sit
                  under the absolute-positioned close (X) at top-right. */}
              <div className="mb-8 flex">
                <ProgressDots
                  current={step}
                  total={STEPS.length}
                  onSelect={setStep}
                />
              </div>

              {/* Step content — text on left, visualization on right.
                  Tight layout: title + one-line lead only; the visual does
                  the heavy lifting and now takes the larger slice (1.25fr). */}
              <div className="grid gap-10 md:grid-cols-[0.85fr_1.15fr] md:gap-14">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.id + "-text"}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="flex flex-col pt-2"
                  >
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      <current.icon className="h-3.5 w-3.5" />
                      Step {current.number}
                    </div>
                    {/* flex-1 fills the gap between the STEP pill and the
                        column's bottom edge, with the title centred in it
                        — sits visually between the pill and the Back button. */}
                    <div className="flex flex-1 items-center">
                      <h3
                        className="text-balance text-[clamp(2rem,3.8vw,3rem)] font-semibold text-foreground"
                        style={{ lineHeight: 1.04, letterSpacing: "-0.02em" }}
                      >
                        {current.title}
                      </h3>
                    </div>
                  </motion.div>
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.id + "-visual"}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="relative grid min-h-[320px] place-items-center overflow-hidden rounded-2xl border border-border bg-muted/40 p-6 md:min-h-[340px]"
                  >
                    <current.Visual />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer: Back · keyboard hint · Next / Start tracking */}
              <div className="mt-10 flex items-center justify-between gap-3">
                <button
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-2 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-muted/60"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>

                {isLast ? (
                  <Link
                    href="/dashboard"
                    onClick={onClose}
                    className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
                  >
                    Start tracking
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <button
                    onClick={() =>
                      setStep((s) => Math.min(STEPS.length - 1, s + 1))
                    }
                    className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
                  >
                    Next
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ─── Progress dots ───────────────────────────────────────────────────────
function ProgressDots({
  current,
  total,
  onSelect,
}: {
  current: number;
  total: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          aria-label={`Go to step ${i + 1}`}
          className={
            "h-1.5 rounded-full transition-all duration-300 " +
            (i === current
              ? "w-8 bg-foreground"
              : i < current
              ? "w-1.5 bg-foreground/50 hover:bg-foreground/70"
              : "w-1.5 bg-foreground/15 hover:bg-foreground/30")
          }
        />
      ))}
    </div>
  );
}

// ─── Per-step mini-visualizations ────────────────────────────────────────
const stagger = (i: number, base = 0.1, gap = 0.12) => base + i * gap;

function EmployeesVisual() {
  const people = [
    {
      name: "Jordan Bell",
      role: "Engineering · ON",
      tone: "from-slate-700 to-slate-400 dark:from-rose-300 dark:to-amber-200",
    },
    {
      name: "Priya Sharma",
      role: "Operations · BC",
      tone: "from-slate-700 to-slate-400 dark:from-sky-300 dark:to-emerald-200",
    },
    {
      name: "Liam Tremblay",
      role: "Design · AB",
      tone: "from-slate-700 to-slate-400 dark:from-indigo-300 dark:to-sky-200",
    },
  ];
  return (
    <div className="w-full space-y-2.5">
      {people.map((p, i) => (
        <motion.div
          key={p.name}
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: stagger(i), duration: 0.5, ease: EASE }}
          className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 shadow-sm"
        >
          <div
            className={`grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br ${p.tone} text-[11px] font-semibold text-white`}
          >
            {p.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium tracking-tight text-foreground">
              {p.name}
            </p>
            <p className="text-[10.5px] text-muted-foreground">{p.role}</p>
          </div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Ready
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function HoursVisual() {
  const rows = [
    { name: "Jordan", reg: 80, ot: 4, bonus: "—", stat: "—" },
    { name: "Priya", reg: 72, ot: 0, bonus: "$250", stat: "8h" },
    { name: "Liam", reg: 80, ot: 0, bonus: "—", stat: "—" },
  ];
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-background">
      <div className="grid grid-cols-[1fr_46px_36px_56px_46px] gap-3 border-b border-border bg-muted/60 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <span>Employee</span>
        <span className="text-right">Reg</span>
        <span className="text-right">OT</span>
        <span className="text-right">Bonus</span>
        <span className="text-right">Stat</span>
      </div>
      {rows.map((r, i) => (
        <motion.div
          key={r.name}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: stagger(i, 0.15), duration: 0.5 }}
          className="grid grid-cols-[1fr_46px_36px_56px_46px] gap-3 border-b border-border/50 px-4 py-3 text-[12.5px] text-foreground/85 last:border-b-0"
        >
          <span className="font-medium">{r.name}</span>
          <span className="text-right tabular-nums">{r.reg}</span>
          <span className="text-right tabular-nums">{r.ot}</span>
          <span className="text-right tabular-nums">{r.bonus}</span>
          <span className="text-right tabular-nums">{r.stat}</span>
        </motion.div>
      ))}
    </div>
  );
}

function RunPayrollVisual() {
  return (
    <div className="flex w-full flex-col items-center gap-7">
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{
          scale: [1, 1.04, 1],
          opacity: 1,
        }}
        transition={{
          opacity: { duration: 0.4 },
          scale: { duration: 2.2, repeat: Infinity, ease: "easeInOut" },
        }}
        className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-7 py-3.5 text-[14px] font-medium text-emerald-700 dark:text-emerald-300"
      >
        <Play className="h-3.5 w-3.5 fill-current" />
        Run payroll
      </motion.div>

      <div className="flex w-full flex-col items-center gap-1.5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Processed
        </p>
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5, ease: EASE }}
          className="text-[34px] font-semibold tracking-tightest tabular-nums text-foreground"
          style={{ letterSpacing: "-0.025em" }}
        >
          $8,945.16
        </motion.p>
        <p className="text-[11px] text-muted-foreground">
          3 employees · CRA-compliant for 2026
        </p>
      </div>
    </div>
  );
}

function PaystubsVisual() {
  const sheets = [
    { name: "Jordan Bell", net: "$2,610.63" },
    { name: "Priya Sharma", net: "$2,295.48" },
    { name: "Sage MacKenzie", net: "$827.37" },
  ];
  return (
    <div className="relative flex h-[230px] w-full items-center justify-center">
      {sheets.map((s, i) => (
        <motion.div
          key={s.name}
          initial={{ opacity: 0, y: 24, rotate: 0 }}
          animate={{
            opacity: 1,
            y: 0,
            rotate: (i - 1) * 5,
            x: (i - 1) * 14,
          }}
          transition={{
            delay: stagger(i, 0.1, 0.14),
            duration: 0.55,
            ease: EASE,
          }}
          style={{ zIndex: 3 - i }}
          className="absolute w-[190px] rounded-xl border border-border bg-background p-4 shadow-md"
        >
          <p className="text-[8.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Paystub
          </p>
          <p className="mt-1 text-[12px] font-semibold tracking-tight text-foreground">
            {s.name}
          </p>
          <p className="text-[9.5px] text-muted-foreground">Apr 14 → Apr 27</p>
          <div className="mt-3 space-y-1.5">
            <div className="h-1 w-3/4 rounded-full bg-foreground/15" />
            <div className="h-1 w-1/2 rounded-full bg-foreground/10" />
            <div className="h-1 w-2/3 rounded-full bg-foreground/10" />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[8.5px] uppercase tracking-wider text-muted-foreground">
              Net
            </span>
            <span className="text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {s.net}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function RemittanceVisual() {
  const rows = [
    { label: "Federal tax", value: "$1,420.55" },
    { label: "Provincial tax", value: "$640.10" },
    { label: "CPP × 2", value: "$680.96" },
    { label: "EI × 2.4", value: "$183.39" },
  ];
  return (
    <div className="w-full rounded-2xl border border-border bg-background p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Next PD7A · April
        </p>
        <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
          Due May 15
        </p>
      </div>
      <p className="mt-2 text-[34px] font-semibold tracking-tightest tabular-nums text-foreground">
        $2,925.00
      </p>
      <div className="mt-5 space-y-1.5">
        {rows.map((r, i) => (
          <motion.div
            key={r.label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: stagger(i, 0.18, 0.08),
              duration: 0.4,
              ease: EASE,
            }}
            className="flex items-center justify-between text-[12.5px] text-foreground/70"
          >
            <span>{r.label}</span>
            <span className="font-medium tabular-nums text-foreground">
              {r.value}
            </span>
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="mt-5 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11.5px] font-medium text-emerald-700 dark:text-emerald-300"
      >
        <span>Mark as remitted</span>
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </motion.div>
    </div>
  );
}

function T4Visual() {
  const boxes = [
    { code: "14", label: "Employment income", value: "78,000.00" },
    { code: "16", label: "Employee CPP", value: "4,230.45" },
    { code: "18", label: "Employee EI", value: "1,123.07" },
    { code: "22", label: "Income tax", value: "13,847.32" },
    { code: "24", label: "Insurable", value: "68,900.00" },
    { code: "26", label: "Pensionable", value: "74,600.00" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE }}
      className="w-full rounded-xl border border-border bg-white p-4 text-slate-900 shadow-md"
    >
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">
            T4 · Statement of remuneration paid · 2026
          </p>
          <p className="text-[8px] uppercase tracking-[0.18em] text-slate-500">
            État de la rémunération payée
          </p>
        </div>
        <div className="rounded border border-slate-300 px-1.5 py-0.5 text-[8px] font-semibold text-slate-600">
          T4(24)
        </div>
      </div>
      <p className="mt-3 text-[10px] text-slate-600">Jordan Bell · SIN ••• 482</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {boxes.map((b, i) => (
          <motion.div
            key={b.code}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: stagger(i, 0.2, 0.06),
              duration: 0.35,
              ease: EASE,
            }}
            className="rounded border border-slate-200 bg-slate-50 p-2"
          >
            <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-600">
              Box {b.code}
            </p>
            <p className="mt-0.5 text-[8.5px] text-slate-500">{b.label}</p>
            <p className="mt-1 text-[10.5px] font-semibold tabular-nums">
              {b.value}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
