"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Clock4, Sparkles } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

export function HeroPayrollCards() {
  return (
    <div className="relative h-[440px]">
      {/* Soft reflective glow */}
      <div className="absolute inset-x-10 -bottom-12 h-32 rounded-full bg-foreground/10 blur-3xl" />

      {/* Main central card */}
      <motion.div
        initial={{ y: 20, opacity: 0, rotate: -1 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ duration: 1.1, ease }}
        className="absolute left-1/2 top-6 z-20 w-[460px] -translate-x-1/2"
      >
        <div className="glass-strong overflow-hidden rounded-[28px] shadow-glass">
          <div className="flex items-center justify-between px-6 pt-5">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <span className="text-[11px] text-muted-foreground">Payroll · Apr 14 — Apr 27</span>
          </div>
          <div className="px-6 pt-6">
            <p className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
              Net pay this period
            </p>
            <p className="mt-1 font-semibold tracking-tightest text-[44px] leading-none">
              $47,128.<span className="text-muted-foreground/70">94</span>
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ready to run · 14 employees
            </p>
          </div>
          <div className="mt-6 grid grid-cols-3 divide-x divide-border/60 border-t border-border/60">
            <Mini label="Federal" value="$5,210" />
            <Mini label="Provincial" value="$3,476" />
            <Mini label="CPP + EI" value="$4,019" />
          </div>
        </div>
      </motion.div>

      {/* Left employee card */}
      <motion.div
        initial={{ x: -20, y: 0, opacity: 0, rotate: -6 }}
        animate={{ x: 0, y: 0, opacity: 1, rotate: -6 }}
        transition={{ duration: 1.2, delay: 0.15, ease }}
        className="absolute left-2 top-32 z-10 w-[260px] animate-float"
        style={{ animationDelay: "0s" }}
      >
        <div className="glass-strong rounded-3xl p-5 shadow-glass">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-pink-300 to-amber-200 text-[13px] font-semibold text-white">
              JB
            </div>
            <div>
              <p className="text-[13px] font-medium leading-tight">Jordan Bell</p>
              <p className="text-[11px] text-muted-foreground">Ontario · Salary</p>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground">Net</p>
              <p className="font-semibold tracking-tight">$2,718.42</p>
            </div>
            <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
              Ready
            </span>
          </div>
        </div>
      </motion.div>

      {/* Right province card */}
      <motion.div
        initial={{ x: 20, y: 0, opacity: 0, rotate: 6 }}
        animate={{ x: 0, y: 0, opacity: 1, rotate: 6 }}
        transition={{ duration: 1.2, delay: 0.2, ease }}
        className="absolute right-2 top-28 z-10 w-[260px] animate-float"
        style={{ animationDelay: "1.5s" }}
      >
        <div className="glass-strong rounded-3xl p-5 shadow-glass">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Auto calculation
          </div>
          <p className="mt-3 text-[13px] leading-snug text-foreground/90">
            <span className="font-semibold">Priya, BC</span> — hourly + 4 OT hrs +
            vacation accrual at 6%.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <Tag label="BC tax" />
            <Tag label="CPP" />
            <Tag label="EI" />
          </div>
        </div>
      </motion.div>

      {/* Bottom timer card */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.35, ease }}
        className="absolute bottom-0 left-1/2 z-30 -translate-x-1/2"
      >
        <div className="glass-strong flex items-center gap-3 rounded-2xl px-4 py-2.5 shadow-soft">
          <Clock4 className="h-4 w-4 text-muted-foreground" />
          <span className="text-[12.5px]">
            Calculated in <strong className="font-semibold">0.6s</strong>
          </span>
          <span className="h-3.5 w-px bg-border" />
          <span className="text-[12.5px] text-muted-foreground">
            CRA-compliant
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[15px] font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-border bg-background/50 px-2 py-0.5 text-center text-[10.5px] text-muted-foreground">
      {label}
    </span>
  );
}
