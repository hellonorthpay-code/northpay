"use client";

import { Building2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Static, mobile-friendly version of the desktop "EmployeesScene" — the
 * business → employees → paystubs tree. The desktop scene is a 280vh
 * scroll-driven animation that can't translate to a phone, so on mobile we show
 * this calm, static snapshot of the final result instead. No framer / no
 * scroll work, so it's cheap and never affects tap responsiveness.
 */
const EMPLOYEES = [
  { amount: "$2,610.63", tone: "from-rose-300 to-amber-200" },
  { amount: "$2,295.48", tone: "from-sky-300 to-emerald-200" },
  { amount: "$827.37", tone: "from-indigo-300 to-sky-200" },
] as const;

export function PayrollTreeMobile() {
  return (
    <section className="px-5 py-16">
      <div className="mx-auto flex max-w-sm flex-col items-center text-center duration-700 animate-in fade-in slide-in-from-bottom-4">
        {/* Business node */}
        <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-slate-600 to-slate-400 text-white shadow-pop">
          <Building2 className="h-6 w-6" />
        </div>
        <p className="mt-3 text-[15px] font-semibold tracking-tight">
          Your business
        </p>
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Payroll · this period
        </p>

        {/* Connector */}
        <div className="my-5 h-8 w-px bg-border" />

        {/* Employees → paystubs */}
        <div className="grid w-full grid-cols-3 gap-2.5">
          {EMPLOYEES.map((e) => (
            <div key={e.amount} className="flex flex-col items-center">
              <div
                className={cn(
                  "relative grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br text-[9px] font-medium text-white/90 shadow-soft",
                  e.tone
                )}
              >
                Staff
                <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-background bg-success text-white">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              </div>
              <p className="mt-2 text-[12px] font-semibold tabular-nums tracking-tight">
                {e.amount}
              </p>

              {/* Mini paystub card */}
              <div className="mt-3 w-full rounded-xl border border-border/70 bg-card p-2 shadow-soft">
                <p className="text-[7px] uppercase tracking-[0.14em] text-muted-foreground">
                  Paystub
                </p>
                <div className="mt-1.5 space-y-1">
                  <div className="h-1 w-3/4 rounded-full bg-muted" />
                  <div className="h-1 w-1/2 rounded-full bg-muted" />
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-[7px] font-semibold uppercase tracking-wide text-success">
                    Net
                  </span>
                  <span className="h-1 w-5 rounded-full bg-success/70" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-[20px] font-semibold leading-tight tracking-tightest">
          Paid. Paystubs generated.
        </p>
      </div>
    </section>
  );
}
