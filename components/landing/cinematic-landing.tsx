"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  FileText,
  Mail,
  Sparkles,
  Users,
} from "lucide-react";

/*
 * ─── Cinematic landing — scroll-driven story experience ──────────────────
 *
 *   1. Storefront                — small-business façade, camera pushes in
 *   2. Enter                     — interior, lamp glow, owner stressed
 *   3. Product                   — NorthPay UI assembles itself
 *   4. Employees                 — three employees process sequentially
 *   5. Automation                — documents float, taxes calc, T4 forms
 *   6. Success                   — warm payoff, "Payroll processed."
 *   7. CTA                       — final call to action
 *
 * Motion mechanics:
 *   • Each scene is a tall section (200-300vh) with a `sticky h-screen`
 *     inner container, so the scene "pins" while its contents animate.
 *   • `useScroll({ target: ref, offset: ["start end","end start"] })`
 *     gives a 0→1 progress value tied to the scene's viewport entry/exit.
 *   • `useTransform` maps that progress to scale/y/opacity for each layer.
 *   • Parallax = different layers map the same progress to different ranges.
 *
 * Asset note:
 *   Visuals are designed in pure CSS+SVG (no video / 3D). The intent is to
 *   convey art direction; real production would drop in 4K storefront
 *   footage at <SceneStorefront/> and Lottie/MP4 for the product reveal.
 *
 * Smooth scroll:
 *   Native CSS smooth scroll only. Lenis can be dropped in later via
 *   `useEffect(() => { const l = new Lenis(); … })` at the layout root.
 * ────────────────────────────────────────────────────────────────────────
 */

const ease = [0.22, 1, 0.36, 1] as const;

export function CinematicLanding() {
  return (
    <main className="relative bg-[#07070a] text-white">
      {/* Persistent top nav — minimal, on top of every scene */}
      <CinematicNav />
      <SceneStorefront />
      <SceneEnter />
      <SceneProduct />
      <SceneEmployees />
      <SceneAutomation />
      <SceneSuccess />
      <FinalCTA />
    </main>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// NAV — glass strip, fades opacity slightly as user scrolls past hero
// ═════════════════════════════════════════════════════════════════════════
function CinematicNav() {
  return (
    <header className="fixed inset-x-0 top-4 z-50 mx-auto flex max-w-fit">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 shadow-soft backdrop-blur-xl">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-1 text-[14px] font-semibold tracking-tight text-white"
        >
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-white text-black">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 13V3l10 10V3"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          NorthPay
        </Link>
        <Link
          href="/dashboard"
          className="rounded-full bg-white px-4 py-1.5 text-[12.5px] font-medium text-black transition-colors hover:bg-white/90"
        >
          Open app
        </Link>
      </div>
    </header>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SCENE 1 — STOREFRONT
//   Layered exterior scene with a camera-push effect. Sticky for 260vh.
// ═════════════════════════════════════════════════════════════════════════
function SceneStorefront() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Camera push — the storefront slowly grows and moves toward the camera
  const buildingScale = useTransform(scrollYProgress, [0, 1], [0.92, 1.35]);
  const buildingY = useTransform(scrollYProgress, [0, 1], [40, -60]);
  const buildingBlur = useTransform(scrollYProgress, [0.7, 1], [0, 8]);

  // Sky drifts up slightly (parallax background)
  const skyY = useTransform(scrollYProgress, [0, 1], [0, -120]);

  // Ground reflection grows
  const groundOpacity = useTransform(scrollYProgress, [0, 0.4], [0.4, 0.9]);

  // Rain falls faster as we get closer (perception)
  const rainOpacity = useTransform(scrollYProgress, [0, 0.3, 1], [0, 0.35, 0]);

  // Title fades in then out as user scrolls past
  const titleOpacity = useTransform(
    scrollYProgress,
    [0, 0.15, 0.7, 0.9],
    [0, 1, 1, 0]
  );
  const titleY = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section ref={ref} className="relative h-[260vh]">
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Night sky gradient + star field */}
        <motion.div
          style={{ y: skyY }}
          className="absolute inset-0 bg-gradient-to-b from-[#0a0d18] via-[#0a0a14] to-[#06060a]"
        >
          <StarField count={70} />
          {/* Distant city silhouette */}
          <div className="absolute inset-x-0 bottom-[42%] h-24">
            <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-[#0e0e16]/80 to-transparent" />
            <CitySilhouette />
          </div>
        </motion.div>

        {/* Rain */}
        <motion.div style={{ opacity: rainOpacity }} className="absolute inset-0">
          <Rain />
        </motion.div>

        {/* Storefront building — the focal element */}
        <motion.div
          style={{
            scale: buildingScale,
            y: buildingY,
            filter: useFilterBlur(buildingBlur),
          }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <Storefront />
        </motion.div>

        {/* Reflective wet ground */}
        <motion.div
          style={{ opacity: groundOpacity }}
          className="absolute inset-x-0 bottom-0 h-[36%]"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/5 to-amber-500/15" />
          <div className="absolute inset-x-1/2 -translate-x-1/2 bottom-20 h-32 w-[380px] rounded-full bg-amber-300/20 blur-3xl" />
        </motion.div>

        {/* Headline overlay */}
        <motion.div
          style={{ opacity: titleOpacity, y: titleY }}
          className="absolute inset-x-0 bottom-[12%] z-10 text-center"
        >
          <p className="text-[11px] uppercase tracking-[0.4em] text-amber-200/70">
            For the way you actually work
          </p>
          <h1 className="mt-4 text-balance text-[clamp(2.6rem,6vw,5rem)] font-semibold leading-[1.05] tracking-tightest">
            Canadian payroll,
            <br />
            <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-amber-200 bg-clip-text text-transparent">
              finally calm.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-[14px] leading-relaxed text-white/55">
            Scroll to see how it works.
          </p>
          <ScrollIndicator />
        </motion.div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SCENE 2 — ENTERING THE STORE
//   Interior: desk, lamp glow, stack of papers, the owner working late.
//   Implied push-through-the-door via a starts-zoomed-in entrance.
// ═════════════════════════════════════════════════════════════════════════
function SceneEnter() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Interior starts huge (camera just emerged from doorway) and settles
  const interiorScale = useTransform(scrollYProgress, [0, 0.4], [1.35, 1]);
  const interiorOpacity = useTransform(scrollYProgress, [0, 0.15], [0, 1]);

  // Lamp light gently pulses
  const lampGlow = useTransform(scrollYProgress, [0.2, 0.6], [0.6, 1]);

  // Old payroll paperwork dissolves away at the end
  const paperOpacity = useTransform(scrollYProgress, [0.55, 0.85], [1, 0]);
  const paperX = useTransform(scrollYProgress, [0.5, 0.9], [0, -120]);
  const paperRotate = useTransform(scrollYProgress, [0.5, 0.9], [0, -8]);

  // Headline fades up
  const headlineOpacity = useTransform(
    scrollYProgress,
    [0.2, 0.4, 0.75, 0.95],
    [0, 1, 1, 0]
  );
  const headlineY = useTransform(scrollYProgress, [0.2, 0.5], [30, 0]);

  return (
    <section ref={ref} className="relative h-[230vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-[#0c0a07]">
        {/* Warm interior ambient gradient */}
        <div className="absolute inset-0 bg-gradient-radial from-amber-900/30 via-[#0c0907] to-[#06050a]" />

        {/* The lamp's pool of light */}
        <motion.div
          style={{ opacity: lampGlow }}
          className="absolute left-1/2 top-[55%] h-[440px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/25 blur-3xl"
        />

        {/* Desk scene */}
        <motion.div
          style={{ scale: interiorScale, opacity: interiorOpacity }}
          className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2"
        >
          <Desk />
        </motion.div>

        {/* Floating stack of paperwork that dissolves */}
        <motion.div
          style={{ opacity: paperOpacity, x: paperX, rotate: paperRotate }}
          className="absolute left-[12%] top-[40%]"
        >
          <PaperworkStack />
        </motion.div>

        {/* Headline */}
        <motion.div
          style={{ opacity: headlineOpacity, y: headlineY }}
          className="absolute inset-x-0 top-[18%] text-center"
        >
          <h2 className="mx-auto max-w-2xl text-balance text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.1] tracking-tightest">
            Payroll shouldn't feel
            <br />
            <span className="text-amber-200/90">this complicated.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[14px] leading-relaxed text-white/55">
            Tax tables. CPP. EI. T4s. Vacation. Frequencies. Late nights.
            <br />
            <span className="text-white/40">There's a calmer way.</span>
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SCENE 3 — INTRODUCING THE PRODUCT
//   Sticky window mockup whose UI elements assemble themselves with scroll.
// ═════════════════════════════════════════════════════════════════════════
function SceneProduct() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Mockup tilts in as it enters
  const mockY = useTransform(scrollYProgress, [0, 0.35], [120, 0]);
  const mockRotateX = useTransform(scrollYProgress, [0, 0.35], [12, 0]);
  const mockOpacity = useTransform(scrollYProgress, [0, 0.15], [0, 1]);

  // Sidebar appears
  const sidebarX = useTransform(scrollYProgress, [0.18, 0.32], [-30, 0]);
  const sidebarOpacity = useTransform(scrollYProgress, [0.18, 0.32], [0, 1]);

  // Employee card 1
  const emp1Opacity = useTransform(scrollYProgress, [0.3, 0.42], [0, 1]);
  const emp1Y = useTransform(scrollYProgress, [0.3, 0.42], [16, 0]);

  // Employee card 2
  const emp2Opacity = useTransform(scrollYProgress, [0.38, 0.5], [0, 1]);
  const emp2Y = useTransform(scrollYProgress, [0.38, 0.5], [16, 0]);

  // Employee card 3
  const emp3Opacity = useTransform(scrollYProgress, [0.46, 0.58], [0, 1]);
  const emp3Y = useTransform(scrollYProgress, [0.46, 0.58], [16, 0]);

  // "Run payroll" button highlights
  const runOpacity = useTransform(scrollYProgress, [0.56, 0.68], [0.3, 1]);
  const runScale = useTransform(scrollYProgress, [0.56, 0.7], [0.96, 1]);

  // Title
  const titleOpacity = useTransform(
    scrollYProgress,
    [0, 0.2, 0.85, 1],
    [0, 1, 1, 0]
  );

  return (
    <section ref={ref} className="relative h-[320vh] bg-[#06060a]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        {/* Soft radial spot behind the mockup */}
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl" />

        <motion.div
          style={{ opacity: titleOpacity }}
          className="absolute left-1/2 top-[14%] z-10 -translate-x-1/2 text-center"
        >
          <p className="text-[11px] uppercase tracking-[0.32em] text-white/40">
            Introducing
          </p>
          <h2 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold tracking-tightest">
            One tab. Everyone paid.
          </h2>
        </motion.div>

        {/* Browser-style mockup */}
        <motion.div
          style={{
            y: mockY,
            opacity: mockOpacity,
            rotateX: mockRotateX,
            transformPerspective: 1400,
          }}
          className="relative w-[min(92vw,860px)] origin-bottom"
        >
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0f1014] shadow-[0_30px_120px_-20px_rgba(0,0,0,0.7)]">
            {/* Window chrome */}
            <div className="flex items-center gap-2 border-b border-white/5 bg-[#15161a] px-4 py-2.5">
              <div className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              <p className="ml-3 text-[11px] text-white/40">
                northpay · dashboard
              </p>
            </div>

            {/* App body */}
            <div className="grid grid-cols-[180px_1fr] gap-0">
              {/* Sidebar */}
              <motion.aside
                style={{ x: sidebarX, opacity: sidebarOpacity }}
                className="border-r border-white/5 bg-[#0c0d11] p-4"
              >
                <div className="flex items-center gap-2 px-1 pb-4">
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-white text-[#0c0d11]">
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3 13V3l10 10V3"
                        stroke="currentColor"
                        strokeWidth="2.4"
                      />
                    </svg>
                  </span>
                  <span className="text-[12.5px] font-semibold">NorthPay</span>
                </div>
                <SidebarItem icon={<Users className="h-3.5 w-3.5" />} label="Employees" />
                <SidebarItem icon={<Banknote className="h-3.5 w-3.5" />} label="Payroll" active />
                <SidebarItem icon={<FileText className="h-3.5 w-3.5" />} label="CRA" />
              </motion.aside>

              {/* Content */}
              <div className="p-6">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Next payroll · May 12 — May 25, 2026
                </p>
                <p className="mt-2 text-[32px] font-semibold leading-none tabular-nums tracking-tightest">
                  $8,945.16
                </p>
                <p className="mt-1.5 text-[11.5px] text-white/55">
                  Net to 3 employees · pay date May 29
                </p>

                {/* Employee rows */}
                <div className="mt-5 space-y-2">
                  <motion.div style={{ opacity: emp1Opacity, y: emp1Y }}>
                    <ProductEmployeeRow name="Jordan Bell" amount="$2,610.63" tone="from-rose-300 to-amber-200" />
                  </motion.div>
                  <motion.div style={{ opacity: emp2Opacity, y: emp2Y }}>
                    <ProductEmployeeRow name="Priya Sharma" amount="$2,295.48" tone="from-sky-300 to-emerald-200" />
                  </motion.div>
                  <motion.div style={{ opacity: emp3Opacity, y: emp3Y }}>
                    <ProductEmployeeRow name="Sage MacKenzie" amount="$827.37" tone="from-indigo-300 to-sky-200" />
                  </motion.div>
                </div>

                {/* Run payroll button */}
                <motion.div
                  style={{ opacity: runOpacity, scale: runScale }}
                  className="mt-5 flex justify-end"
                >
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-medium text-black shadow-[0_0_24px_-4px_rgba(255,255,255,0.4)]">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Run payroll
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SCENE 4 — EMPLOYEE PAYROLL FLOW
//   Three employee orbs glow into existence, paystubs materialize, check.
// ═════════════════════════════════════════════════════════════════════════
function SceneEmployees() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Three employees, each spans ~25% of scroll progress
  const emp1Reveal = useTransform(scrollYProgress, [0.12, 0.28], [0, 1]);
  const emp1Done = useTransform(scrollYProgress, [0.22, 0.35], [0, 1]);

  const emp2Reveal = useTransform(scrollYProgress, [0.32, 0.48], [0, 1]);
  const emp2Done = useTransform(scrollYProgress, [0.42, 0.55], [0, 1]);

  const emp3Reveal = useTransform(scrollYProgress, [0.52, 0.68], [0, 1]);
  const emp3Done = useTransform(scrollYProgress, [0.62, 0.75], [0, 1]);

  // Lines connecting them grow as user scrolls
  const lineProgress = useTransform(scrollYProgress, [0.15, 0.78], [0, 1]);

  const titleOpacity = useTransform(
    scrollYProgress,
    [0, 0.18, 0.85, 1],
    [0, 1, 1, 0]
  );

  return (
    <section ref={ref} className="relative h-[300vh] bg-[#06070a]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <motion.div
          style={{ opacity: titleOpacity }}
          className="absolute left-1/2 top-[14%] -translate-x-1/2 text-center"
        >
          <p className="text-[11px] uppercase tracking-[0.32em] text-white/40">
            Per employee
          </p>
          <h2 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold tracking-tightest">
            Every paystub. Calculated and signed.
          </h2>
        </motion.div>

        {/* Connecting lines between the three nodes */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
        >
          <motion.path
            d="M 200 320 Q 350 240 500 320 T 800 320"
            fill="none"
            stroke="url(#empGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            style={{ pathLength: lineProgress }}
          />
          <defs>
            <linearGradient id="empGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fda4af" stopOpacity="0" />
              <stop offset="30%" stopColor="#fda4af" stopOpacity="0.6" />
              <stop offset="70%" stopColor="#22d3ee" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Three employee nodes */}
        <div className="relative flex w-[min(92vw,900px)] items-center justify-between px-8">
          <EmployeeNode
            name="Jordan Bell"
            role="Salary · ON"
            amount="$2,610.63"
            tone="from-rose-300 to-amber-200"
            reveal={emp1Reveal}
            done={emp1Done}
          />
          <EmployeeNode
            name="Priya Sharma"
            role="Hourly · BC"
            amount="$2,295.48"
            tone="from-sky-300 to-emerald-200"
            reveal={emp2Reveal}
            done={emp2Done}
          />
          <EmployeeNode
            name="Sage MacKenzie"
            role="Hourly · NS"
            amount="$827.37"
            tone="from-indigo-300 to-sky-200"
            reveal={emp3Reveal}
            done={emp3Done}
          />
        </div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SCENE 5 — AUTOMATION MOMENT
//   Documents float in from edges, taxes calculate, T4s emerge.
// ═════════════════════════════════════════════════════════════════════════
function SceneAutomation() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const titleOpacity = useTransform(
    scrollYProgress,
    [0, 0.2, 0.85, 1],
    [0, 1, 1, 0]
  );
  const titleY = useTransform(scrollYProgress, [0, 0.3], [40, 0]);

  // Each floating doc has its own scroll-bound y/x/rotate trajectory
  const doc1Y = useTransform(scrollYProgress, [0.2, 0.7], [200, -100]);
  const doc1X = useTransform(scrollYProgress, [0.2, 0.7], [-60, -180]);
  const doc1Rot = useTransform(scrollYProgress, [0.2, 0.7], [-12, -6]);
  const doc1Op = useTransform(scrollYProgress, [0.2, 0.35, 0.7, 0.85], [0, 1, 1, 0]);

  const doc2Y = useTransform(scrollYProgress, [0.25, 0.75], [240, -120]);
  const doc2X = useTransform(scrollYProgress, [0.25, 0.75], [40, 180]);
  const doc2Rot = useTransform(scrollYProgress, [0.25, 0.75], [10, 4]);
  const doc2Op = useTransform(scrollYProgress, [0.25, 0.4, 0.75, 0.9], [0, 1, 1, 0]);

  const doc3Y = useTransform(scrollYProgress, [0.32, 0.85], [280, -160]);
  const doc3X = useTransform(scrollYProgress, [0.32, 0.85], [-20, 0]);
  const doc3Rot = useTransform(scrollYProgress, [0.32, 0.85], [-4, 2]);
  const doc3Op = useTransform(scrollYProgress, [0.32, 0.45, 0.85, 0.95], [0, 1, 1, 0]);

  return (
    <section ref={ref} className="relative h-[260vh] overflow-hidden bg-[#070713]">
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Subtle grid background — feels like an enterprise system */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:64px_64px]" />

        {/* Ambient blue glow */}
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/15 blur-3xl" />

        {/* Floating documents */}
        <motion.div
          style={{ y: doc1Y, x: doc1X, rotate: doc1Rot, opacity: doc1Op }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <FloatingDoc label="T4 SLIP" subtitle="Jordan Bell · 2026" />
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
          className="absolute inset-x-0 bottom-[16%] z-10 text-center"
        >
          <h2 className="mx-auto max-w-3xl text-balance text-[clamp(2rem,4.6vw,3.4rem)] font-semibold leading-[1.1] tracking-tightest">
            Built for the way small
            <br />
            businesses actually work.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[14px] leading-relaxed text-white/55">
            Payroll, paystubs, taxes, and T4s — simplified.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SCENE 6 — FINAL SUCCESS MOMENT
//   Warm payoff. Card emits soft glow. "Payroll processed successfully."
// ═════════════════════════════════════════════════════════════════════════
function SceneSuccess() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const cardScale = useTransform(scrollYProgress, [0, 0.35], [0.92, 1]);
  const cardOpacity = useTransform(scrollYProgress, [0, 0.18], [0, 1]);
  const cardGlow = useTransform(scrollYProgress, [0.25, 0.6], [0, 1]);

  const checkScale = useTransform(scrollYProgress, [0.32, 0.55], [0, 1]);
  const checkOpacity = useTransform(scrollYProgress, [0.32, 0.55], [0, 1]);

  const headlineOpacity = useTransform(
    scrollYProgress,
    [0.45, 0.62, 0.92, 1],
    [0, 1, 1, 0]
  );
  const headlineY = useTransform(scrollYProgress, [0.45, 0.65], [20, 0]);

  return (
    <section ref={ref} className="relative h-[220vh] bg-[#06070a]">
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
          <div className="relative overflow-hidden rounded-[32px] border border-emerald-400/20 bg-[#0a0e0d] p-9 shadow-[0_0_120px_-20px_rgba(74,222,128,0.4)]">
            {/* Pulse rings */}
            <motion.div
              style={{ opacity: checkOpacity }}
              className="mx-auto mb-6 grid h-20 w-20 place-items-center"
            >
              <motion.span
                style={{ scale: checkScale }}
                className="absolute inset-0 grid place-items-center"
              >
                <span className="grid h-20 w-20 place-items-center rounded-full bg-emerald-500 shadow-[0_0_60px_-4px_rgba(74,222,128,0.7)]">
                  <CheckCircle2 className="h-9 w-9 text-white" strokeWidth={2.4} />
                </span>
              </motion.span>
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
              <p className="mt-1 text-[13px] text-white/55">
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

// ═════════════════════════════════════════════════════════════════════════
// FINAL CTA
// ═════════════════════════════════════════════════════════════════════════
function FinalCTA() {
  return (
    <section className="relative bg-gradient-to-b from-[#06070a] to-black px-6 py-32">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] uppercase tracking-[0.32em] text-white/40">
          Start tracking
        </p>
        <h2 className="mt-4 text-balance text-[clamp(2.5rem,5.5vw,4.5rem)] font-semibold leading-[1.05] tracking-tightest">
          Your team. Paid in one click.
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-white/55">
          Outside Quebec · CRA-aware · designed for small Canadian businesses.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-medium text-black transition-all duration-200 hover:bg-white/90 hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.5)]"
          >
            Open the app
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/dashboard/employees"
            className="rounded-full border border-white/15 px-6 py-3.5 text-[14px] font-medium text-white/85 transition-colors hover:bg-white/5"
          >
            See employees
          </Link>
        </div>
        <p className="mt-12 text-[11px] text-white/30">
          © 2026 NorthPay · Made with care for the way modern teams actually work.
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// COMPOSED SCENE PIECES
// ─────────────────────────────────────────────────────────────────────────

function Storefront() {
  return (
    <div className="relative w-[440px]">
      {/* Sign */}
      <div className="relative mx-auto w-[330px] rounded-xl border border-amber-400/30 bg-[#0d0a06] px-6 py-3 text-center shadow-[0_0_40px_-2px_rgba(255,200,120,0.5)]">
        <span className="text-[19px] font-semibold tracking-wide text-amber-200 [text-shadow:_0_0_24px_rgba(255,200,120,1)]">
          Small Business
        </span>
      </div>

      {/* Facade */}
      <div className="relative mx-auto mt-3 h-[300px] w-full overflow-hidden rounded-2xl border border-amber-500/15 bg-gradient-to-b from-[#0a0807] to-[#06050a]">
        {/* Interior warm wash */}
        <div className="absolute inset-x-0 top-0 h-2/3 bg-gradient-to-b from-amber-400/15 via-amber-300/5 to-transparent" />

        {/* Three vertical panels: window, door, window */}
        <div className="absolute inset-x-7 inset-y-7 grid grid-cols-[1fr_0.7fr_1fr] gap-4">
          <Window />
          <Door />
          <Window />
        </div>
      </div>
    </div>
  );
}

function Window() {
  return (
    <div className="relative rounded-md border border-amber-200/30 bg-amber-100/15 shadow-[inset_0_0_60px_8px_rgba(255,200,120,0.35)]">
      {/* Mullions */}
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
        <div className="border-r border-b border-amber-200/15" />
        <div className="border-b border-amber-200/15" />
        <div className="border-r border-amber-200/15" />
        <div />
      </div>
      {/* Soft warm pool inside */}
      <div className="absolute inset-4 rounded bg-amber-200/25 blur-md" />
    </div>
  );
}

function Door() {
  return (
    <div className="relative overflow-hidden rounded-md border border-amber-200/30 bg-amber-100/10">
      <div className="absolute inset-2 rounded-sm bg-gradient-to-b from-amber-200/30 via-amber-100/15 to-amber-200/30" />
      {/* Tiny door handle */}
      <span className="absolute right-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-amber-200/80 shadow-[0_0_8px_2px_rgba(255,200,120,0.7)]" />
    </div>
  );
}

function CitySilhouette() {
  return (
    <svg
      className="absolute inset-x-0 bottom-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 1200 100"
    >
      <path
        d="M0 100 L0 70 L40 70 L40 60 L80 60 L80 80 L120 80 L120 50 L160 50 L160 75 L200 75 L200 65 L240 65 L240 55 L280 55 L280 78 L330 78 L330 60 L380 60 L380 70 L420 70 L420 50 L470 50 L470 65 L520 65 L520 55 L560 55 L560 75 L610 75 L610 60 L660 60 L660 70 L710 70 L710 50 L760 50 L760 80 L810 80 L810 65 L860 65 L860 55 L910 55 L910 75 L960 75 L960 60 L1010 60 L1010 70 L1060 70 L1060 55 L1110 55 L1110 75 L1160 75 L1160 65 L1200 65 L1200 100 Z"
        fill="#0a0a14"
      />
    </svg>
  );
}

function StarField({ count }: { count: number }) {
  // Deterministic positions
  const stars = Array.from({ length: count }, (_, i) => ({
    left: (i * 37) % 100,
    top: (i * 53) % 70,
    size: 1 + ((i * 11) % 3) * 0.4,
    opacity: 0.3 + ((i * 7) % 7) * 0.08,
  }));
  return (
    <div aria-hidden className="absolute inset-0">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
          }}
        />
      ))}
    </div>
  );
}

function Rain() {
  const drops = Array.from({ length: 50 });
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {drops.map((_, i) => {
        const left = (i * 29) % 100;
        const delay = (i * 0.13) % 2;
        const duration = 0.8 + ((i * 7) % 5) * 0.15;
        return (
          <motion.span
            key={i}
            initial={{ y: "-10%", opacity: 0 }}
            animate={{ y: "110vh", opacity: [0, 0.6, 0] }}
            transition={{
              duration,
              delay,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{
              left: `${left}%`,
              width: 1,
              height: 18,
            }}
            className="absolute bg-gradient-to-b from-transparent via-white/40 to-transparent"
          />
        );
      })}
    </div>
  );
}

function ScrollIndicator() {
  return (
    <motion.div
      animate={{ y: [0, 6, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      className="mx-auto mt-12 grid h-9 w-6 place-items-center rounded-full border border-white/20"
    >
      <span className="h-1.5 w-1 rounded-full bg-white/60" />
    </motion.div>
  );
}

function Desk() {
  return (
    <div className="relative w-[420px]">
      {/* Lamp */}
      <div className="relative mx-auto mb-3 w-32">
        <div className="mx-auto h-12 w-12 rounded-b-full bg-gradient-to-b from-amber-200 to-amber-500 shadow-[0_0_60px_8px_rgba(255,200,120,0.6)]" />
        <div className="mx-auto mt-1 h-16 w-[3px] bg-gradient-to-b from-amber-700 to-amber-900" />
      </div>
      {/* Desk surface */}
      <div className="relative h-3 w-full rounded-md bg-gradient-to-b from-amber-900/40 to-amber-950/80 shadow-[0_8px_40px_-4px_rgba(0,0,0,0.6)]" />

      {/* Laptop on desk */}
      <div className="mx-auto -mt-1 w-[280px] overflow-hidden rounded-md border border-white/10 bg-[#15161a] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)]">
        <div className="grid grid-cols-[60px_1fr] gap-0 p-2 text-[8px]">
          <div className="space-y-1">
            <div className="h-1 rounded bg-white/20" />
            <div className="h-1 rounded bg-white/10" />
            <div className="h-1 rounded bg-white/10" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 rounded bg-amber-200/10" />
            <div className="h-2 rounded bg-white/8" />
            <div className="h-2 rounded bg-white/8" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PaperworkStack() {
  return (
    <div className="relative">
      {/* Stack of papers */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute h-32 w-24 rounded-sm border border-white/10 bg-white/85 shadow-md"
          style={{
            left: i * 3,
            top: i * 2,
            transform: `rotate(${(i - 1.5) * 4}deg)`,
          }}
        >
          <div className="m-2 space-y-1.5">
            <div className="h-1 w-12 rounded-sm bg-zinc-400" />
            <div className="h-1 w-16 rounded-sm bg-zinc-300" />
            <div className="h-1 w-10 rounded-sm bg-zinc-300" />
            <div className="mt-2 h-1 w-14 rounded-sm bg-zinc-400" />
            <div className="h-1 w-12 rounded-sm bg-zinc-300" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`mt-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${
        active ? "bg-white/8 text-white" : "text-white/55"
      }`}
    >
      {icon}
      {label}
    </div>
  );
}

function ProductEmployeeRow({
  name,
  amount,
  tone,
}: {
  name: string;
  amount: string;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/4 px-3 py-2">
      <div className="flex items-center gap-2">
        <div
          className={`h-6 w-6 rounded-full bg-gradient-to-br ${tone}`}
        />
        <span className="text-[12px] font-medium tracking-tight">{name}</span>
      </div>
      <span className="text-[12px] font-medium tabular-nums">{amount}</span>
    </div>
  );
}

function EmployeeNode({
  name,
  role,
  amount,
  tone,
  reveal,
  done,
}: {
  name: string;
  role: string;
  amount: string;
  tone: string;
  reveal: MotionValue<number>;
  done: MotionValue<number>;
}) {
  // The check ring scales in once `done` crosses 0
  return (
    <motion.div
      style={{ opacity: reveal, y: useTransform(reveal, [0, 1], [30, 0]) }}
      className="relative flex flex-col items-center"
    >
      <div className="relative">
        <div className={`h-24 w-24 rounded-full bg-gradient-to-br ${tone} shadow-[0_20px_60px_-12px_rgba(255,255,255,0.25)]`} />
        {/* Soft ring */}
        <div className="absolute inset-[-8px] rounded-full border border-white/10" />
        {/* Done check overlay */}
        <motion.div
          style={{ opacity: done, scale: done }}
          className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_0_24px_-2px_rgba(74,222,128,0.7)]"
        >
          <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
        </motion.div>
      </div>
      <div className="mt-5 text-center">
        <p className="text-[13.5px] font-semibold tracking-tight">{name}</p>
        <p className="mt-1 text-[10.5px] uppercase tracking-[0.16em] text-white/40">
          {role}
        </p>
        <p className="mt-2 text-[14px] font-semibold tabular-nums tracking-tight">
          {amount}
        </p>
      </div>
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
      className={`w-[220px] overflow-hidden rounded-2xl border bg-[#0c0c14] p-5 shadow-[0_30px_80px_-10px] ${tintClass}`}
    >
      <p className="text-[9px] uppercase tracking-[0.18em] text-white/50">
        {label}
      </p>
      <p className="mt-2 text-[13px] font-semibold tracking-tight">
        {subtitle}
      </p>
      <div className="mt-4 space-y-1.5">
        <div className="h-1 w-3/4 rounded-full bg-white/12" />
        <div className="h-1 w-1/2 rounded-full bg-white/8" />
        <div className="h-1 w-2/3 rounded-full bg-white/8" />
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
    <div className="rounded-xl border border-white/8 bg-white/4 p-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
        {icon}
      </span>
      <p className="mt-2 text-[9.5px] uppercase tracking-[0.14em] text-white/50">
        {label}
      </p>
      <p className="mt-0.5 text-[12px] font-semibold">{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

/** Wrap a MotionValue<number> into a CSS `filter: blur(Npx)` string. */
function useFilterBlur(value: MotionValue<number>) {
  return useTransform(value, (v) => `blur(${v}px)`);
}
