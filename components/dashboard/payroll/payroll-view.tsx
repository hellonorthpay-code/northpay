"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Clock,
  Download,
  Pencil,
  PlayCircle,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmployees } from "@/lib/store/employees";
import { usePayrollRuns } from "@/lib/store/payroll";
import { useSettings } from "@/lib/store/settings";
import { cn, formatCAD, formatDate } from "@/lib/utils";
import {
  type Employee,
  type PayrollLineInput,
  type PayrollLineResult,
  type PayrollRun,
} from "@/lib/payroll/types";
import { PayrollLifecycleService } from "@/lib/services/lifecycle";
import { getRepositories } from "@/lib/repositories";
import { generatePaystubPDF } from "@/lib/pdf/paystub";
import type { ValidationIssue } from "@/lib/services/validation";
import { ConfirmPayrollModal } from "./confirm-payroll-modal";

const ease = [0.22, 1, 0.36, 1] as const;

const SSR_PERIOD = {
  periodStart: "2026-04-14",
  periodEnd: "2026-04-27",
  payDate: "2026-05-01",
};

function computePeriod() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 13);
  const end = new Date(today);
  const pay = new Date(today);
  pay.setDate(today.getDate() + 4);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
    payDate: pay.toISOString().slice(0, 10),
  };
}

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

/**
 * Auto-dispatch paystub emails after a successful run.
 *
 * For each line with an employee email + positive net:
 *   1. Download the paystub PDF
 *   2. Open a mailto: draft with subject + body pre-filled
 *
 * Browsers only reliably open one mailto: per user gesture; we stagger by
 * 800 ms which works in Safari/Chrome for ~2–3 drafts and the PDFs always
 * download so the operator can attach manually to any that didn't open.
 *
 * Returns the number of emails dispatched.
 */
function dispatchEmails(
  run: PayrollRun,
  allRuns: PayrollRun[],
  company: { operatingName: string; legalName: string },
): number {
  let count = 0;
  run.lines.forEach((line, i) => {
    const emp = line.employee;
    if (!emp.email) return;
    if (line.netPay <= 0) return;

    // Download the PDF immediately (gives the operator the file)
    generatePaystubPDF(line, company as any, allRuns);

    const dateRange = `${line.periodStart} → ${line.periodEnd}`;
    const subject = `Your paystub — ${dateRange}`;
    const taxes = line.federalTax + line.provincialTax;
    const cpp = line.cppEmployee + line.cpp2Employee;
    const body = [
      `Hi ${emp.firstName},`,
      ``,
      `Please find attached your paystub for ${dateRange}.`,
      ``,
      `   Pay date:        ${line.periodEnd}`,
      `   Gross pay:       $${line.grossPay.toFixed(2)}`,
      `   Federal tax:     $${line.federalTax.toFixed(2)}`,
      `   Provincial tax:  $${line.provincialTax.toFixed(2)}`,
      `   CPP:             $${cpp.toFixed(2)}`,
      `   EI:              $${line.eiEmployee.toFixed(2)}`,
      `   ─────────────────────────────`,
      `   Net deposit:     $${line.netPay.toFixed(2)}`,
      ``,
      `(The PDF was just downloaded to your computer — please attach it before sending.)`,
      ``,
      `Best regards,`,
      `${company.operatingName}`,
    ].join("\n");

    const url = `mailto:${emp.email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;

    // Stagger opens so the OS mail app can keep up. CRITICAL: use
    // window.open(_self via about:blank → mailto) rather than assigning
    // window.location.href — that assignment was treated as a real top-
    // level navigation and tore down the React tree mid-animation,
    // freezing the "Processing payroll" modal on prod. window.open with
    // a mailto URL hands off to the OS mail app without unloading the
    // current document.
    setTimeout(() => {
      try {
        const w = window.open(url, "_blank");
        // Most browsers immediately close the blank tab once the OS
        // hands off the mailto — but if the popup was blocked, fall
        // back to a hidden anchor click which also avoids navigation.
        if (!w) {
          const a = document.createElement("a");
          a.href = url;
          a.rel = "noopener";
          a.click();
        }
      } catch (e) {
        console.warn("[payroll] mailto dispatch failed", e);
      }
    }, i * 800);

    count++;
  });
  return count;
}

function defaultRegularHours(emp: Employee): number {
  if (emp.employmentType === "salary") return 0;
  const std = emp.standardWeeklyHours || 40;
  const weeks =
    emp.payFrequency === "weekly"
      ? 1
      : emp.payFrequency === "biweekly"
      ? 2
      : emp.payFrequency === "semimonthly"
      ? 2.1667
      : 4.3333;
  return Math.round(std * weeks);
}

// Tabular grid template — used in header AND rows so columns align exactly.
//   [check] [avatar] [name 1fr] [hrs] [bonus] [stat] [net] [chevron]
const GRID_TEMPLATE =
  "grid-cols-[24px_28px_minmax(0,1fr)_72px_84px_84px_104px_20px]";

// ─────────────────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────────────────
export function PayrollView() {
  const employees = useEmployees((s) => s.employees);
  const runs = usePayrollRuns((s) => s.runs);
  const upsertRun = usePayrollRuns((s) => s.upsertRun);
  const [period, setPeriod] = useState(SSR_PERIOD);

  useEffect(() => {
    setPeriod(computePeriod());
  }, []);

  const [doneRunId, setDoneRunId] = useState<string | null>(null);
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [warnings, setWarnings] = useState<ValidationIssue[]>([]);

  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [lineInputs, setLineInputs] = useState<
    Map<string, PayrollLineInput>
  >(new Map());
  /** When on, paystub PDFs + mailto drafts open for every employee after run. */
  const [emailAfter, setEmailAfter] = useState(false);
  const company = useSettings((s) => s.company);
  const [emailedCount, setEmailedCount] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const activeEmployees = useMemo(
    () => employees.filter((e) => !excludedIds.has(e.id)),
    [employees, excludedIds]
  );

  const inputsArray = useMemo(() => {
    const arr: PayrollLineInput[] = [];
    for (const emp of activeEmployees) {
      const cur = lineInputs.get(emp.id);
      if (cur) arr.push(cur);
    }
    return arr;
  }, [activeEmployees, lineInputs]);

  const lifecycle = useMemo(
    () => new PayrollLifecycleService(getRepositories(), runs),
    [runs]
  );

  const preview = useMemo(
    () =>
      lifecycle.preview({
        employees: activeEmployees,
        inputs: inputsArray,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        payDate: period.payDate,
      }),
    [lifecycle, activeEmployees, inputsArray, period]
  );

  const previewByEmployeeId = useMemo(() => {
    const m = new Map<string, PayrollLineResult>();
    preview.lines.forEach((l) => m.set(l.employeeId, l));
    return m;
  }, [preview]);

  function toggleExcluded(id: string) {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setEmployeeInput(id: string, patch: Partial<PayrollLineInput>) {
    setLineInputs((prev) => {
      const next = new Map(prev);
      const current = next.get(id) ?? { employeeId: id };
      next.set(id, { ...current, ...patch, employeeId: id });
      return next;
    });
  }

  function selectAll() {
    setExcludedIds(new Set());
  }
  function selectNone() {
    setExcludedIds(new Set(employees.map((e) => e.id)));
  }

  /**
   * Called by the confirm modal after the user slides to run.
   * Returns ok=false to signal the modal to close so the page-level
   * validation error card can render.
   */
  async function performFinalize(): Promise<{
    ok: boolean;
    netPaid?: number;
    emailedCount?: number;
  }> {
    setErrors([]);
    setWarnings([]);

    try {
      const result = await lifecycle.finalize({
        employees: activeEmployees,
        inputs: inputsArray,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        payDate: period.payDate,
      });

      if (!result.ok) {
        setErrors(result.result.errors);
        setWarnings(result.result.warnings);
        return { ok: false };
      }

      upsertRun(result.run);
      setWarnings(result.warnings);
      setDoneRunId(result.run.id);

      // Email dispatch is best-effort — failures here should NEVER block
      // the success path. The run is already persisted.
      let sentCount = 0;
      if (emailAfter) {
        try {
          const allRuns = await getRepositories().payroll.getAll();
          sentCount = dispatchEmails(result.run, allRuns, company);
        } catch (e) {
          console.warn("[payroll] email dispatch failed (non-fatal):", e);
        }
      }
      setEmailedCount(sentCount);

      return {
        ok: true,
        netPaid: result.run.totals.net,
        emailedCount: sentCount,
      };
    } catch (err) {
      // Surface engine/persist errors as a top-level validation issue so
      // the modal closes cleanly and the page shows what went wrong.
      console.error("[payroll] performFinalize threw:", err);
      // Supabase PostgrestError is a plain object, not an Error instance.
      // Stringify whatever we got so the user sees the actual cause
      // ("permission denied", "violates RLS policy", "column does not
      // exist", etc.) instead of a useless generic.
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null
            ? // @ts-expect-error — best-effort introspection
              err.message || err.error_description || err.details ||
              JSON.stringify(err)
            : String(err) || "Failed to save payroll run.";
      setErrors([
        {
          code: "PERSIST_FAILED",
          message,
        } as ValidationIssue,
      ]);
      return { ok: false };
    }
  }

  const totalDeductions =
    preview.totals.federalTax +
    preview.totals.provincialTax +
    preview.totals.cpp +
    preview.totals.cpp2 +
    preview.totals.ei;

  const allExcluded =
    excludedIds.size === employees.length && employees.length > 0;

  return (
    <div className="space-y-5">
      <SummaryCard
        netPay={preview.totals.net}
        gross={preview.totals.gross}
        deductions={totalDeductions}
        employerCost={preview.totals.employerCost}
        period={period}
        onPeriodChange={setPeriod}
        onPeriodReset={() => setPeriod(computePeriod())}
        employeeCount={activeEmployees.length}
        totalCount={employees.length}
        onOpen={() => setConfirmOpen(true)}
        canRun={activeEmployees.length > 0}
      />

      <AnimatePresence>
        {errors.length > 0 && (
          <motion.div
            key="errors"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.35, ease }}
            className="overflow-hidden rounded-3xl border border-destructive/30 bg-destructive/10 p-5 text-destructive"
          >
            <p className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
              <AlertCircle className="h-4 w-4" />
              Payroll blocked
            </p>
            <ul className="mt-2 space-y-1 text-[12.5px] opacity-90">
              {errors.map((e) => (
                <li key={e.code + (e.employeeId ?? "")}>· {e.message}</li>
              ))}
            </ul>
          </motion.div>
        )}
        {warnings.length > 0 && errors.length === 0 && (
          <motion.div
            key="warnings"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.35, ease }}
            className="overflow-hidden rounded-3xl border border-amber-300/40 bg-amber-100/40 p-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          >
            <p className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
              <AlertCircle className="h-4 w-4" />
              Heads up
            </p>
            <ul className="mt-2 space-y-1 text-[12.5px] opacity-90">
              {warnings.map((w) => (
                <li key={w.code + (w.employeeId ?? "")}>· {w.message}</li>
              ))}
            </ul>
          </motion.div>
        )}
        {doneRunId && emailedCount === 0 && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.45, ease }}
            className="overflow-hidden rounded-3xl border border-success/30 bg-success/10 p-5 text-success"
          >
            <p className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
              <CheckCircle2 className="h-4 w-4" />
              Paystubs ready to send
            </p>
            <p className="mt-1 text-[12.5px] opacity-80">
              {activeEmployees.length} paystubs generated. Open Employees to
              send them individually.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <PayrollGrid
        employees={employees}
        previewByEmployeeId={previewByEmployeeId}
        excludedIds={excludedIds}
        lineInputs={lineInputs}
        onToggleExclude={toggleExcluded}
        onUpdateInput={setEmployeeInput}
        onSelectAll={selectAll}
        onSelectNone={selectNone}
        allExcluded={allExcluded}
      />

      <PayrollHistory runs={runs} company={company} />

      <ConfirmPayrollModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={performFinalize}
        netPay={preview.totals.net}
        period={period}
        lines={preview.lines}
        emailableCount={
          activeEmployees.filter((e) => e.email && e.email.trim().length > 0)
            .length
        }
        emailAfter={emailAfter}
        onToggleEmail={setEmailAfter}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Summary card (unchanged shape)
// ─────────────────────────────────────────────────────────────────────────
function SummaryCard({
  netPay,
  gross,
  deductions,
  employerCost,
  period,
  onPeriodChange,
  onPeriodReset,
  employeeCount,
  totalCount,
  onOpen,
  canRun,
}: {
  netPay: number;
  gross: number;
  deductions: number;
  employerCost: number;
  period: { periodStart: string; periodEnd: string; payDate: string };
  onPeriodChange: (next: {
    periodStart: string;
    periodEnd: string;
    payDate: string;
  }) => void;
  onPeriodReset: () => void;
  employeeCount: number;
  totalCount: number;
  onOpen: () => void;
  canRun: boolean;
}) {
  const pencilRef = useRef<HTMLButtonElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function openEditor() {
    if (!pencilRef.current) return;
    const rect = pencilRef.current.getBoundingClientRect();
    const popoverWidth = 280;
    const margin = 12;
    const left = Math.min(
      rect.left,
      window.innerWidth - popoverWidth - margin
    );
    setPos({ top: rect.bottom + 8, left: Math.max(margin, left) });
    setEditOpen((v) => !v);
  }

  // Close on outside click / Escape
  useEffect(() => {
    if (!editOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEditOpen(false);
    }
    function handleClick(e: MouseEvent) {
      const target = e.target as Element;
      if (
        target.closest('[data-period-popover="true"]') ||
        target.closest('[data-period-trigger="true"]')
      )
        return;
      setEditOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleClick);
    };
  }, [editOpen]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-5 shadow-soft backdrop-blur-xl md:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-rose-200/30 blur-3xl dark:bg-rose-500/10" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-500/10" />

      <div className="relative grid gap-6 sm:grid-cols-[1.4fr_auto] sm:items-end">
        <div>
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>
              Next payroll · {formatDate(period.periodStart)} —{" "}
              {formatDate(period.periodEnd)}
            </span>
            <button
              ref={pencilRef}
              data-period-trigger="true"
              onClick={openEditor}
              aria-label="Edit pay period"
              title="Edit pay period"
              className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground/70 transition-colors duration-200 hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </p>
          <p className="mt-3 text-[34px] font-semibold leading-none tracking-tightest tabular-nums md:text-[44px]">
            {formatCAD(netPay)}
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground md:text-[13px]">
            Net to {employeeCount} of {totalCount} employee
            {totalCount === 1 ? "" : "s"} · pay date {formatDate(period.payDate)}
          </p>
        </div>
        <div className="self-center sm:self-end">
          <Button
            size="lg"
            className="w-full sm:w-auto"
            disabled={!canRun}
            onClick={onOpen}
          >
            <PlayCircle className="h-4 w-4" />
            Run payroll
          </Button>
        </div>
      </div>

      <div className="relative mt-5 hidden grid-cols-3 divide-x divide-border/60 rounded-2xl border border-border/60 bg-background/40 text-center md:mt-7 md:grid">
        <Stat label="Gross" value={formatCAD(gross)} />
        <Stat label="Deductions" value={formatCAD(deductions)} />
        <Stat label="Employer" value={formatCAD(employerCost)} />
      </div>

      {/* Inline edit popover — portaled so the card's overflow-hidden can stay */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {editOpen && (
              <motion.div
                data-period-popover="true"
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{ duration: 0.18, ease }}
                style={{
                  position: "fixed",
                  top: pos.top,
                  left: pos.left,
                  zIndex: 80,
                }}
                className="w-[280px] origin-top-left rounded-2xl border border-border bg-background shadow-pop"
              >
                <p className="border-b border-border/60 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Pay period
                </p>
                <div className="space-y-3 px-4 py-4">
                  <DateField
                    label="Period start"
                    value={period.periodStart}
                    max={period.periodEnd}
                    onChange={(v) =>
                      onPeriodChange({ ...period, periodStart: v })
                    }
                  />
                  <DateField
                    label="Period end"
                    value={period.periodEnd}
                    min={period.periodStart}
                    onChange={(v) =>
                      onPeriodChange({ ...period, periodEnd: v })
                    }
                  />
                  <DateField
                    label="Pay date"
                    value={period.payDate}
                    min={period.periodEnd}
                    onChange={(v) => onPeriodChange({ ...period, payDate: v })}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-4 py-2.5">
                  <button
                    onClick={() => onPeriodReset()}
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset to default
                  </button>
                  <button
                    onClick={() => setEditOpen(false)}
                    className="rounded-full bg-foreground px-3 py-1 text-[11.5px] font-medium text-background transition-colors hover:bg-foreground/90"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

/** Date input with a label — used inside the period editor popover. */
function DateField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] tabular-nums text-foreground transition-colors duration-200 focus:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/10"
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-3 md:px-5 md:py-4">
      <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground md:text-[10.5px] md:tracking-[0.14em]">
        {label}
      </p>
      <p className="mt-1 text-[12.5px] font-semibold tabular-nums tracking-tight md:text-[14px]">
        {value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Numbers-style grid
// ─────────────────────────────────────────────────────────────────────────
function PayrollGrid({
  employees,
  previewByEmployeeId,
  excludedIds,
  lineInputs,
  onToggleExclude,
  onUpdateInput,
  onSelectAll,
  onSelectNone,
  allExcluded,
}: {
  employees: Employee[];
  previewByEmployeeId: Map<string, PayrollLineResult>;
  excludedIds: Set<string>;
  lineInputs: Map<string, PayrollLineInput>;
  onToggleExclude: (id: string) => void;
  onUpdateInput: (id: string, patch: Partial<PayrollLineInput>) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  allExcluded: boolean;
}) {
  if (employees.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/40 p-10 text-center text-[13px] text-muted-foreground">
        Add an employee in the Employees tab to enable payroll.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-xl">
      {/* Title bar */}
      <div className="flex items-center justify-between rounded-t-3xl border-b border-border/60 bg-muted/30 px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <span className="md:hidden">Employees</span>
          <span className="hidden md:inline">Employees in this run</span>
        </p>
        <button
          onClick={allExcluded ? onSelectAll : onSelectNone}
          className="rounded-full px-2.5 py-1 text-[10.5px] font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground md:block hidden"
        >
          {allExcluded ? "Include all" : "Skip all"}
        </button>
        {/* Mobile: icon-only toggle */}
        <button
          onClick={allExcluded ? onSelectAll : onSelectNone}
          aria-label={allExcluded ? "Include all" : "Skip all"}
          className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground md:hidden"
        >
          {allExcluded
            ? <Check className="h-3.5 w-3.5" strokeWidth={3} />
            : <X className="h-3.5 w-3.5" strokeWidth={2.5} />}
        </button>
      </div>

      {/* Column headers — tabular grid (desktop only) */}
      <div
        className={cn(
          "hidden items-center gap-3 border-b border-border/40 bg-background/30 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 md:grid",
          GRID_TEMPLATE
        )}
      >
        <span />
        <span />
        <span>Employee</span>
        <span className="text-right">Hrs</span>
        <span className="text-right">Bonus</span>
        <span className="text-center">Stat</span>
        <span className="text-right">Net pay</span>
        <span />
      </div>

      {/* Data rows */}
      <div className="divide-y divide-border/30">
        {employees.map((employee) => (
          <GridRow
            key={employee.id}
            employee={employee}
            line={previewByEmployeeId.get(employee.id) ?? null}
            excluded={excludedIds.has(employee.id)}
            input={lineInputs.get(employee.id)}
            onToggleExclude={() => onToggleExclude(employee.id)}
            onUpdateInput={(patch) => onUpdateInput(employee.id, patch)}
          />
        ))}
      </div>
    </div>
  );
}

function GridRow({
  employee,
  line,
  excluded,
  input,
  onToggleExclude,
  onUpdateInput,
}: {
  employee: Employee;
  line: PayrollLineResult | null;
  excluded: boolean;
  input?: PayrollLineInput;
  onToggleExclude: () => void;
  onUpdateInput: (patch: Partial<PayrollLineInput>) => void;
}) {
  const [statModalOpen, setStatModalOpen] = useState(false);
  const initials = `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`;
  const isHourly = employee.employmentType === "hourly";
  const defaultRegular = defaultRegularHours(employee);

  const avatar = (
    <div
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-[10px] font-semibold text-white shadow-soft",
        PROVINCE_TONES[employee.province] ?? "from-zinc-300 to-zinc-200"
      )}
    >
      {initials}
    </div>
  );

  const checkbox = (
    <button
      onClick={onToggleExclude}
      aria-label={excluded ? "Include employee" : "Skip employee"}
      className={cn(
        "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-[1.5px] transition-all duration-200",
        !excluded
          ? "border-success bg-success text-success-foreground"
          : "border-muted-foreground/40 bg-transparent text-transparent hover:border-muted-foreground/70"
      )}
    >
      <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
    </button>
  );

  return (
    <div>
      {/* ── Desktop: tabular grid row ── */}
      <div
        className={cn(
          "hidden items-center gap-3 px-5 py-3 text-[13px] transition-colors duration-200 hover:bg-muted/30 md:grid",
          GRID_TEMPLATE,
          excluded && "opacity-45"
        )}
      >
        {checkbox}
        {avatar}

        {/* Employee name + type */}
        <div className="min-w-0">
          <p className="truncate font-medium tracking-tight">
            {employee.firstName} {employee.lastName}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {isHourly
              ? `Hourly · ${formatCAD(employee.hourlyRate ?? 0)}/hr`
              : `Salary · ${formatCAD(employee.annualSalary ?? 0)}/yr`}
          </p>
        </div>

        {/* Hrs — editable for hourly, "—" for salary */}
        <Cell
          editable={!excluded && isHourly}
          value={input?.hoursWorked}
          placeholder={isHourly ? String(defaultRegular) : "—"}
          onChange={(v) => onUpdateInput({ hoursWorked: v })}
        />

        {/* Bonus — column header implies dollars, no $ prefix in the cell */}
        <Cell
          editable={!excluded}
          value={input?.bonusAmount}
          placeholder="0"
          onChange={(v) => onUpdateInput({ bonusAmount: v })}
        />

        {/* Stat-pay — tap opens the picker modal */}
        <StatPayCell
          disabled={excluded}
          value={input?.statPay}
          onClick={() => setStatModalOpen(true)}
        />

        {/* Net pay (read-only, bold) */}
        <ReadCell
          value={line && !excluded ? formatCAD(line.netPay) : "—"}
          strong
        />

        {/* Info icon — hover reveals the net-pay breakdown popover */}
        <NetPayInfo line={line} excluded={excluded} />
      </div>

      {/* ── Mobile: compact, collapsible card ── */}
      <MobileEmployeeCard
        employee={employee}
        line={line}
        excluded={excluded}
        input={input}
        isHourly={isHourly}
        defaultRegular={defaultRegular}
        initials={initials}
        onToggleExclude={onToggleExclude}
        onUpdateInput={onUpdateInput}
        onOpenStatModal={() => setStatModalOpen(true)}
      />

      {/* Stat-pay picker modal — opens when StatPayCell is tapped */}
      <StatPayModal
        open={statModalOpen}
        onClose={() => setStatModalOpen(false)}
        employee={employee}
        current={input?.statPay}
        onConfirm={(next) => onUpdateInput({ statPay: next })}
      />
    </div>
  );
}

/**
 * Mobile employee card — compact by default, expandable for edits.
 *
 * Collapsed: avatar + name + net pay + chevron. Tapping the row body expands
 * the editable inputs. The include/skip toggle stays accessible at all times
 * via a long-press-style pill that doesn't trigger the expand.
 */
function MobileEmployeeCard({
  employee,
  line,
  excluded,
  input,
  isHourly,
  defaultRegular,
  initials,
  onToggleExclude,
  onUpdateInput,
  onOpenStatModal,
}: {
  employee: Employee;
  line: PayrollLineResult | null;
  excluded: boolean;
  input?: PayrollLineInput;
  isHourly: boolean;
  defaultRegular: number;
  initials: string;
  onToggleExclude: () => void;
  onUpdateInput: (patch: Partial<PayrollLineInput>) => void;
  onOpenStatModal: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // True 3D flip: both faces always live in the DOM, stacked in the same
  // CSS-grid cell. Container rotates 0 ↔ 180deg. `backface-visibility:
  // hidden` on each face means only the front-facing side is ever rendered
  // — overlap is mathematically impossible.
  const [flipped, setFlipped] = useState(false);

  const cardBorder = cn(
    "overflow-hidden rounded-2xl border bg-background/95 transition-colors duration-200",
    expanded && !excluded ? "border-foreground/20 shadow-sm" : "border-border/60"
  );

  const front = (
    <div className={cardBorder}>
      {/* Header: checkbox + name + net pay + chevron */}
      <div className="flex w-full items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggleExclude}
          aria-label={excluded ? "Include employee" : "Skip employee"}
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full border-[2px] transition-all duration-200 active:scale-90",
            !excluded
              ? "border-success bg-success shadow-sm"
              : "border-muted-foreground/30 bg-transparent"
          )}
        >
          {!excluded && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
        </button>

        <button
          type="button"
          onClick={() => { if (!excluded) setExpanded((v) => !v); }}
          disabled={excluded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold tracking-tight">
              {employee.firstName} {employee.lastName}
            </p>
            {expanded && (
              <p className="truncate text-[11.5px] text-muted-foreground">
                {isHourly
                  ? `Hourly · ${formatCAD(employee.hourlyRate ?? 0)}/hr`
                  : `Salary · ${formatCAD(employee.annualSalary ?? 0)}/yr`}
              </p>
            )}
          </div>
          {!excluded && (
            <div className="flex shrink-0 flex-col items-end">
              <p className="text-[15px] font-semibold tabular-nums tracking-tight">
                {line ? formatCAD(line.netPay) : "—"}
              </p>
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/60">Net</p>
            </div>
          )}
          {!excluded && (
            <ChevronDown className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-200",
              expanded && "rotate-180 text-foreground/70"
            )} />
          )}
        </button>
      </div>

      {/* Expandable inputs */}
      <AnimatePresence initial={false}>
        {expanded && !excluded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease }}
            style={{ overflow: "hidden" }}
          >
            <div className="space-y-3 border-t border-border/40 px-4 py-3">
              <div className={cn("grid gap-3", isHourly ? "grid-cols-2" : "grid-cols-1")}>
                {isHourly && (
                  <MobileField label="Hours worked">
                    <MobileNumberInput
                      placeholder={String(defaultRegular)}
                      value={input?.hoursWorked}
                      onChange={(v) => onUpdateInput({ hoursWorked: v })}
                    />
                  </MobileField>
                )}
                <MobileField label="Bonus ($)">
                  <MobileNumberInput
                    placeholder="0"
                    value={input?.bonusAmount}
                    onChange={(v) => onUpdateInput({ bonusAmount: v })}
                  />
                </MobileField>
              </div>

              <MobileField label="Stat holiday pay">
                <button
                  type="button"
                  onClick={onOpenStatModal}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-[13.5px] font-medium transition-all duration-200",
                    !input?.statPay && "border-border/60 bg-background/60 text-muted-foreground",
                    input?.statPay?.method === "premium" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                    input?.statPay?.method === "average" && "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
                    input?.statPay?.method === "custom" && "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                  )}
                >
                  <span>
                    {!input?.statPay ? "No stat pay"
                      : input.statPay.method === "premium" ? "1.5× premium"
                      : input.statPay.method === "average" ? "Average daily"
                      : "Custom amount"}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
                </button>
              </MobileField>

              {/* ⓘ flip to breakdown */}
              {line && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setFlipped(true)}
                    aria-label="Show net pay breakdown"
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Info className="h-3.5 w-3.5" />
                    Breakdown
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const back = (
    <div className={cardBorder}>
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <p className="text-[13.5px] font-semibold tracking-tight">Net pay breakdown</p>
        <button
          type="button"
          onClick={() => setFlipped(false)}
          aria-label="Back"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {line ? (
        <ul className="space-y-2 px-4 py-3 text-[13px]">
          <BreakdownRow label="Gross" value={formatCAD(line.grossPay)} />
          <BreakdownRow label="Federal tax" value={formatCAD(-line.federalTax)} />
          <BreakdownRow label="Provincial tax" value={formatCAD(-line.provincialTax)} />
          <BreakdownRow label="CPP" value={formatCAD(-(line.cppEmployee + line.cpp2Employee))} />
          <BreakdownRow label="EI" value={formatCAD(-line.eiEmployee)} />
          {line.statPay > 0 && (
            <BreakdownRow
              label={line.statPayMethod === "premium" ? "Stat 1.5×" : line.statPayMethod === "average" ? "Stat avg" : "Stat custom"}
              value={`+${formatCAD(line.statPay)}`}
            />
          )}
          {line.vacationAccrual > 0 && (
            <BreakdownRow label="Vacation" value={`+${formatCAD(line.vacationAccrual)}`} />
          )}
          {line.vacationBanked > 0 && (
            <BreakdownRow label="Vacation banked" value={formatCAD(line.vacationBanked)} muted />
          )}
          <li className="mt-1 flex items-center justify-between border-t border-border/60 pt-2.5 font-semibold">
            <span>Net pay</span>
            <span className="tabular-nums">{formatCAD(line.netPay)}</span>
          </li>
        </ul>
      ) : (
        <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">
          No data yet.
        </div>
      )}
    </div>
  );

  return (
    <div className={cn("p-1.5 md:hidden", excluded && "opacity-50")}>
      <div style={{ perspective: 1400 }}>
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.55, ease }}
          className="relative"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Front face — in normal flow, so the container sizes to it.
              When the card is collapsed, this is short. When expanded, it
              grows. The back face overlays this exact box. */}
          <div
            aria-hidden={flipped}
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            {front}
          </div>

          {/* Back face — absolutely positioned so it doesn't contribute
              to the container's height. Pre-rotated 180° so it appears
              upright once the container reaches rotateY(180). The flip
              button only renders once the card is expanded, so the
              container is always tall enough to contain the breakdown. */}
          <div
            aria-hidden={!flipped}
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            {back}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/** Compact labeled field used in the mobile stacked payroll card. */
function MobileField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
        {label}
      </p>
      {children}
    </div>
  );
}

/** Full-width touch-friendly number input used inside the mobile card. */
function MobileNumberInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      enterKeyHint="done"
      autoComplete="off"
      placeholder={placeholder}
      value={value ?? ""}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, "");
        onChange(raw === "" ? undefined : Number(raw));
      }}
      className={cn(
        "w-full rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-[16px] font-medium tabular-nums text-foreground transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/10"
      )}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Numbers-style editable cell — borderless until hover/focus
// ─────────────────────────────────────────────────────────────────────────
/**
 * Editable spreadsheet cell.
 *
 *   • Read-only ("—") cells are plain text, fully transparent — clearly NOT inputs
 *   • Editable cells get a soft, calm pill at rest that says "type here"
 *       resting: bg-muted/40 + 1px inset of nothing (clean rounded surface)
 *       hover:   bg-muted/70 (slight lift)
 *       focus:   bg-background + ring (Apple Numbers cell-in-edit feel)
 */
function Cell({
  editable,
  value,
  placeholder,
  onChange,
}: {
  editable: boolean;
  value: number | undefined;
  placeholder: string;
  onChange: (next: number | undefined) => void;
}) {
  if (!editable) {
    return (
      <span className="text-right tabular-nums text-muted-foreground/40">
        —
      </span>
    );
  }
  return (
    <div className="flex justify-end">
      <div
        className={cn(
          // Resting: clear filled pill with a subtle ring so the cell reads
          // as "editable input" even before hover/focus.
          "group relative flex w-full items-center justify-end rounded-lg bg-muted/70 px-2.5 py-1.5 ring-1 ring-inset ring-border/60 transition-all duration-150",
          "hover:bg-muted hover:ring-border",
          "focus-within:bg-background focus-within:ring-foreground/40 focus-within:shadow-soft"
        )}
      >
        <input
          type="number"
          inputMode="decimal"
          placeholder={placeholder}
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? undefined : Number(v));
          }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "w-full bg-transparent text-right text-[13px] font-medium tabular-nums text-foreground placeholder:text-muted-foreground/70 focus:outline-none",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          )}
        />
      </div>
    </div>
  );
}

function ReadCell({
  value,
  muted,
  strong,
}: {
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-right tabular-nums",
        muted && "text-muted-foreground",
        strong && "font-semibold tracking-tight"
      )}
    >
      {value}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Stat-pay picker modal — opens when the operator taps the stat cell.
// Shows the exact $ impact of each method BEFORE applying; the cell on the
// row only updates after the user hits Confirm.
// ─────────────────────────────────────────────────────────────────────────
type StatPayValue =
  | { method: "premium" | "average" | "custom"; hours?: number; amount?: number }
  | undefined;

function StatPayModal({
  open,
  onClose,
  employee,
  current,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  employee: Employee;
  current: StatPayValue;
  onConfirm: (next: StatPayValue) => void;
}) {
  const [pending, setPending] = useState<StatPayValue>(current);
  const [mounted, setMounted] = useState(false);

  // Portal mount check — render only on the client
  useEffect(() => setMounted(true), []);

  // Reset the preview-selection each time the modal opens
  useEffect(() => {
    if (open) setPending(current);
  }, [open, current]);

  // Hourly equivalent — same formula the engine uses
  const hourlyRate =
    employee.employmentType === "hourly"
      ? employee.hourlyRate ?? 0
      : (employee.annualSalary ?? 0) /
        ((employee.standardWeeklyHours || 40) * 52);
  const hours = pending?.hours ?? 8;
  const premiumAmount = hourlyRate * 1.5 * hours;
  const averageAmount = hourlyRate * 1.0 * hours;

  function commit() {
    onConfirm(pending);
    onClose();
  }

  if (!mounted) return null;

  // Render via portal so the modal escapes any transform/overflow context
  // from ancestor containers (Framer Motion wrappers, the payroll grid card,
  // etc.). Without this, parent transforms create a containing block and
  // `fixed inset-0` no longer maps to the viewport.
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-md"
            onClick={onClose}
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 36, mass: 0.9 }}
              className="pointer-events-auto flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-border bg-background shadow-pop pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:w-[min(94vw,440px)] sm:rounded-[28px] sm:pb-0"
            >
              <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-muted-foreground/25 sm:hidden" />
              <div className="px-6 pb-2 pt-5 text-center sm:pt-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Stat holiday pay
                </p>
                <p className="mt-2 text-[18px] font-semibold tracking-tight">
                  {employee.firstName} {employee.lastName}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Hourly rate · ${hourlyRate.toFixed(2)}/hr · {hours} hrs
                </p>
              </div>

              <div className="space-y-2.5 px-5 py-4">
                <StatOptionCard
                  title="Worked the holiday"
                  subtitle="1.5× rate × 8 hrs · employee was on shift"
                  amount={premiumAmount}
                  tone="emerald"
                  selected={pending?.method === "premium"}
                  onClick={() => setPending({ method: "premium", hours: 8 })}
                />
                <StatOptionCard
                  title="General holiday pay"
                  subtitle="Regular daily wage · employee didn't work"
                  amount={averageAmount}
                  tone="blue"
                  selected={pending?.method === "average"}
                  onClick={() => setPending({ method: "average", hours: 8 })}
                />
                <CustomStatCard
                  selected={pending?.method === "custom"}
                  amount={
                    pending?.method === "custom" ? pending.amount ?? 0 : 0
                  }
                  onChange={(next) => setPending(next)}
                />
                <button
                  type="button"
                  onClick={() => setPending(undefined)}
                  className={cn(
                    "flex w-full items-center justify-center rounded-2xl border border-border/60 bg-background/40 px-4 py-2.5 text-[12.5px] font-medium tracking-tight transition-colors duration-200 hover:bg-muted/40",
                    pending === undefined &&
                      "border-foreground/30 bg-muted/60 text-foreground"
                  )}
                >
                  No stat pay this period
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border/40 bg-muted/20 px-5 py-3.5">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={commit}>Confirm</Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Custom-amount card — selects method="custom" and edits the dollar amount
 * inline. Tap anywhere on the card to focus the input; typing updates the
 * pending state in real time.
 */
function CustomStatCard({
  selected,
  amount,
  onChange,
}: {
  selected: boolean;
  amount: number;
  onChange: (next: { method: "custom"; amount: number }) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onChange({ method: "custom", amount })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange({ method: "custom", amount });
        }
      }}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-border/60 bg-background/40 px-4 py-3 text-left transition-all duration-200 hover:bg-muted/40",
        selected &&
          "ring-2 ring-inset ring-violet-500/40 border-violet-500/60 bg-violet-500/15"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold tracking-tight">
          Custom amount
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          Type the exact dollar amount to add
        </p>
      </div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-xl border border-border/60 bg-background/60 px-2.5 py-1.5 transition-colors duration-150",
          "focus-within:border-foreground/40 focus-within:shadow-soft",
          selected && "border-violet-500/40 bg-background"
        )}
      >
        <span className="text-[14px] font-medium text-muted-foreground">$</span>
        <input
          type="number"
          inputMode="decimal"
          value={amount > 0 || selected ? amount : ""}
          placeholder="0"
          onChange={(e) => {
            const v = e.target.value;
            const num = v === "" ? 0 : Number(v);
            onChange({ method: "custom", amount: num });
          }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "w-20 bg-transparent text-right text-[16px] font-semibold tabular-nums text-foreground placeholder:text-muted-foreground/50 focus:outline-none",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          )}
        />
      </div>
    </div>
  );
}

function StatOptionCard({
  title,
  subtitle,
  amount,
  tone,
  selected,
  onClick,
}: {
  title: string;
  subtitle: string;
  amount: number;
  tone: "emerald" | "blue";
  selected: boolean;
  onClick: () => void;
}) {
  const toneClasses = {
    emerald:
      "border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/40",
    blue: "border-blue-500/60 bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-blue-500/40",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-start gap-4 rounded-2xl border border-border/60 bg-background/40 px-4 py-3 text-left transition-all duration-200 hover:bg-muted/40",
        selected && cn("ring-2 ring-inset", toneClasses)
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold tracking-tight">{title}</p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">{subtitle}</p>
      </div>
      <p
        className={cn(
          "text-right text-[18px] font-semibold tracking-tight tabular-nums",
          selected ? "" : "text-foreground/80"
        )}
      >
        +{formatCAD(amount)}
      </p>
    </button>
  );
}

/**
 * Stat-pay cell — visible state + button. Tapping opens the StatPayModal
 * where the operator picks the method (1.5× premium or Avg daily) with the
 * exact dollar amount shown for each.
 */
function StatPayCell({
  disabled,
  value,
  onClick,
}: {
  disabled: boolean;
  value:
    | { method: "premium" | "average" | "custom"; hours?: number; amount?: number }
    | undefined;
  onClick: () => void;
}) {
  if (disabled) {
    return (
      <div className="flex justify-center">
        <span className="text-muted-foreground/40">—</span>
      </div>
    );
  }

  const label =
    !value
      ? null
      : value.method === "premium"
      ? "1.5×"
      : value.method === "average"
      ? "Avg"
      : "Custom";

  const titleText = !value
    ? "Add stat holiday pay"
    : value.method === "premium"
    ? "Stat pay: 1.5× premium (tap to change)"
    : value.method === "average"
    ? "Stat pay: average daily (tap to change)"
    : "Stat pay: custom amount (tap to change)";

  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={onClick}
        title={titleText}
        className={cn(
          "inline-flex h-7 min-w-[3rem] items-center justify-center rounded-full px-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] transition-all duration-200",
          !value &&
            // Unchecked: filled pill with a clearly visible border so it
            // reads as an action target, not invisible whitespace.
            "border-[1.5px] border-border bg-muted/70 text-transparent hover:border-foreground/40 hover:bg-muted",
          value?.method === "premium" &&
            "border border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
          value?.method === "average" &&
            "border border-blue-500/40 bg-blue-500/15 text-blue-600 dark:text-blue-300",
          value?.method === "custom" &&
            "border border-violet-500/40 bg-violet-500/15 text-violet-600 dark:text-violet-300"
        )}
        aria-label={titleText}
      >
        {!value ? <Check className="h-3 w-3" strokeWidth={3.5} /> : label}
      </button>
    </div>
  );
}

function Strip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
        {label}
      </span>
      <span className="text-foreground/90">{value}</span>
    </div>
  );
}

/**
 * Info icon + hover popover with the per-employee net-pay breakdown.
 *
 * Rendered via React portal so the popover floats above EVERY ancestor —
 * no overflow:hidden / transform parents can clip it. Position is
 * computed from the icon's bounding rect each time it opens.
 */
function NetPayInfo({
  line,
  excluded,
}: {
  line: PayrollLineResult | null;
  excluded: boolean;
}) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function show() {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    // Open below + flush against the icon's right edge
    setPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  if (!line || excluded) {
    return (
      <div className="grid h-6 w-6 place-items-center text-muted-foreground/20">
        <Info className="h-3.5 w-3.5" />
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <span
        ref={iconRef}
        tabIndex={0}
        aria-label="Net pay breakdown"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground/70 transition-colors duration-200 hover:bg-muted hover:text-foreground focus:outline-none focus-visible:bg-muted focus-visible:text-foreground"
      >
        <Info className="h-3.5 w-3.5" />
      </span>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                role="tooltip"
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{ duration: 0.18, ease }}
                style={{
                  position: "fixed",
                  top: pos.top,
                  right: pos.right,
                  zIndex: 80,
                }}
                className="pointer-events-none w-[260px] origin-top-right"
              >
                <div className="rounded-2xl border border-border bg-background shadow-pop">
                  <p className="border-b border-border/60 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Net pay breakdown
                  </p>
                  <ul className="space-y-1.5 px-4 py-3 text-[12px] tabular-nums">
                    <BreakdownRow label="Gross" value={formatCAD(line.grossPay)} />
                    <BreakdownRow
                      label="Federal"
                      value={formatCAD(-line.federalTax)}
                    />
                    <BreakdownRow
                      label="Provincial"
                      value={formatCAD(-line.provincialTax)}
                    />
                    <BreakdownRow
                      label="CPP"
                      value={formatCAD(-(line.cppEmployee + line.cpp2Employee))}
                    />
                    <BreakdownRow
                      label="EI"
                      value={formatCAD(-line.eiEmployee)}
                    />
                    {line.statPay > 0 && (
                      <BreakdownRow
                        label={
                          line.statPayMethod === "premium"
                            ? "Stat 1.5×"
                            : line.statPayMethod === "average"
                            ? "Stat avg"
                            : "Stat custom"
                        }
                        value={`+${formatCAD(line.statPay)}`}
                      />
                    )}
                    {line.vacationAccrual > 0 && (
                      <BreakdownRow
                        label="Vacation"
                        value={`+${formatCAD(line.vacationAccrual)}`}
                      />
                    )}
                    {line.vacationBanked > 0 && (
                      <BreakdownRow
                        label="Vacation banked"
                        value={formatCAD(line.vacationBanked)}
                        muted
                      />
                    )}
                    <li className="mt-1 flex items-center justify-between border-t border-border/60 pt-2 font-semibold">
                      <span>Net pay</span>
                      <span className="tabular-nums">
                        {formatCAD(line.netPay)}
                      </span>
                    </li>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center justify-between",
        muted && "text-muted-foreground"
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Payroll history — past finalized runs with per-paystub downloads
// ─────────────────────────────────────────────────────────────────────────
function PayrollHistory({
  runs,
  company,
}: {
  runs: PayrollRun[];
  company: ReturnType<typeof useSettings.getState>["company"];
}) {
  const finalized = useMemo(
    () =>
      runs
        .filter((r) => r.status === "finalized")
        .sort((a, b) => (a.payDate < b.payDate ? 1 : -1)),
    [runs]
  );
  const [open, setOpen] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  if (finalized.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-xl">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors duration-200 hover:bg-muted/30"
      >
        <div className="flex items-center gap-2.5">
          <Clock className="h-[15px] w-[15px] text-muted-foreground" />
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Payroll history · {finalized.length}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground/60 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden border-t border-border/40"
          >
            <div className="divide-y divide-border/30">
              {finalized.map((run) => (
                <PastRunRow
                  key={run.id}
                  run={run}
                  expanded={activeRunId === run.id}
                  onToggle={() =>
                    setActiveRunId(activeRunId === run.id ? null : run.id)
                  }
                  company={company}
                  allRuns={runs}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PastRunRow({
  run,
  expanded,
  onToggle,
  company,
  allRuns,
}: {
  run: PayrollRun;
  expanded: boolean;
  onToggle: () => void;
  company: ReturnType<typeof useSettings.getState>["company"];
  allRuns: PayrollRun[];
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-muted/30 md:grid md:grid-cols-[1.6fr_1fr_1fr_28px] md:px-5"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium tracking-tight">
            {formatDate(run.periodStart)} → {formatDate(run.periodEnd)}
          </p>
          <p className="text-[11.5px] text-muted-foreground">
            Paid {formatDate(run.payDate)}
          </p>
        </div>
        <p className="hidden text-[12.5px] text-muted-foreground md:block">
          {run.lines.length} employee{run.lines.length === 1 ? "" : "s"}
        </p>
        <p
          className={cn(
            "shrink-0 text-right text-[14px] font-semibold tabular-nums tracking-tight md:block",
            !expanded && "hidden"
          )}
        >
          {formatCAD(run.totals.net)}
        </p>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-200",
            expanded && "rotate-90 text-foreground"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden border-t border-border/30 bg-muted/20"
          >
            <ul className="divide-y divide-border/30">
              {run.lines.map((line) => (
                <li
                  key={line.employeeId}
                  className="flex items-center justify-between gap-3 px-5 py-2.5 text-[12.5px]"
                >
                  <span className="truncate font-medium tracking-tight">
                    {line.employee.firstName} {line.employee.lastName}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-medium">
                      {formatCAD(line.netPay)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        generatePaystubPDF(line, company, allRuns);
                      }}
                      aria-label={`Download paystub for ${line.employee.firstName}`}
                      title="Download paystub"
                      className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground/70 transition-colors duration-200 hover:bg-background hover:text-foreground"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

