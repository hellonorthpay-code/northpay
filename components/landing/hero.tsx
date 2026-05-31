"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroPayrollCards } from "./hero-cards";
import { HowItWorksModal } from "./how-it-works-modal";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  return (
    <section className="relative pt-20 pb-24 md:pt-40">
      {/* Floating gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-32 h-[640px] w-[1080px] -translate-x-1/2 rounded-full bg-gradient-to-br from-rose-200/40 via-sky-200/30 to-emerald-200/40 blur-3xl dark:from-rose-500/10 dark:via-sky-500/10 dark:to-emerald-500/10" />
        <div className="absolute left-1/2 top-64 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-200/30 to-amber-100/40 blur-3xl dark:from-indigo-500/10 dark:to-amber-500/10" />
      </div>

      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease }}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.8, ease }}
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[12px] text-muted-foreground backdrop-blur-md"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Designed for 2026 Canadian payroll
          </motion.div>

          <h1 className="text-balance text-[clamp(2.6rem,7vw,5.25rem)] font-semibold leading-[1.02] tracking-tightest text-foreground">
            Canadian payroll.
            <br />
            <span className="bg-gradient-to-r from-foreground via-foreground/80 to-foreground/50 bg-clip-text text-transparent">
              Finally beautiful.
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease }}
            className="mx-auto mt-6 max-w-xl text-balance text-[17px] leading-relaxed text-muted-foreground"
          >
            The payroll system designed for modern Canadian businesses. CPP, EI,
            federal and provincial — calmly automated.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.8, ease }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <Link href="/dashboard">
              <Button size="lg" className="group">
                Start tracking
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setHowItWorksOpen(true)}
            >
              See how it works
            </Button>
          </motion.div>

          <HowItWorksModal
            open={howItWorksOpen}
            onClose={() => setHowItWorksOpen(false)}
          />

        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 1.1, ease }}
          className="relative mx-auto mt-20 max-w-5xl"
        >
          <HeroPayrollCards />
        </motion.div>
      </div>
    </section>
  );
}
