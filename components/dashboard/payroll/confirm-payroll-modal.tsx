"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import { ChevronRight, Mail, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn, formatCAD, formatDate } from "@/lib/utils";
import { type PayrollLineResult } from "@/lib/payroll/types";

const ease = [0.22, 1, 0.36, 1] as const;

type Stage = "confirm" | "calculating" | "success";

export interface ConfirmResult {
  ok: boolean;
  netPaid?: number;
  emailedCount?: number;
}

export interface ConfirmPayrollModalProps {
  open: boolean;
  onClose: () => void;
  /** Performs the actual finalize. Returns ok=false to close modal on error. */
  onConfirm: () => Promise<ConfirmResult>;
  netPay: number;
  period: { periodStart: string; periodEnd: string; payDate: string };
  lines: PayrollLineResult[];
  emailableCount: number;
  emailAfter: boolean;
  onToggleEmail: (next: boolean) => void;
}

export function ConfirmPayrollModal({
  open,
  onClose,
  onConfirm,
  netPay,
  period,
  lines,
  emailableCount,
  emailAfter,
  onToggleEmail,
}: ConfirmPayrollModalProps) {
  const [stage, setStage] = useState<Stage>("confirm");
  const [result, setResult] = useState<{
    netPaid: number;
    emailedCount: number;
  } | null>(null);

  // Reset to confirm whenever modal opens
  useEffect(() => {
    if (open) {
      setStage("confirm");
      setResult(null);
    }
  }, [open]);

  async function handleConfirm() {
    setStage("calculating");

    /*
     * Dynamic visual duration. The per-employee sequence below uses
     * `START_DELAY + lineCount × STAGGER + TAIL` — keep this in sync so
     * the engine call and the animation finish together (whichever takes
     * longer wins via Promise.all).
     *
     * Tuned to feel cinematic, not utilitarian — each row gets a proper
     * "moment" before the next one starts.
     */
    const START_DELAY = 800;
    const STAGGER = 550;
    const TAIL = 1100;
    const visualDuration =
      START_DELAY + Math.max(1, lines.length) * STAGGER + TAIL;

    const [r] = await Promise.all([
      onConfirm(),
      new Promise((res) => setTimeout(res, visualDuration)),
    ]);

    if (r.ok) {
      setResult({
        netPaid: r.netPaid ?? netPay,
        emailedCount: r.emailedCount ?? 0,
      });
      setStage("success");
      setTimeout(onClose, 4000);
    } else {
      // Hand back to the page so it can render validation errors
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-md"
            onClick={stage === "confirm" ? onClose : undefined}
          />
          {/* Centered card */}
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{
                opacity: 1,
                // Gentle 3s breathing during processing — feels alive without
                // being distracting. Goes flat once we hit success.
                scale:
                  stage === "calculating"
                    ? [1, 1.006, 1]
                    : stage === "success"
                    ? [1, 1.015, 1]
                    : 1,
              }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{
                opacity: { duration: 0.35, ease },
                scale:
                  stage === "calculating"
                    ? {
                        duration: 3.6,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }
                    : stage === "success"
                    ? { duration: 0.55, ease, times: [0, 0.4, 1] }
                    : { duration: 0.35, ease },
              }}
              className={cn(
                "pointer-events-auto relative flex max-h-[88vh] w-[min(94vw,460px)] flex-col overflow-hidden rounded-[28px] border border-border bg-background shadow-pop transition-shadow duration-500",
                stage === "success" &&
                  "shadow-[0_0_80px_-12px_hsl(var(--success)/0.45)] border-success/30"
              )}
            >
              <AnimatePresence mode="wait">
                {stage === "confirm" && (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease }}
                  >
                    <ConfirmBody
                      netPay={netPay}
                      period={period}
                      lines={lines}
                      emailableCount={emailableCount}
                      emailAfter={emailAfter}
                      onToggleEmail={onToggleEmail}
                      onClose={onClose}
                      onConfirm={handleConfirm}
                    />
                  </motion.div>
                )}
                {stage === "calculating" && (
                  <motion.div
                    key="calculating"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease }}
                  >
                    <ProcessingSequence lines={lines} />
                  </motion.div>
                )}
                {stage === "success" && result && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease }}
                  >
                    <SuccessBody
                      netPaid={result.netPaid}
                      emailedCount={result.emailedCount}
                      count={lines.length}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Confirm stage
// ─────────────────────────────────────────────────────────────────────────
function ConfirmBody({
  netPay,
  period,
  lines,
  emailableCount,
  emailAfter,
  onToggleEmail,
  onClose,
  onConfirm,
}: {
  netPay: number;
  period: { periodStart: string; periodEnd: string; payDate: string };
  lines: PayrollLineResult[];
  emailableCount: number;
  emailAfter: boolean;
  onToggleEmail: (next: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-5 z-10 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex-1 overflow-y-auto px-6 pb-5 pt-8">
        {/* Headline */}
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Confirm payroll
        </p>
        <p className="mt-3 text-center text-[40px] font-semibold leading-none tracking-tightest tabular-nums">
          {formatCAD(netPay)}
        </p>
        <p className="mt-2.5 text-center text-[12.5px] text-muted-foreground">
          Net to {lines.length} employee{lines.length === 1 ? "" : "s"} · pay
          date {formatDate(period.payDate)}
        </p>
        <p className="mt-1 text-center text-[11.5px] text-muted-foreground/80">
          {formatDate(period.periodStart)} → {formatDate(period.periodEnd)}
        </p>

        {/* Employee list */}
        <div className="mt-6 max-h-[180px] overflow-y-auto rounded-2xl border border-border/60 bg-muted/30">
          <ul className="divide-y divide-border/40">
            {lines.map((line) => (
              <li
                key={line.employeeId}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12.5px]"
              >
                <span className="truncate font-medium tracking-tight">
                  {line.employee.firstName} {line.employee.lastName}
                </span>
                <span className="tabular-nums font-medium">
                  {formatCAD(line.netPay)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Email toggle */}
        <label
          title={
            emailableCount === 0
              ? "No employees have an email yet"
              : "Email paystubs to employees after running"
          }
          className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/40 px-4 py-3 transition-colors duration-200 hover:bg-background/70"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Mail className="h-[16px] w-[16px] shrink-0 text-rose-500" />
            <span className="text-[13px] font-medium tracking-tight">
              Email paystubs
            </span>
          </div>
          <Switch
            checked={emailAfter && emailableCount > 0}
            disabled={emailableCount === 0}
            onCheckedChange={onToggleEmail}
          />
        </label>
      </div>

      {/* Slide-to-confirm */}
      <div className="border-t border-border/40 bg-muted/20 p-5">
        <SlideToConfirm
          label="Slide to run payroll"
          onConfirm={onConfirm}
        />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Slide-to-confirm — iOS slide-to-unlock style
// ─────────────────────────────────────────────────────────────────────────
function SlideToConfirm({
  onConfirm,
  label,
}: {
  onConfirm: () => void;
  label: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [completed, setCompleted] = useState(false);
  const x = useMotionValue(0);
  const THUMB = 48;

  useEffect(() => {
    function measure() {
      if (trackRef.current) {
        setTrackWidth(Math.max(0, trackRef.current.offsetWidth - THUMB - 8));
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const progress = useTransform(x, [0, trackWidth || 1], [0, 1], {
    clamp: true,
  });
  const fillWidth = useTransform(progress, (p) => `${Math.min(p, 1) * 100}%`);
  const labelOpacity = useTransform(progress, [0, 0.5], [1, 0]);
  const labelX = useTransform(progress, [0, 1], [0, 12]);

  function handleDragEnd() {
    if (completed) return;
    const v = x.get();
    if (v >= trackWidth * 0.85) {
      // Confirmed — slam thumb to the end and fire
      animate(x, trackWidth, {
        type: "spring",
        stiffness: 320,
        damping: 30,
      });
      setCompleted(true);
      onConfirm();
    } else {
      animate(x, 0, { type: "spring", stiffness: 320, damping: 30 });
    }
  }

  return (
    <div
      ref={trackRef}
      className={cn(
        "relative h-14 w-full overflow-hidden rounded-full border bg-muted/60 transition-colors duration-500",
        completed ? "border-success/40" : "border-border/60"
      )}
    >
      {/*
        Animated fill. The bar uses CSS transition on `backgroundColor` so
        the dark→success colour swap on completion is smooth, on top of
        Framer's width animation driven by the drag.
      */}
      <motion.div
        style={{ width: fillWidth }}
        className={cn(
          "absolute inset-y-0 left-0 rounded-full transition-colors duration-500",
          completed ? "bg-success" : "bg-foreground"
        )}
      />

      {/* Label — fades + nudges as the thumb covers it */}
      <motion.span
        style={{ opacity: labelOpacity, x: labelX }}
        className="pointer-events-none absolute inset-0 grid place-items-center text-[13.5px] font-medium tracking-tight text-foreground/85"
      >
        {label}
      </motion.span>

      {/*
        Continuous shimmer sweep. Stays visible while idle as a "drag me"
        hint, switches to a brighter, faster sweep once completed so the
        bar reads as actively-doing-something during processing.
      */}
      <motion.span
        aria-hidden
        animate={{ x: ["-30%", "130%"] }}
        transition={{
          duration: completed ? 2.0 : 3.0,
          repeat: Infinity,
          ease: "linear",
        }}
        className={cn(
          "pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent to-transparent",
          completed ? "via-white/40" : "via-foreground/10"
        )}
        style={{ opacity: completed ? 0.9 : 0.6 }}
      />

      {/* One-shot radial pulse from the thumb on completion — "haptic flash" */}
      <AnimatePresence>
        {completed && (
          <motion.span
            key="pulse"
            aria-hidden
            initial={{ scale: 0.4, opacity: 0.65 }}
            animate={{ scale: 2.8, opacity: 0 }}
            transition={{ duration: 1.6, ease }}
            className="pointer-events-none absolute top-1 h-12 w-12 rounded-full bg-success/50"
            style={{ left: `${trackWidth - 4}px` }}
          />
        )}
      </AnimatePresence>

      {/* Thumb */}
      <motion.button
        type="button"
        drag="x"
        dragConstraints={{ left: 0, right: trackWidth }}
        dragElastic={0}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 1.04 }}
        disabled={completed}
        aria-label={label}
        className={cn(
          "absolute left-1 top-1 grid h-12 w-12 cursor-grab place-items-center rounded-full bg-background text-foreground shadow-pop transition-colors duration-300 active:cursor-grabbing",
          completed && "cursor-default text-success"
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {!completed ? (
            <motion.span
              key="chevron"
              initial={{ opacity: 0, rotate: -20 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 20 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="h-5 w-5" />
            </motion.span>
          ) : (
            <motion.span
              key="spinner"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{
                  duration: 0.85,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="block h-4 w-4 rounded-full border-[2px] border-success/30 border-t-success"
              />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Processing stage — cinematic per-employee sequence
//
// Each employee row moves through three states (pending → active → done),
// staggered ~180 ms apart. The transitions are intentionally layered:
//
//   • avatar pulse while active (signals "this one is being processed")
//   • spinner that fades into a drawn checkmark on completion
//   • soft success glow flashes briefly behind the row
//   • amount text recolors to success-green
//   • tiny upward particles emit from each completed row
//   • overall progress bar at top keeps a steady forward motion
//
// Timing constants here MUST match the Promise.all dwell in handleConfirm
// so engine work + animation finish at the same beat.
// ─────────────────────────────────────────────────────────────────────────
const PROCESSING_START_DELAY = 800;
const PROCESSING_STAGGER = 550;

function ProcessingSequence({ lines }: { lines: PayrollLineResult[] }) {
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    setDoneCount(0);
    const timers: ReturnType<typeof setTimeout>[] = [];

    lines.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setDoneCount((prev) => Math.max(prev, i + 1));
        }, PROCESSING_START_DELAY + (i + 1) * PROCESSING_STAGGER)
      );
    });

    return () => timers.forEach((t) => clearTimeout(t));
  }, [lines]);

  const progress = lines.length > 0 ? doneCount / lines.length : 0;

  return (
    <div className="px-6 pb-8 pt-9">
      {/* Headline — shimmering "Generating paystubs…" */}
      <p className="text-center text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Processing payroll
      </p>
      <ShimmerText className="mt-2 block text-center text-[17px] font-semibold tracking-tight">
        Generating paystubs…
      </ShimmerText>

      {/* Overall progress bar */}
      <div className="relative mt-6 h-[3px] w-full overflow-hidden rounded-full bg-muted/60">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-foreground"
          initial={{ width: "0%" }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.45, ease }}
        />
        {/* Travelling shimmer on top of the fill */}
        <motion.div
          aria-hidden
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
          animate={{ x: ["-100%", "300%"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Per-employee rows */}
      <ul className="mt-5 max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
        {lines.map((line, i) => (
          <EmployeeProcessingRow
            key={line.employeeId}
            line={line}
            status={
              i < doneCount ? "done" : i === doneCount ? "active" : "pending"
            }
          />
        ))}
      </ul>

      {/* Footer counter — tabular so digits don't jitter */}
      <p className="mt-5 text-center text-[11.5px] tabular-nums text-muted-foreground">
        <motion.span
          key={doneCount}
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="font-semibold text-foreground"
        >
          {doneCount}
        </motion.span>{" "}
        of {lines.length} paystub{lines.length === 1 ? "" : "s"} generated
      </p>
    </div>
  );
}

/** One employee row inside the cinematic processing sequence. */
function EmployeeProcessingRow({
  line,
  status,
}: {
  line: PayrollLineResult;
  status: "pending" | "active" | "done";
}) {
  const initials = `${line.employee.firstName[0] ?? ""}${
    line.employee.lastName[0] ?? ""
  }`;

  return (
    <motion.li
      layout
      className="relative isolate flex items-center justify-between gap-3 overflow-hidden rounded-xl border px-3 py-2.5"
      initial={false}
      animate={{
        borderColor:
          status === "done"
            ? "hsl(var(--success) / 0.4)"
            : "hsl(var(--border) / 0.5)",
        backgroundColor:
          status === "done"
            ? "hsl(var(--success) / 0.07)"
            : status === "active"
            ? "hsl(var(--muted) / 0.6)"
            : "hsl(var(--muted) / 0.3)",
      }}
      transition={{ duration: 0.45, ease }}
    >
      {/* Soft glow flash on the row when it lands in done state. Uses a key
          so it re-mounts and re-plays on every status flip — fire-and-forget. */}
      <AnimatePresence>
        {status === "done" && (
          <motion.div
            key="glow"
            aria-hidden
            initial={{ opacity: 0.55, scale: 0.85 }}
            animate={{ opacity: 0, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease }}
            className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-success/40 blur-xl"
          />
        )}
      </AnimatePresence>

      <div className="relative flex min-w-0 items-center gap-2.5">
        {/* Avatar — pulses while active */}
        <motion.div
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose-300 via-amber-200 to-sky-300 text-[10px] font-semibold text-white shadow-soft"
          animate={{
            scale: status === "active" ? [1, 1.08, 1] : 1,
            boxShadow:
              status === "active"
                ? [
                    "0 0 0 0 hsl(var(--foreground) / 0)",
                    "0 0 0 6px hsl(var(--foreground) / 0.08)",
                    "0 0 0 0 hsl(var(--foreground) / 0)",
                  ]
                : "0 0 0 0 hsl(var(--foreground) / 0)",
          }}
          transition={{
            duration: 1.6,
            repeat: status === "active" ? Infinity : 0,
            ease: "easeInOut",
          }}
        >
          {initials}
        </motion.div>
        <span
          className={cn(
            "truncate text-[12.5px] font-medium tracking-tight transition-colors duration-500",
            status === "pending" && "text-foreground/55"
          )}
        >
          {line.employee.firstName} {line.employee.lastName}
        </span>
      </div>

      <div className="relative flex shrink-0 items-center gap-2.5">
        {/* Amount — illuminates to success-green on done */}
        <motion.span
          className="text-[12.5px] font-semibold tabular-nums"
          animate={{
            color:
              status === "done"
                ? "hsl(var(--success))"
                : "hsl(var(--foreground))",
            opacity: status === "pending" ? 0.45 : 1,
          }}
          transition={{ duration: 0.45, ease }}
        >
          {formatCAD(line.netPay)}
        </motion.span>

        {/* Status icon — pending dot → active spinner → drawn check */}
        <div className="relative grid h-5 w-5 place-items-center">
          <AnimatePresence mode="wait">
            {status === "pending" && (
              <motion.span
                key="pending"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
              />
            )}
            {status === "active" && (
              <motion.span
                key="active"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.25 }}
              >
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="block h-3.5 w-3.5 rounded-full border-[1.8px] border-foreground/20 border-t-foreground"
                />
              </motion.span>
            )}
            {status === "done" && (
              <motion.span
                key="done"
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="grid h-5 w-5 place-items-center rounded-full bg-success text-success-foreground shadow-soft"
              >
                <svg width="11" height="11" viewBox="0 0 24 24">
                  <motion.path
                    d="M5 13l4 4L19 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.85, ease, delay: 0.12 }}
                  />
                </svg>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tiny upward particles when this row lands in done state */}
      {status === "done" && <RowParticles />}
    </motion.li>
  );
}

/** 6 tiny dots rising upward from the row briefly, then fading. */
function RowParticles() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {Array.from({ length: 6 }).map((_, i) => {
        const left = 65 + (i * 5 + (i % 2 === 0 ? 0 : 3));
        const delay = i * 0.07;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 6, scale: 0.4 }}
            animate={{ opacity: [0, 0.85, 0], y: -28, scale: [0.4, 1, 0.5] }}
            transition={{ duration: 1.3, delay, ease }}
            style={{ left: `${left}%`, bottom: "35%" }}
            className="absolute h-1 w-1 rounded-full bg-success"
          />
        );
      })}
    </div>
  );
}

/**
 * Text element with a horizontally-translating highlight, like a brushed
 * metal effect across the letters. Uses `background-clip: text` so the
 * gradient only shows on the glyphs.
 */
function ShimmerText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.span
      className={cn(
        "inline-block bg-gradient-to-r from-foreground/55 via-foreground to-foreground/55 bg-[length:220%_100%] bg-clip-text text-transparent",
        className
      )}
      animate={{ backgroundPosition: ["0% 0%", "200% 0%"] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
    >
      {children}
    </motion.span>
  );
}

/**
 * SUBTLE confetti for the success state. 22 small dots emit from the
 * checkmark area, scatter outward (biased upward), and fade out. No
 * spinning, no rainbow — restrained enterprise confetti.
 */
function SuccessConfetti() {
  // Deterministic positions so React doesn't re-randomize on re-render.
  // 22 particles arranged in a soft hemisphere above the centre.
  const particles = Array.from({ length: 22 }, (_, i) => {
    const angle = -Math.PI / 2 + (Math.PI * (i - 11)) / 13; // -180° to 0°-ish, upper half
    const distance = 80 + ((i * 37) % 50);                  // 80–130 px
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    const delay = 0.35 + ((i * 53) % 100) / 180;
    const size = 3 + ((i * 17) % 5);
    const tone = i % 3 === 0 ? "bg-success" : i % 3 === 1 ? "bg-success/70" : "bg-success/50";
    return { x, y, delay, size, tone };
  });

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 grid place-items-center"
    >
      <div className="relative h-0 w-0">
        {particles.map((p, i) => (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
            animate={{
              x: p.x,
              y: p.y,
              opacity: [0, 1, 0],
              scale: [0, 1, 0.4],
            }}
            transition={{
              duration: 1.9,
              delay: p.delay,
              ease,
              times: [0, 0.35, 1],
            }}
            style={{ width: p.size, height: p.size }}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
              p.tone
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Success stage — animated green checkmark draw
// ─────────────────────────────────────────────────────────────────────────
function SuccessBody({
  netPaid,
  emailedCount,
  count,
}: {
  netPaid: number;
  emailedCount: number;
  count: number;
}) {
  return (
    <div className="relative overflow-hidden px-6 py-12 text-center">
      {/* Subtle radial confetti — small dots scatter outward, biased upward */}
      <SuccessConfetti />

      {/* Pulse ring + green disc + drawn checkmark */}
      <div className="relative mx-auto h-24 w-24">
        {/* Outer ambient ring — slow, wide */}
        <motion.div
          aria-hidden
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [0.6, 1.6], opacity: [0, 0.18, 0] }}
          transition={{ duration: 2.4, ease, times: [0, 0.5, 1] }}
          className="absolute inset-0 rounded-full bg-success blur-md"
        />
        {/* Inner pulse ring — faster, tighter */}
        <motion.div
          aria-hidden
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: [0.7, 1.3], opacity: [0, 0.45, 0] }}
          transition={{ duration: 1.7, ease, times: [0, 0.55, 1] }}
          className="absolute inset-0 rounded-full bg-success"
        />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="absolute inset-0 grid place-items-center rounded-full bg-success text-success-foreground shadow-pop"
        >
          <svg width="44" height="44" viewBox="0 0 24 24">
            <motion.path
              d="M5 12.5l4.2 4.2L19 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{
                duration: 0.9,
                ease,
                delay: 0.4,
              }}
            />
          </svg>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85, duration: 0.55, ease }}
        className="mt-6 text-[18px] font-semibold tracking-tight"
      >
        Payroll completed
      </motion.p>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05, duration: 0.55, ease }}
        className="mt-1 text-[13px] text-muted-foreground tabular-nums"
      >
        {formatCAD(netPaid)} paid to {count} employee
        {count === 1 ? "" : "s"}
      </motion.p>
      {emailedCount > 0 && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.55, ease }}
          className="mt-1 text-[11.5px] text-muted-foreground/80"
        >
          {emailedCount} email draft{emailedCount === 1 ? "" : "s"} opened in
          your mail app
        </motion.p>
      )}
    </div>
  );
}
