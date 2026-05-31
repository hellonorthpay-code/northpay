"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePayrollRuns } from "@/lib/store/payroll";
import { formatCAD, formatDate } from "@/lib/utils";
import { PROVINCE_NAMES, type PayrollLineResult } from "@/lib/payroll/types";
import { PaystubSheet } from "./paystub-sheet";

const ease = [0.22, 1, 0.36, 1] as const;

export function PaystubsView() {
  const runs = usePayrollRuns((s) => s.runs);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<PayrollLineResult | null>(null);

  const allLines = useMemo(() => {
    const lines: PayrollLineResult[] = [];
    for (const run of runs) {
      for (const line of run.lines) lines.push(line);
    }
    return lines;
  }, [runs]);

  const filtered = allLines.filter((l) => {
    const q = query.toLowerCase();
    return (
      `${l.employee.firstName} ${l.employee.lastName}`
        .toLowerCase()
        .includes(q) ||
      l.employee.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search paystubs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <span className="ml-auto text-[13px] text-muted-foreground">
          {allLines.length} paystub{allLines.length === 1 ? "" : "s"} on file
        </span>
      </div>

      {allLines.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/40 p-16 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-[15px] font-medium tracking-tight">
            No paystubs yet
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Run a payroll to start your history.
          </p>
        </div>
      ) : (
        <motion.div
          layout
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {filtered.map((line, i) => (
            <motion.button
              key={line.employeeId + line.periodEnd + i}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025, duration: 0.4, ease }}
              onClick={() => setActive(line)}
              className="group text-left"
            >
              <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-5 shadow-soft backdrop-blur-xl transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-pop">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {formatDate(line.periodStart)} —{" "}
                    {formatDate(line.periodEnd)}
                  </p>
                  <span className="text-[10.5px] font-medium uppercase tracking-wider text-success">
                    Paid
                  </span>
                </div>
                <p className="mt-3 text-[15px] font-semibold tracking-tight">
                  {line.employee.firstName} {line.employee.lastName}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {PROVINCE_NAMES[line.employee.province]}
                </p>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Net</p>
                    <p className="text-[24px] font-semibold tracking-tightest tabular-nums">
                      {formatCAD(line.netPay)}
                    </p>
                  </div>
                  <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                    Tap to open
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {active && (
          <PaystubSheet line={active} onClose={() => setActive(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
