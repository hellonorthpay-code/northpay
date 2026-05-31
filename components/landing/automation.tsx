"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SectionLabel, SectionSub, SectionTitle } from "./section";

const steps = [
  { from: "Hours", to: "Gross", detail: "Hourly + OT + vacation" },
  { from: "Gross", to: "CPP / EI", detail: "Tiered + capped automatically" },
  { from: "Gross", to: "Federal", detail: "5 brackets · BPA credited" },
  { from: "Province", to: "Provincial", detail: "9 provinces · live surtax" },
  { from: "Sum", to: "Net pay", detail: "Settled in under a second" },
];

export function Automation() {
  return (
    <section id="automation" className="relative py-32">
      <div className="container">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <SectionLabel>Automation</SectionLabel>
            <SectionTitle>From hours to net pay, untouched by you.</SectionTitle>
            <SectionSub>
              Type once. The payroll engine handles every line of math —
              transparently, accurately, calmly.
            </SectionSub>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-br from-indigo-200/25 via-transparent to-rose-200/25 blur-3xl dark:from-indigo-500/10 dark:to-rose-500/10" />

            <div className="relative space-y-3">
              {steps.map((step, i) => (
                <motion.div
                  key={step.from + step.to}
                  initial={{ opacity: 0, x: 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{
                    delay: i * 0.08,
                    duration: 0.7,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="glass flex items-center justify-between gap-4 rounded-2xl px-5 py-4 shadow-soft"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="rounded-full bg-muted px-3 py-1 text-[12.5px] font-medium">
                      {step.from}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="rounded-full bg-foreground px-3 py-1 text-[12.5px] font-medium text-background">
                      {step.to}
                    </span>
                  </div>
                  <p className="hidden text-[12.5px] text-muted-foreground sm:block">
                    {step.detail}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
