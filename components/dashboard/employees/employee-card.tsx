"use client";

import { motion } from "framer-motion";
import { Calendar, FileDown, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCAD, formatDate } from "@/lib/utils";
import { PROVINCE_NAMES, type Employee } from "@/lib/payroll/types";
import { useSettings } from "@/lib/store/settings";
import { usePayrollRuns } from "@/lib/store/payroll";
import { generateT4PDF } from "@/lib/pdf/t4";
import { TAX_YEAR } from "@/lib/payroll/constants";

// Light: uniform charcoal→silver. Dark: original per-province palette.
const PROVINCE_TONES: Record<string, string> = {
  ON: "from-slate-700 to-slate-400 dark:from-rose-300 dark:to-amber-200",
  AB: "from-slate-700 to-slate-400 dark:from-amber-300 dark:to-orange-200",
  BC: "from-slate-700 to-slate-400 dark:from-sky-300 dark:to-emerald-200",
  MB: "from-slate-700 to-slate-400 dark:from-violet-300 dark:to-pink-200",
  SK: "from-slate-700 to-slate-400 dark:from-emerald-300 dark:to-lime-200",
  NS: "from-slate-700 to-slate-400 dark:from-indigo-300 dark:to-sky-200",
  NB: "from-slate-700 to-slate-400 dark:from-pink-300 dark:to-violet-200",
  PE: "from-slate-700 to-slate-400 dark:from-rose-300 dark:to-violet-200",
  NL: "from-slate-700 to-slate-400 dark:from-blue-300 dark:to-indigo-200",
};

export function EmployeeCard({ employee }: { employee: Employee }) {
  const company = useSettings((s) => s.company);
  const runs = usePayrollRuns((s) => s.runs);

  const initials = `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`;
  const compRate =
    employee.employmentType === "salary"
      ? `${formatCAD(employee.annualSalary ?? 0)} / yr`
      : `${formatCAD(employee.hourlyRate ?? 0)} / hr`;

  const hasRuns = runs.some((r) =>
    r.lines.some((l) => l.employeeId === employee.id)
  );

  function handleDownloadT4() {
    generateT4PDF(employee, company, runs, TAX_YEAR);
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="group relative h-full overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-5 shadow-soft backdrop-blur-xl transition-all duration-300 hover:shadow-pop"
    >
      <div className="flex items-start gap-3">
        <div
          className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${
            PROVINCE_TONES[employee.province] ?? "from-zinc-300 to-zinc-200"
          } text-[13px] font-semibold text-white shadow-soft`}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-tight">
            {employee.firstName} {employee.lastName}
          </p>
          <p className="truncate text-[12.5px] text-muted-foreground">
            {employee.email}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="default">
              <MapPin className="h-3 w-3" />
              {PROVINCE_NAMES[employee.province]}
            </Badge>
            <Badge variant={employee.employmentType === "salary" ? "info" : "outline"}>
              {employee.employmentType === "salary" ? "Salary" : "Hourly"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border/60 pt-4 text-[12.5px]">
        <Field label="Compensation" value={compRate} />
        <Field
          label="Cycle"
          value={employee.payFrequency
            .replace("semimonthly", "semi-monthly")
            .replace("semiannually", "semi-annually")}
        />
        <Field label="Vacation" value={`${employee.vacationPercent}%`} />
        <Field label="Since" value={formatDate(employee.startDate)} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-[11.5px]">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Next pay · May 1
        </span>
        <button
          onClick={handleDownloadT4}
          disabled={!hasRuns}
          title={
            hasRuns
              ? `Download ${TAX_YEAR} T4 slip`
              : `Run payroll first to generate T4`
          }
          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 font-medium text-foreground/80 transition-all duration-200 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileDown className="h-3 w-3" />
          T4 {TAX_YEAR}
        </button>
      </div>
    </motion.div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate font-medium capitalize tracking-tight">
        {value}
      </p>
    </div>
  );
}
