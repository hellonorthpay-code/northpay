"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

// Both are deferred so they don't block the hero/nav becoming interactive on
// mobile: the modal is only needed on click, and the mockup cards sit below the
// fold. ssr:false keeps them out of the initial hydration pass.
const HeroPayrollCards = dynamic(
  () => import("./hero-cards").then((m) => m.HeroPayrollCards),
  { ssr: false }
);
// The sample-paystub wizard replaces the old "See how it works" tour: a
// visitor now gets a real paystub for their own numbers, delivered to their
// inbox, instead of a walkthrough of someone else's.
const SamplePaystubModal = dynamic(
  () => import("./sample-paystub-modal").then((m) => m.SamplePaystubModal),
  { ssr: false }
);

// Entrances use tailwindcss-animate (pure CSS) instead of framer-motion, so the
// hero hydrates without pulling framer onto the homepage's critical path.
export function Hero() {
  const [sampleOpen, setSampleOpen] = useState(false);
  // Where the button was when it was pressed, so the sheet swells out of it.
  const [sampleOrigin, setSampleOrigin] = useState<{ x: number; y: number } | null>(null);
  // The mockup cards animate (framer) continuously — skip them on phones so the
  // main thread stays free and nav taps render instantly. Default false (also
  // the SSR value) so they never mount on mobile.
  const [showCards, setShowCards] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setShowCards(true);
  }, []);
  return (
    <section className="relative pt-20 pb-24 md:pt-40">
      {/* Floating gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-32 h-[640px] w-[1080px] -translate-x-1/2 rounded-full bg-gradient-to-br from-rose-200/40 via-sky-200/30 to-emerald-200/40 blur-3xl dark:from-rose-500/10 dark:via-sky-500/10 dark:to-emerald-500/10" />
        <div className="absolute left-1/2 top-64 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-200/30 to-amber-100/40 blur-3xl dark:from-indigo-500/10 dark:to-amber-500/10" />
      </div>

      <div className="container relative">
        <div className="mx-auto max-w-3xl text-center duration-700 animate-in fade-in slide-in-from-bottom-4">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[12px] text-muted-foreground backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Designed for 2026 Canadian payroll
          </div>

          <h1 className="text-balance text-[clamp(2.6rem,7vw,5.25rem)] font-semibold leading-[1.02] tracking-tightest text-foreground">
            Canadian payroll.
            <br />
            <span className="bg-gradient-to-r from-foreground via-foreground/80 to-foreground/50 bg-clip-text text-transparent">
              Finally beautiful.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-balance text-[17px] leading-relaxed text-muted-foreground">
            The payroll system designed for modern Canadian businesses. CPP, EI,
            federal and provincial — calmly automated.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard">
              <Button size="lg" className="group">
                Start tracking
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="group"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setSampleOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
                setSampleOpen(true);
              }}
            >
              <FileText className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
              Try a sample paystub
            </Button>
          </div>

          {/* Only mount (and download) the wizard once it's actually opened. */}
          {sampleOpen && (
            <SamplePaystubModal
              open={sampleOpen}
              onOpenChange={setSampleOpen}
              origin={sampleOrigin}
            />
          )}
        </div>

        {showCards && (
          <div className="relative mx-auto mt-20 max-w-5xl duration-1000 animate-in fade-in slide-in-from-bottom-6">
            <HeroPayrollCards />
          </div>
        )}
      </div>
    </section>
  );
}
