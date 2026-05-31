"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  Building2,
  CheckCircle2,
  FileText,
  Mail,
  Sparkles,
} from "lucide-react";

/*
 * ─── Cinematic story sections ─────────────────────────────────────────────
 * Three scroll-driven scenes that drop into the regular homepage flow:
 *   • <EmployeesScene/>   — "Every paystub. Calculated and signed."
 *   • <AutomationScene/>  — "Built for the way small businesses actually work."
 *   • <SuccessScene/>     — "Payroll processed."
 *
 * Each scene is a tall section with a sticky inner stage that pins while
 * scroll progress drives scale / opacity / path-length transforms.
 * They are intentionally dark so the trio reads as a self-contained
 * narrative arc inside a longer page.
 * ─────────────────────────────────────────────────────────────────────────
 */

// ═════════════════════════════════════════════════════════════════════════
// 1. EVERY PAYSTUB. CALCULATED AND SIGNED.
// ═════════════════════════════════════════════════════════════════════════
export function EmployeesScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Section h-[280vh] + offset "start end → end start":
  //   pin spans progress ≈0.263 → 0.737. The longer section adds scroll
  //   budget for the second beat (employees → paystubs).
  //
  // Narrative:
  //   PHASE A (entry):       title → owner → 3 employees fade in
  //   PHASE B (early pin):   3 lines draw owner → employees, done checks pop
  //   PHASE C (mid pin):     3 short lines draw employees → paystub cards
  //                          below them; paystubs reveal; on the right,
  //                          a "PAYSTUBS GENERATED" panel ticks each off
  const ownerReveal = useTransform(scrollYProgress, [0.04, 0.16], [0, 1]);

  const emp1Reveal = useTransform(scrollYProgress, [0.08, 0.2], [0, 1]);
  const emp2Reveal = useTransform(scrollYProgress, [0.12, 0.24], [0, 1]);
  const emp3Reveal = useTransform(scrollYProgress, [0.16, 0.28], [0, 1]);

  // Owner → employee lines (PHASE B).
  const lineProgress = useTransform(scrollYProgress, [0.3, 0.42], [0, 1]);

  // Done checks pop softly once the owner-employee lines finish drawing.
  const emp1Done = useTransform(scrollYProgress, [0.42, 0.47], [0, 1]);
  const emp2Done = useTransform(scrollYProgress, [0.45, 0.5], [0, 1]);
  const emp3Done = useTransform(scrollYProgress, [0.48, 0.53], [0, 1]);

  // "Paid" wordmark fades in AFTER all three employee done checks have
  // landed (emp3Done completes at 0.53).
  const paidPanelOp = useTransform(scrollYProgress, [0.53, 0.57], [0, 1]);

  // PHASE C — Employee → paystub lines, paystub cards, side panel.
  const paystubLineProgress = useTransform(scrollYProgress, [0.55, 0.63], [0, 1]);
  const paystub1Reveal = useTransform(scrollYProgress, [0.6, 0.66], [0, 1]);
  const paystub2Reveal = useTransform(scrollYProgress, [0.62, 0.68], [0, 1]);
  const paystub3Reveal = useTransform(scrollYProgress, [0.64, 0.7], [0, 1]);
  // Right-side wordmark fades in AFTER the 3rd paystub has finished
  // landing (paystub3Reveal completes at 0.7) — reads as "and there it is."
  const rightPanelOp = useTransform(scrollYProgress, [0.7, 0.74], [0, 1]);

  return (
    <section
      ref={ref}
      className="relative h-[280vh] bg-background text-foreground dark:bg-[#06070a] dark:text-white"
    >
      {/* Section-wide vignette so the parent area is never solid black */}
      <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,rgba(255,255,255,0.025),transparent_70%)] dark:block" />
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        {/* Vertical stack: owner → connecting SVG → three employees.
            The SVG lives INSIDE the column (not absolute) and shares its
            width with the employee row, so the line endpoints land exactly
            on the avatar centres at any viewport size. The employee row
            uses `grid-cols-3 place-items-center` so the three avatars sit
            at predictable 16.67% / 50% / 83.33% positions of the row width
            — these line up with the SVG path endpoints below. */}
        <div className="relative flex flex-col items-center">
          <BusinessOwnerNode reveal={ownerReveal} />

          {/* Hub-and-spoke lines — start at owner bottom (top-centre of the
              SVG) and reach down to each employee column's centre. All
              three paths draw together via the same lineProgress. */}
          <svg
            className="pointer-events-none mt-1 h-[110px] w-[min(92vw,900px)]"
            viewBox="0 0 900 110"
            preserveAspectRatio="none"
          >
            {/* Solid lines only. Smooth S-curves that pull straight down
                from the owner first, then sweep out to each employee.
                All three draw together via the shared lineProgress. */}
            <motion.path
              d="M 450 0 C 450 40 240 70 150 110"
              fill="none"
              stroke="url(#empGradient1)"
              strokeWidth="1.8"
              strokeLinecap="round"
              style={{ pathLength: lineProgress }}
            />
            <motion.path
              d="M 450 0 L 450 110"
              fill="none"
              stroke="url(#empGradient2)"
              strokeWidth="1.8"
              strokeLinecap="round"
              style={{ pathLength: lineProgress }}
            />
            <motion.path
              d="M 450 0 C 450 40 660 70 750 110"
              fill="none"
              stroke="url(#empGradient3)"
              strokeWidth="1.8"
              strokeLinecap="round"
              style={{ pathLength: lineProgress }}
            />
            <defs>
              {/* gradientUnits="userSpaceOnUse" — coords are in viewBox space,
                  NOT relative to each path's bounding box. The default
                  (objectBoundingBox) breaks for the middle line because a
                  purely vertical path has a zero-width bbox, leaving the
                  gradient undefined and the line invisible. */}
              <linearGradient
                id="empGradient1"
                gradientUnits="userSpaceOnUse"
                x1="450"
                y1="0"
                x2="150"
                y2="110"
              >
                <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#fda4af" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient
                id="empGradient2"
                gradientUnits="userSpaceOnUse"
                x1="450"
                y1="0"
                x2="450"
                y2="110"
              >
                <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient
                id="empGradient3"
                gradientUnits="userSpaceOnUse"
                x1="450"
                y1="0"
                x2="750"
                y2="110"
              >
                <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.6" />
              </linearGradient>
            </defs>
          </svg>

          {/* Employee row — grid-cols-3 keeps the avatars at fixed thirds
              of the row width, matching the SVG line endpoints exactly. */}
          <div className="grid w-[min(92vw,900px)] grid-cols-3 place-items-center">
            <EmployeeNode
              name="Employee"
              amount="$2,610.63"
              tone="from-rose-300 to-amber-200"
              reveal={emp1Reveal}
              done={emp1Done}
            />
            <EmployeeNode
              name="Employee"
              amount="$2,295.48"
              tone="from-sky-300 to-emerald-200"
              reveal={emp2Reveal}
              done={emp2Done}
            />
            <EmployeeNode
              name="Employee"
              amount="$827.37"
              tone="from-indigo-300 to-sky-200"
              reveal={emp3Reveal}
              done={emp3Done}
            />
          </div>

          {/* ─── PHASE C ─── Employee → paystub connecting lines.
              Three short vertical lines that draw via paystubLineProgress. */}
          <svg
            className="pointer-events-none mt-1 h-[64px] w-[min(92vw,900px)]"
            viewBox="0 0 900 64"
            preserveAspectRatio="none"
          >
            <motion.path
              d="M 150 0 L 150 64"
              fill="none"
              stroke="url(#paystubGradient)"
              strokeWidth="1.6"
              strokeLinecap="round"
              style={{ pathLength: paystubLineProgress }}
            />
            <motion.path
              d="M 450 0 L 450 64"
              fill="none"
              stroke="url(#paystubGradient)"
              strokeWidth="1.6"
              strokeLinecap="round"
              style={{ pathLength: paystubLineProgress }}
            />
            <motion.path
              d="M 750 0 L 750 64"
              fill="none"
              stroke="url(#paystubGradient)"
              strokeWidth="1.6"
              strokeLinecap="round"
              style={{ pathLength: paystubLineProgress }}
            />
            <defs>
              <linearGradient
                id="paystubGradient"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2="0"
                y2="64"
              >
                <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.35" />
              </linearGradient>
            </defs>
          </svg>

          {/* Paystub cards row — same grid-cols-3 layout so each card sits
              directly under its employee, matching the SVG line endpoints. */}
          <div className="grid w-[min(92vw,900px)] grid-cols-3 place-items-center">
            <PaystubCard label="Paystub 01" reveal={paystub1Reveal} />
            <PaystubCard label="Paystub 02" reveal={paystub2Reveal} />
            <PaystubCard label="Paystub 03" reveal={paystub3Reveal} />
          </div>
        </div>

        {/* ─── "Paid" wordmark ─── anchored to the RIGHT side at the
            EMPLOYEES' vertical level. Fades in after the green check
            badges have landed on all three employees, reading as
            "everyone got their cheque". `top-[57%]` drops it down so
            the headline sits just in front of the employee circles
            (which centre roughly 57% from the top of the viewport). */}
        <motion.h3
          style={{
            opacity: paidPanelOp,
            lineHeight: 1.04,
            letterSpacing: "-0.02em",
          }}
          className="absolute right-[6vw] top-[57%] hidden max-w-[10ch] -translate-y-1/2 text-balance text-right text-[clamp(2rem,3.8vw,3rem)] font-semibold text-foreground lg:block"
        >
          Paid
        </motion.h3>

        {/* ─── "Paystubs Generated" wordmark ─── anchored to the RIGHT
            side at the PAYSTUBS' vertical level. Fades in after the 3rd
            paystub receipt has landed. Same display-weight typography
            as the modal's "Add your team" headline. */}
        <motion.h3
          style={{
            opacity: rightPanelOp,
            lineHeight: 1.04,
            letterSpacing: "-0.02em",
          }}
          className="absolute bottom-[18vh] right-[6vw] hidden max-w-[10ch] text-right text-balance text-[clamp(2rem,3.8vw,3rem)] font-semibold text-foreground lg:block"
        >
          Paystubs Generated
        </motion.h3>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// 2. BUILT FOR THE WAY SMALL BUSINESSES ACTUALLY WORK.
// ═════════════════════════════════════════════════════════════════════════
export function AutomationScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Section h-[140vh] + offset "start end → end start":
  //   pin spans progress 0.417 → 0.583 (= 100vh of scroll). Docs fade in
  //   during entry, travel through during pin, fade out just past pin end.
  //   The title also fades out late in the exit so the page never sits idle.
  const titleOpacity = useTransform(scrollYProgress, [0.20, 0.40, 0.72, 0.85], [0, 1, 1, 0]);
  const titleY = useTransform(scrollYProgress, [0.20, 0.45], [40, 0]);

  const doc1Y = useTransform(scrollYProgress, [0.25, 0.65], [220, -220]);
  const doc1X = useTransform(scrollYProgress, [0.25, 0.65], [-60, -180]);
  const doc1Rot = useTransform(scrollYProgress, [0.25, 0.65], [-12, -6]);
  const doc1Op = useTransform(scrollYProgress, [0.25, 0.38, 0.60, 0.68], [0, 1, 1, 0]);

  const doc2Y = useTransform(scrollYProgress, [0.30, 0.65], [260, -260]);
  const doc2X = useTransform(scrollYProgress, [0.30, 0.65], [40, 180]);
  const doc2Rot = useTransform(scrollYProgress, [0.30, 0.65], [10, 4]);
  const doc2Op = useTransform(scrollYProgress, [0.30, 0.42, 0.60, 0.68], [0, 1, 1, 0]);

  const doc3Y = useTransform(scrollYProgress, [0.35, 0.65], [300, -300]);
  const doc3X = useTransform(scrollYProgress, [0.35, 0.65], [-20, 20]);
  const doc3Rot = useTransform(scrollYProgress, [0.35, 0.65], [-4, 2]);
  const doc3Op = useTransform(scrollYProgress, [0.35, 0.46, 0.62, 0.68], [0, 1, 1, 0]);

  return (
    <section
      ref={ref}
      className="relative h-[140vh] overflow-hidden bg-background text-foreground dark:bg-[#070713] dark:text-white"
    >
      {/* Grid + ambient glow live on the SECTION so the parent area is never
          solid black during the entry/exit phases. */}
      <div className="pointer-events-none absolute inset-0 hidden dark:block bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:64px_64px]" />
      <div className="pointer-events-none absolute inset-0 hidden dark:block bg-[radial-gradient(ellipse_60%_45%_at_50%_50%,rgba(99,102,241,0.10),transparent_70%)]" />

      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Focused indigo halo behind the docs, sticks with the inner */}
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/15 blur-3xl" />

        {/* Floating documents */}
        <motion.div
          style={{ y: doc1Y, x: doc1X, rotate: doc1Rot, opacity: doc1Op }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <FloatingDoc label="T4 SLIP" subtitle="Employee · 2026" />
        </motion.div>
        <motion.div
          style={{ y: doc2Y, x: doc2X, rotate: doc2Rot, opacity: doc2Op }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <FloatingDoc label="PAYSTUB" subtitle="Apr 28 → May 11" tint="emerald" />
        </motion.div>
        <motion.div
          style={{ y: doc3Y, x: doc3X, rotate: doc3Rot, opacity: doc3Op }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <FloatingDoc label="CRA · PD7A" subtitle="May remittance · $2,925" tint="violet" />
        </motion.div>

        <motion.div
          style={{ opacity: titleOpacity, y: titleY }}
          className="absolute inset-x-0 bottom-[16%] z-10 px-6 text-center"
        >
          <h2 className="mx-auto max-w-3xl text-balance text-[clamp(2rem,4.6vw,3.4rem)] font-semibold leading-[1.1] tracking-tightest">
            Every paystub.
            <br />
            One click away.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[14px] leading-relaxed text-muted-foreground dark:text-white/55">
            Generated, signed, and ready to send — no spreadsheets, no math.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// 3. PAYROLL PROCESSED — SUCCESS MOMENT
// ═════════════════════════════════════════════════════════════════════════
export function SuccessScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Section h-[200vh] + offset "start end → end start":
  //   pin spans progress 0.33 → 0.67. Card builds during entry, glow + check
  //   land mid-pin, headline finalizes by 0.6 and stays at 1 forever after —
  //   so during the exit phase the completed card just scrolls away.
  const cardOpacity = useTransform(scrollYProgress, [0.05, 0.22], [0, 1]);
  const cardScale = useTransform(scrollYProgress, [0.05, 0.35], [0.92, 1]);
  const cardGlow = useTransform(scrollYProgress, [0.28, 0.5], [0, 1]);

  const checkScale = useTransform(scrollYProgress, [0.35, 0.5], [0, 1]);
  const checkOpacity = useTransform(scrollYProgress, [0.35, 0.5], [0, 1]);

  const headlineOpacity = useTransform(scrollYProgress, [0.45, 0.6], [0, 1]);
  const headlineY = useTransform(scrollYProgress, [0.45, 0.6], [20, 0]);

  return (
    <section
      ref={ref}
      className="relative h-[200vh] bg-background text-foreground dark:bg-[#06070a] dark:text-white"
    >
      {/* Soft emerald ambient covers the section so the area above/below the
          pinned card glows faintly instead of going solid black. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_50%_50%,rgba(74,222,128,0.045),transparent_70%)]" />
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        {/* Glow that grows behind the card */}
        <motion.div
          style={{ opacity: cardGlow }}
          className="absolute left-1/2 top-1/2 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/15 blur-3xl"
        />

        <motion.div
          style={{ scale: cardScale, opacity: cardOpacity }}
          className="relative w-[min(92vw,440px)]"
        >
          <div className="relative overflow-hidden rounded-[32px] border border-emerald-400/30 bg-card p-9 dark:border-emerald-400/20 dark:bg-[#0a0e0d] shadow-[0_0_120px_-20px_rgba(74,222,128,0.4)]">
            {/* Check circle is in-flow (not absolute) — `mb-6` reserves
                space below it for the text block so it never overlaps. */}
            <motion.div
              style={{ opacity: checkOpacity, scale: checkScale }}
              className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-emerald-500 shadow-[0_0_60px_-4px_rgba(74,222,128,0.7)]"
            >
              <CheckCircle2 className="h-9 w-9 text-white" strokeWidth={2.4} />
            </motion.div>

            <motion.div
              style={{ opacity: headlineOpacity, y: headlineY }}
              className="text-center"
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">
                Payroll processed
              </p>
              <p className="mt-2 text-[28px] font-semibold tracking-tightest">
                $8,945.16 sent
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground dark:text-white/55">
                3 paystubs delivered · CRA remittance scheduled
              </p>

              <div className="mt-7 grid grid-cols-3 gap-2 text-left">
                <SuccessChip
                  icon={<FileText className="h-3.5 w-3.5" />}
                  label="Paystubs"
                  value="3 sent"
                />
                <SuccessChip
                  icon={<Mail className="h-3.5 w-3.5" />}
                  label="Emails"
                  value="3 drafted"
                />
                <SuccessChip
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  label="T4 ready"
                  value="2026"
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────

// Hub of the per-employee scene: the small-business owner. Slightly larger
// than the employee avatars and uses a neutral charcoal→silver gradient so
// it reads as "you" (the operator) rather than another team member.
function BusinessOwnerNode({ reveal }: { reveal: MotionValue<number> }) {
  const y = useTransform(reveal, [0, 1], [-20, 0]);
  return (
    <motion.div
      style={{ opacity: reveal, y }}
      className="relative flex flex-col items-center"
    >
      <div className="relative">
        <div className="grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-slate-600 to-slate-400 shadow-[0_25px_70px_-12px_rgba(0,0,0,0.45)] dark:from-slate-300 dark:to-slate-500 dark:shadow-[0_25px_70px_-12px_rgba(255,255,255,0.2)]">
          <Building2
            className="h-10 w-10 text-white"
            strokeWidth={1.6}
          />
        </div>
        <div className="absolute inset-[-10px] rounded-full border border-border dark:border-white/10" />
      </div>
      <div className="mt-5 text-center">
        <p className="text-[14px] font-semibold tracking-tight">
          Your business
        </p>
        <p className="mt-1 text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground dark:text-white/40">
          Payroll · this period
        </p>
      </div>
    </motion.div>
  );
}

function EmployeeNode({
  name,
  amount,
  tone,
  reveal,
  done,
}: {
  name: string;
  amount: string;
  tone: string;
  reveal: MotionValue<number>;
  done: MotionValue<number>;
}) {
  const y = useTransform(reveal, [0, 1], [30, 0]);
  return (
    <motion.div
      style={{ opacity: reveal, y }}
      className="relative flex flex-col items-center"
    >
      <div className="relative">
        {/* Avatar stays the original 96px; name + amount are sized down so
            they fit INSIDE the circle. Dark slate text reads cleanly on
            the light pastel gradients. */}
        <div
          className={`relative grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br ${tone} shadow-[0_20px_60px_-12px_rgba(255,255,255,0.25)]`}
        >
          <div className="px-2 text-center">
            <p className="text-[11px] font-bold leading-tight tracking-tight text-slate-900/50">
              {name}
            </p>
            <p className="mt-0.5 text-[11px] font-bold leading-tight tabular-nums tracking-tight text-slate-900/50">
              {amount}
            </p>
          </div>
        </div>
        <div className="absolute inset-[-8px] rounded-full border border-white/10" />
        <motion.div
          style={{ opacity: done, scale: done }}
          className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_0_24px_-2px_rgba(74,222,128,0.7)]"
        >
          <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
        </motion.div>
      </div>
    </motion.div>
  );
}

// PHASE C — Receipt-style paystub mini-document. A tall narrow card with a
// perforated (zigzag) bottom edge, "PAYSTUB" header, dotted-line separators,
// and an emerald NET row at the bottom. Reads instantly as "paystub" with
// real Receipt-paper character.
//
// The zigzag is a CSS `clip-path: polygon(...)`. Because clip-path clips the
// border too, the receipt body uses a drop shadow + subtle background tint
// instead of a hard border to define its silhouette.
const RECEIPT_CLIP =
  "polygon(0 0, 100% 0, 100% calc(100% - 10px), 91% 100%, 82% calc(100% - 10px), 73% 100%, 64% calc(100% - 10px), 55% 100%, 45% calc(100% - 10px), 36% 100%, 27% calc(100% - 10px), 18% 100%, 9% calc(100% - 10px), 0 100%)";

function PaystubCard({
  label,
  reveal,
}: {
  label: string;
  reveal: MotionValue<number>;
}) {
  const y = useTransform(reveal, [0, 1], [14, 0]);
  return (
    <motion.div
      style={{ opacity: reveal, y }}
      className="flex flex-col items-center gap-3"
    >
      <div
        className="relative h-[124px] w-[80px] bg-card shadow-[0_4px_18px_-6px_rgba(0,0,0,0.18)] dark:bg-white/[0.06] dark:shadow-[0_4px_18px_-6px_rgba(0,0,0,0.55)]"
        style={{ clipPath: RECEIPT_CLIP }}
      >
        <div className="p-2.5 pt-3.5">
          {/* PAYSTUB header */}
          <div className="mb-2 text-center text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground dark:text-white/55">
            Paystub
          </div>

          {/* Top dotted separator */}
          <div className="my-2 border-t border-dashed border-foreground/20 dark:border-white/20" />

          {/* Line items — label/value rows like a real receipt printout */}
          <div className="space-y-[5px]">
            <div className="flex items-center justify-between">
              <div className="h-[2px] w-2.5 rounded-full bg-foreground/20 dark:bg-white/20" />
              <div className="h-[2px] w-4 rounded-full bg-foreground/30 dark:bg-white/30" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-[2px] w-3.5 rounded-full bg-foreground/20 dark:bg-white/20" />
              <div className="h-[2px] w-3 rounded-full bg-foreground/30 dark:bg-white/30" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-[2px] w-3 rounded-full bg-foreground/20 dark:bg-white/20" />
              <div className="h-[2px] w-3.5 rounded-full bg-foreground/30 dark:bg-white/30" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-[2px] w-2.5 rounded-full bg-foreground/20 dark:bg-white/20" />
              <div className="h-[2px] w-3 rounded-full bg-foreground/30 dark:bg-white/30" />
            </div>
          </div>

          {/* Bottom dotted separator before the total */}
          <div className="my-2 border-t border-dashed border-foreground/25 dark:border-white/25" />

          {/* NET row — emerald to call out the most important figure */}
          <div className="flex items-center justify-between">
            <span className="text-[7px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
              Net
            </span>
            <div className="h-[3px] w-6 rounded-full bg-emerald-600 dark:bg-emerald-400" />
          </div>
        </div>
      </div>

      <p className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-muted-foreground dark:text-white/55">
        {label}
      </p>
    </motion.div>
  );
}

function FloatingDoc({
  label,
  subtitle,
  tint = "amber",
}: {
  label: string;
  subtitle: string;
  tint?: "amber" | "emerald" | "violet";
}) {
  const tintClass = {
    amber: "border-amber-400/30 shadow-amber-500/20",
    emerald: "border-emerald-400/30 shadow-emerald-500/20",
    violet: "border-violet-400/30 shadow-violet-500/20",
  }[tint];

  return (
    <div
      className={`w-[220px] overflow-hidden rounded-2xl border bg-card p-5 dark:bg-[#0c0c14] shadow-[0_30px_80px_-10px] ${tintClass}`}
    >
      <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground dark:text-white/50">
        {label}
      </p>
      <p className="mt-2 text-[13px] font-semibold tracking-tight">{subtitle}</p>
      <div className="mt-4 space-y-1.5">
        <div className="h-1 w-3/4 rounded-full bg-foreground/15 dark:bg-white/12" />
        <div className="h-1 w-1/2 rounded-full bg-foreground/10 dark:bg-white/[0.08]" />
        <div className="h-1 w-2/3 rounded-full bg-foreground/10 dark:bg-white/[0.08]" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-emerald-300">
          Auto
        </span>
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
      </div>
    </div>
  );
}

function SuccessChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-foreground/[0.03] p-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
        {icon}
      </span>
      <p className="mt-2 text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground dark:text-white/50">
        {label}
      </p>
      <p className="mt-0.5 text-[12px] font-semibold">{value}</p>
    </div>
  );
}
