"use client";

import { motion } from "framer-motion";
import { SectionLabel, SectionSub, SectionTitle } from "./section";

const ease = [0.22, 1, 0.36, 1] as const;

export function About() {
  return (
    // id="about" matches the nav's #about anchor.
    <section id="about" className="relative py-32">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>About NorthPay</SectionLabel>
          <SectionTitle>
            Built for Canadian payroll, top to bottom.
          </SectionTitle>
          <SectionSub className="mx-auto">
            NorthPay is the calm payroll tool we built for small Canadian
            businesses outside Quebec. Every CPP cent, every provincial
            bracket, every CRA remittance — calculated correctly, delivered
            on time, and presented in an interface that doesn&apos;t make you
            dread Friday afternoons.
          </SectionSub>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: 0.15, duration: 0.6, ease }}
            className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground"
          >
            CRA-compliant for the 2026 tax year, with the federal 14% lowest
            bracket, the updated CPP YMPE / YAMPE caps, the 1.63% EI premium,
            and every provincial table covering the nine non-Quebec
            jurisdictions. Run payroll, generate paystub PDFs, file your
            monthly PD7A, and ship T4s — all from the same place.
          </motion.p>
        </div>
      </div>
    </section>
  );
}
