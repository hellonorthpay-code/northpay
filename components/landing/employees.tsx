"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionLabel, SectionSub, SectionTitle } from "./section";
import { Button } from "@/components/ui/button";

export function EmployeesSection() {
  return (
    <section className="relative py-32">
      <div className="container">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <SectionLabel>Employees</SectionLabel>
            <SectionTitle>Modern employee management.</SectionTitle>
            <SectionSub>
              No clutter. Just the inputs you need, grouped the way you think —
              and a quiet animation when each one lands.
            </SectionSub>
            <div className="mt-8">
              <Link href="/dashboard">
                <Button size="lg" className="group">
                  Open the app
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </Button>
              </Link>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3"
          >
            {EMPLOYEES.map((e, i) => (
              <motion.div
                key={e.name}
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  delay: i * 0.07,
                  duration: 0.6,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="glass flex items-center justify-between rounded-2xl px-5 py-4 shadow-soft"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-10 w-10 place-items-center rounded-full text-[12px] font-semibold text-white"
                    style={{ background: e.color }}
                  >
                    {e.initials}
                  </div>
                  <div>
                    <p className="text-[14.5px] font-medium leading-tight tracking-tight">
                      {e.name}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {e.role} · {e.province}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-semibold tabular-nums">
                    {e.amount}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{e.cycle}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

const EMPLOYEES = [
  {
    name: "Jordan Bell",
    initials: "JB",
    role: "Engineering",
    province: "Ontario",
    amount: "$2,718.42",
    cycle: "Bi-weekly",
    color: "linear-gradient(135deg, #fda4af, #fcd34d)",
  },
  {
    name: "Priya Sharma",
    initials: "PS",
    role: "Operations",
    province: "British Columbia",
    amount: "$1,946.10",
    cycle: "Bi-weekly",
    color: "linear-gradient(135deg, #a5b4fc, #93c5fd)",
  },
  {
    name: "Liam Tremblay",
    initials: "LT",
    role: "Design",
    province: "Alberta",
    amount: "$3,612.55",
    cycle: "Semi-monthly",
    color: "linear-gradient(135deg, #86efac, #5eead4)",
  },
  {
    name: "Sage MacKenzie",
    initials: "SM",
    role: "Support",
    province: "Nova Scotia",
    amount: "$842.16",
    cycle: "Weekly",
    color: "linear-gradient(135deg, #c4b5fd, #f0abfc)",
  },
];
