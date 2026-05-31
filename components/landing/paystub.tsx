"use client";

import { motion } from "framer-motion";
import { Download, Printer } from "lucide-react";
import { SectionLabel, SectionSub, SectionTitle } from "./section";

export function PaystubSection() {
  return (
    <section id="paystubs" className="relative py-32">
      <div className="container">
        <div className="grid gap-16 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div className="order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto max-w-[440px]"
            >
              <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-br from-amber-200/30 via-transparent to-emerald-200/30 blur-3xl dark:from-amber-500/10 dark:to-emerald-500/10" />
              <div className="relative overflow-hidden rounded-[28px] border border-border/70 bg-background shadow-glass">
                <div className="flex items-center justify-between border-b border-border/70 px-6 py-4">
                  <p className="text-[12px] font-medium tracking-tight text-muted-foreground">
                    Paystub · Apr 14 – Apr 27, 2026
                  </p>
                  <div className="flex gap-1">
                    <Btn>
                      <Printer className="h-3.5 w-3.5" />
                    </Btn>
                    <Btn>
                      <Download className="h-3.5 w-3.5" />
                    </Btn>
                  </div>
                </div>
                <div className="px-6 pt-6">
                  <p className="text-[12px] text-muted-foreground">
                    Net deposit
                  </p>
                  <p className="font-semibold tracking-tightest text-[42px] leading-none">
                    $2,718.<span className="text-muted-foreground/70">42</span>
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    To RBC ••• 5128 · May 1
                  </p>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-y-3 border-t border-border/70 px-6 py-5 text-[13px]">
                  <Row label="Regular" value="$3,538.46" />
                  <Row label="Vacation" value="$141.54" />
                  <Row label="Federal tax" value="−$408.12" />
                  <Row label="Ontario tax" value="−$184.65" />
                  <Row label="CPP" value="−$210.46" />
                  <Row label="EI" value="−$58.03" />
                </div>
                <div className="border-t border-border/70 bg-muted/60 px-6 py-4 text-[12px] text-muted-foreground">
                  Jordan Bell · SIN ••• 482 · Bi-weekly · Ontario
                </div>
              </div>
            </motion.div>
          </div>

          <div className="order-1 lg:order-2">
            <SectionLabel>Paystubs</SectionLabel>
            <SectionTitle>The paystub, re-imagined.</SectionTitle>
            <SectionSub>
              Clean. Printable. CRA-compliant. Email instantly or download as a
              tidy PDF — never wrestle with a spreadsheet again.
            </SectionSub>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <p className="text-muted-foreground">{label}</p>
      <p className="text-right font-medium tabular-nums">{value}</p>
    </>
  );
}

function Btn({ children }: { children: React.ReactNode }) {
  return (
    <button className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
      {children}
    </button>
  );
}
