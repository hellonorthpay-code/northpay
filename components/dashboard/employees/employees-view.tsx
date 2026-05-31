"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Download, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEmployees } from "@/lib/store/employees";
import { usePayrollRuns } from "@/lib/store/payroll";
import { useSettings } from "@/lib/store/settings";
import { generatePaystubPDF } from "@/lib/pdf/paystub";
import {
  type Employee,
  type PayrollLineResult,
  type PayrollRun,
} from "@/lib/payroll/types";
import {
  cn,
  computeNextPay,
  formatCAD,
  formatDate,
  relativeFromToday,
  type RelativeFromToday,
} from "@/lib/utils";
import { AddEmployeeModal } from "./add-employee-modal";
import { EmployeeDetailSheet } from "./employee-detail-sheet";
import { EmployeesEmpty } from "./empty-state";

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

const ease = [0.22, 1, 0.36, 1] as const;

export function EmployeesView() {
  const employees = useEmployees((s) => s.employees);
  const runs = usePayrollRuns((s) => s.runs);
  const company = useSettings((s) => s.company);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addOrigin, setAddOrigin] = useState<{ x: number; y: number } | null>(null);
  const [openEmployeeId, setOpenEmployeeId] = useState<string | null>(null);

  const latestByEmployee = useMemo(() => {
    const map = new Map<string, PayrollLineResult>();
    for (const run of runs) {
      if (run.status !== "finalized") continue;
      for (const line of run.lines) {
        const cur = map.get(line.employeeId);
        if (!cur || cur.periodEnd < line.periodEnd) {
          map.set(line.employeeId, line);
        }
      }
    }
    return map;
  }, [runs]);

  const filtered = employees.filter((e) =>
    `${e.firstName} ${e.lastName} ${e.email}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  const openEmployee = openEmployeeId
    ? employees.find((e) => e.id === openEmployeeId) ?? null
    : null;

  // First-run hero — no toolbar, no list. The empty-state CTA opens the
  // same Add modal with a transform-origin that matches the tapped pixel.
  if (employees.length === 0) {
    return (
      <>
        <EmployeesEmpty
          onAdd={(origin) => {
            setAddOrigin(origin);
            setAddOpen(true);
          }}
        />
        <AddEmployeeModal
          open={addOpen}
          onOpenChange={setAddOpen}
          origin={addOrigin}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex flex-1 items-center">
          <Input
            placeholder=""
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pr-10"
            aria-label="Search employees"
          />
          <Search className="pointer-events-none absolute right-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <Button
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setAddOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
            setAddOpen(true);
          }}
          className="shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add employee</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-xl md:rounded-3xl">
        {/* Header — desktop only */}
        <div className="hidden grid-cols-[1.5fr_1.3fr_1.2fr_28px] items-center gap-3 border-b border-border/60 bg-muted/30 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground md:grid">
          <span>Employee</span>
          <span>Latest paystub</span>
          <span>Next pay</span>
          <span />
        </div>

        <div className="divide-y divide-border/50">
          <AnimatePresence initial={false}>
            {filtered.map((employee, i) => {
              const latest = latestByEmployee.get(employee.id) ?? null;
              return (
                <motion.div
                  key={employee.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.35, ease }}
                >
                  <Row
                    employee={employee}
                    latest={latest}
                    runs={runs}
                    company={company}
                    onOpen={() => setOpenEmployeeId(employee.id)}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filtered.length === 0 && (
            <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">
              {employees.length === 0
                ? "No employees yet. Tap “Add” to start."
                : `No employees match “${query}”.`}
            </p>
          )}
        </div>
      </div>

      <AddEmployeeModal
        open={addOpen}
        onOpenChange={setAddOpen}
        origin={addOrigin}
      />
      <AnimatePresence>
        {openEmployee && (
          <EmployeeDetailSheet
            employee={openEmployee}
            onClose={() => setOpenEmployeeId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Row — mobile: compact single-line card. Desktop: full 3-col table row.
// ─────────────────────────────────────────────────────────────────────────
function Row({
  employee,
  latest,
  runs,
  company,
  onOpen,
}: {
  employee: Employee;
  latest: PayrollLineResult | null;
  runs: PayrollRun[];
  company: ReturnType<typeof useSettings.getState>["company"];
  onOpen: () => void;
}) {
  const initials = `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`;
  const nextPayDate = useMemo(
    () => computeNextPay(latest?.periodEnd, employee.payFrequency),
    [latest?.periodEnd, employee.payFrequency]
  );

  const [relative, setRelative] = useState<RelativeFromToday | null>(null);
  useEffect(() => {
    if (nextPayDate) setRelative(relativeFromToday(nextPayDate));
    else setRelative(null);
  }, [nextPayDate]);

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    if (!latest) return;
    generatePaystubPDF(latest, company, runs);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  }

  const lateColor =
    relative?.tone === "late"
      ? "text-destructive"
      : relative?.tone === "today"
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className="group w-full cursor-pointer px-4 py-3.5 text-left transition-colors duration-200 hover:bg-muted/40 focus:outline-none focus-visible:bg-muted/40 md:grid md:grid-cols-[1.5fr_1.3fr_1.2fr_28px] md:items-center md:gap-3 md:px-5"
    >
      {/* Avatar + name row (shared mobile/desktop) */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-[12px] font-semibold text-white shadow-soft",
            PROVINCE_TONES[employee.province] ?? "from-zinc-300 to-zinc-200"
          )}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium tracking-tight">
            {employee.firstName} {employee.lastName}
          </p>

          {/* Mobile-only compact subtitle: amount · relative time */}
          <div className="mt-0.5 flex items-center gap-2 md:hidden">
            {latest ? (
              <span className="text-[12px] font-medium tabular-nums">
                {formatCAD(latest.netPay)}
              </span>
            ) : (
              <span className="text-[12px] text-muted-foreground">No paystubs</span>
            )}
            {nextPayDate && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span
                  suppressHydrationWarning
                  className={cn("text-[12px]", lateColor)}
                >
                  {relative?.text ?? formatDate(nextPayDate)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Mobile chevron */}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 md:hidden" />
      </div>

      {/* Desktop-only columns */}
      <div className="hidden min-w-0 md:block">
        {latest ? (
          <>
            <p className="text-[13.5px] font-medium tabular-nums tracking-tight">
              {formatCAD(latest.netPay)}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <p className="text-[11.5px] text-muted-foreground">
                Paid {formatDate(latest.periodEnd)}
              </p>
              <button
                type="button"
                onClick={handleDownload}
                aria-label="Download latest paystub"
                title="Download latest paystub"
                className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground/70 transition-all duration-200 hover:bg-muted hover:text-foreground"
              >
                <Download className="h-3 w-3" />
              </button>
            </div>
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">No paystubs yet</p>
        )}
      </div>

      <div className="hidden min-w-0 md:block">
        {nextPayDate ? (
          <>
            <p
              className={cn(
                "text-[13.5px] font-medium tracking-tight tabular-nums",
                relative?.tone === "late" && "text-destructive",
                relative?.tone === "today" && "text-amber-600 dark:text-amber-400"
              )}
            >
              Next {formatDate(nextPayDate)}
            </p>
            <p
              suppressHydrationWarning
              className={cn(
                "text-[11.5px]",
                relative?.tone === "late"
                  ? "font-medium text-destructive"
                  : relative?.tone === "today"
                  ? "font-medium text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              )}
            >
              {relative?.text ?? " "}
            </p>
          </>
        ) : (
          <p className="text-[12.5px] text-muted-foreground">Awaiting first run</p>
        )}
      </div>

      <ChevronRight className="hidden h-4 w-4 text-muted-foreground/50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-foreground md:block" />
    </div>
  );
}
