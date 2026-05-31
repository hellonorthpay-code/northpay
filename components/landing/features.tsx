"use client";

import { motion } from "framer-motion";
import {
  Calculator,
  CalendarDays,
  Receipt,
  ShieldCheck,
  SunMedium,
  Users,
} from "lucide-react";
import { SectionLabel, SectionSub, SectionTitle } from "./section";

const items = [
  {
    icon: Calculator,
    title: "CRA-grade calculations",
    body:
      "Federal, provincial, CPP, CPP2 and EI — all calculated per CRA 2026 formulas, including BPA credits.",
  },
  {
    icon: Users,
    title: "Effortless employees",
    body:
      "Add a teammate in under a minute. Province, salary, vacation — intelligently grouped, never overwhelming.",
  },
  {
    icon: Receipt,
    title: "One-click paystubs",
    body:
      "Beautiful paystubs that print cleanly, export to PDF, and never feel like ancient HR software.",
  },
  {
    icon: ShieldCheck,
    title: "Compliant by default",
    body:
      "Province-aware overtime, vacation, statutory holidays. The right thing happens automatically.",
  },
  {
    icon: CalendarDays,
    title: "Any pay frequency",
    body:
      "Weekly, bi-weekly, semi-monthly, monthly. Switch without breaking history.",
  },
  {
    icon: SunMedium,
    title: "Calm by design",
    body:
      "Soft motion, generous spacing, real typography. A payroll tool that doesn't make you tired.",
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-32">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <SectionLabel>What's inside</SectionLabel>
          <SectionTitle>Built for the way you actually work.</SectionTitle>
          <SectionSub className="mx-auto">
            Every detail considered. Every screen quiet. Every calculation right.
          </SectionSub>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                delay: i * 0.06,
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="group relative overflow-hidden rounded-3xl border border-border/70 bg-card/60 p-7 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-soft hover:bg-card"
            >
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-muted text-foreground">
                <item.icon className="h-[18px] w-[18px]" />
              </div>
              <h3 className="mt-5 text-[17px] font-semibold tracking-tight">
                {item.title}
              </h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
