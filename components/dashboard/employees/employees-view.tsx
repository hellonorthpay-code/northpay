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

// Light mode keeps a single, premium charcoal→silver gradient across all
// provinces. Dark mode keeps the playful per-province palette via the
// `dark:` variants — the warm palette pops on dark, but reads as candy
// on light backgrounds.
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
  // Point the modal scales out from — captured from the Add employee
  // button's centre so the open animation appears to originate from the
  // tap target (iOS-style). vw/vh captured at click time to avoid stale
  // window dimensions when the modal renders.
  const [addOrigin, setAddOrigin] = useState<{
    x: number;
    y: number;
    vw: number;
    vh: number;
  } | null>(null);
  const [openEmployeeId, setOpenEmployeeId] = useState<string | null>(null);

  /** Latest finalized paystub line per employee. */
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

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex max-w-sm flex-1 items-center">
          <Input
            placeholder=""
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pr-10"
            aria-label="Search employees"
          />
          {/* Icon AFTER input in DOM + z-10 so it paints above the input's backdrop blur. */}
          <Search className="pointer-events-none absolute right-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="ml-auto">
          <Button
            onClick={(e) => {
              // Capture the button's centre + viewport size together so the
              // modal's transform-origin math uses values from the same frame.
              const r = e.currentTarget.getBoundingClientRect();
              setAddOrigin({
                x: r.left + r.width / 2,
                y: r.top + r.height / 2,
                vw: window.innerWidth,
                vh: window.innerHeight,
              });
              setAddOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add employee
          </Button>
        </div>
      </div>

      {/* Spreadsheet — clean rows, no actions outside */}
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-xl">
        {/* Header row */}
        <div className="grid grid-cols-[1.5fr_1.3fr_1.2fr_28px] items-center gap-3 border-b border-border/60 bg-muted/30 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <span>Employee</span>
          <span>Latest paystub</span>
          <span>Next pay</span>
          <span />
        </div>

        {/* Body */}
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
                ? "No employees yet. Click “Add employee” to start."
                : `No employees match "${query}".`}
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
// One spreadsheet row — tap to open detail, or use the inline download to
// grab the latest paystub PDF without leaving the list.
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

  // Relative time depends on "today" → compute client-side after mount to
  // avoid SSR / client mismatch.
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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className="group grid w-full cursor-pointer grid-cols-[1.5fr_1.3fr_1.2fr_28px] items-center gap-3 px-5 py-3.5 text-left transition-colors duration-200 hover:bg-muted/40 focus:outline-none focus-visible:bg-muted/40"
    >
      {/* Employee — avatar + name + province (operational subtitle) */}
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-[12px] font-semibold text-white shadow-soft",
            PROVINCE_TONES[employee.province] ?? "from-zinc-300 to-zinc-200"
          )}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium tracking-tight">
            {employee.firstName} {employee.lastName}
          </p>
        </div>
      </div>

      {/* Latest paystub — amount + paid date + inline download */}
      <div className="min-w-0">
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

      {/* Next pay — anchor for the operator's "what's next?" scan */}
      <div className="min-w-0">
        {nextPayDate ? (
          <>
            <p
              className={cn(
                "text-[13.5px] font-medium tracking-tight tabular-nums",
                relative?.tone === "late" && "text-destructive",
                relative?.tone === "today" &&
                  "text-amber-600 dark:text-amber-400"
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
              {relative?.text ?? " "}
            </p>
          </>
        ) : (
          <p className="text-[12.5px] text-muted-foreground">
            Awaiting first run
          </p>
        )}
      </div>

      {/* iOS-style chevron */}
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
    </div>
  );
}
