"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  FileDown,
  FileText,
  Mail,
  MessageCircle,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { AddEmployeeModal } from "./add-employee-modal";
import { Button } from "@/components/ui/button";
import {
  PROVINCE_NAMES,
  type Employee,
  type PayrollLineResult,
} from "@/lib/payroll/types";
import { TAX_YEAR } from "@/lib/payroll/constants";
import { useEmployees } from "@/lib/store/employees";
import { usePayrollRuns } from "@/lib/store/payroll";
import { useSettings } from "@/lib/store/settings";
import { generatePaystubPDF } from "@/lib/pdf/paystub";
import { generateT4PDF } from "@/lib/pdf/t4";
import { formatCAD, formatDate, cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

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

export function EmployeeDetailSheet({
  employee,
  onClose,
}: {
  employee: Employee;
  onClose: () => void;
}) {
  const runs = usePayrollRuns((s) => s.runs);
  const company = useSettings((s) => s.company);
  const removeEmployee = useEmployees((s) => s.removeEmployee);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // All paystubs for this employee, most-recent first
  const paystubs = useMemo(() => {
    const lines: PayrollLineResult[] = [];
    for (const run of runs) {
      if (run.status !== "finalized") continue;
      for (const line of run.lines) {
        if (line.employeeId === employee.id) lines.push(line);
      }
    }
    return lines.sort((a, b) => (a.periodEnd < b.periodEnd ? 1 : -1));
  }, [runs, employee.id]);

  const initials = `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`;
  const hasRuns = paystubs.length > 0;
  const latest = paystubs[0];

  // ───────── Actions ─────────
  function downloadPaystub(line: PayrollLineResult) {
    generatePaystubPDF(line, company, runs);
  }

  /**
   * Draft a full paystub email for any specific paystub line.
   * Downloads the PDF first, then opens the OS mail client with subject
   * + body already filled out.
   */
  function emailPaystub(line: PayrollLineResult) {
    if (!employee.email) return;
    generatePaystubPDF(line, company, runs);

    const subject = `Your paystub — ${formatDate(line.periodStart)} to ${formatDate(line.periodEnd)}`;
    const taxes = line.federalTax + line.provincialTax;
    const cpp = line.cppEmployee + line.cpp2Employee;

    const body = [
      `Hi ${employee.firstName},`,
      ``,
      `Please find attached your paystub for the pay period of ${formatDate(
        line.periodStart
      )} to ${formatDate(line.periodEnd)}.`,
      ``,
      `   Pay date:        ${formatDate(line.periodEnd)}`,
      `   Gross pay:       ${formatCAD(line.grossPay)}`,
      `   Federal tax:     ${formatCAD(line.federalTax)}`,
      `   Provincial tax:  ${formatCAD(line.provincialTax)}`,
      `   CPP:             ${formatCAD(cpp)}`,
      `   EI:              ${formatCAD(line.eiEmployee)}`,
      `   ─────────────────────────────`,
      `   Net deposit:     ${formatCAD(line.netPay)}`,
      ``,
      `If you have any questions about this paystub, please reply to this email.`,
      ``,
      `(Note: the PDF was just downloaded to your computer — please attach it to this email before sending.)`,
      ``,
      `Best regards,`,
      `${company.operatingName}`,
    ].join("\n");

    window.location.href = `mailto:${employee.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  }

  // Convenience for the top "Email" action tile — emails the latest paystub.
  function sendEmail() {
    if (latest) emailPaystub(latest);
  }

  function sendWhatsApp() {
    if (!latest) return;
    generatePaystubPDF(latest, company, runs);
    const text = [
      `Hi ${employee.firstName} — paystub for ${formatDate(latest.periodStart)} – ${formatDate(latest.periodEnd)} is ready.`,
      `Net: ${formatCAD(latest.netPay)}.`,
      `— ${company.operatingName}`,
    ].join("\n");
    const phone = (employee.phone ?? "").replace(/\D/g, "");
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function downloadT4() {
    if (!hasRuns) return;
    generateT4PDF(employee, company, runs, TAX_YEAR);
  }

  function handleRemove() {
    if (confirmRemove) {
      void removeEmployee(employee.id);
      onClose();
    } else {
      setConfirmRemove(true);
    }
  }

  const compRate =
    employee.employmentType === "salary"
      ? `${formatCAD(employee.annualSalary ?? 0)} / yr`
      : `${formatCAD(employee.hourlyRate ?? 0)} / hr`;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Centering wrapper — flexbox handles position, Motion only animates scale/opacity */}
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.35, ease }}
          className="pointer-events-auto flex max-h-[88vh] w-[min(94vw,520px)] flex-col overflow-hidden rounded-[28px] border border-border bg-background shadow-pop"
        >
        {/* Top-right action buttons — Edit + Close */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-1">
          <button
            onClick={() => setEditOpen(true)}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label="Edit employee"
            title="Edit"
          >
            <Pencil className="h-[15px] w-[15px]" />
          </button>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body — hide native scrollbar, smooth scroll */}
        <div
          className="flex-1 overflow-y-auto px-6 pb-6 pt-8 scrollbar-none"
          style={{ scrollBehavior: "smooth" }}
        >
          {/* Avatar + Name header */}
          <div className="flex flex-col items-center text-center">
            <div
              className={cn(
                "grid h-[88px] w-[88px] place-items-center rounded-full bg-gradient-to-br text-[26px] font-semibold text-white shadow-pop",
                PROVINCE_TONES[employee.province] ?? "from-zinc-300 to-zinc-200"
              )}
            >
              {initials}
            </div>
            <p className="mt-4 text-[22px] font-semibold uppercase tracking-tighter">
              {employee.firstName} {employee.lastName}
            </p>
            {hasRuns && (
              <p className="mt-1 text-[12px] text-muted-foreground">
                Last paid {formatCAD(latest.netPay)} · {formatDate(latest.periodEnd)}
              </p>
            )}
          </div>

          {/* Action tiles (DBI Hub style — colored icons in soft tiles) */}
          <div className="mt-7 grid grid-cols-4 gap-2">
            <ActionTile
              icon={<Pencil className="h-5 w-5" />}
              label="Edit"
              tone="blue"
              onClick={() => setEditOpen(true)}
            />
            <ActionTile
              icon={<Mail className="h-5 w-5" />}
              label="Email"
              tone="rose"
              onClick={sendEmail}
              disabled={!hasRuns || !employee.email}
            />
            <ActionTile
              icon={<MessageCircle className="h-5 w-5" />}
              label="WhatsApp"
              tone="emerald"
              onClick={sendWhatsApp}
              disabled={!hasRuns}
            />
            <ActionTile
              icon={<Trash2 className="h-5 w-5" />}
              label={confirmRemove ? "Confirm?" : "Remove"}
              tone="red"
              onClick={handleRemove}
              highlighted={confirmRemove}
            />
          </div>

          {!hasRuns && (
            <p className="mt-3 rounded-2xl bg-muted/40 px-4 py-2.5 text-center text-[11.5px] text-muted-foreground">
              Run payroll to enable Download, Email, and WhatsApp.
            </p>
          )}

          {/* ───────── Collapsible detail sections ───────── */}
          <div className="mt-7 space-y-2">
            {hasRuns && (
              <Section title="Latest paystub" defaultOpen>
                <PillRow label="Net pay" value={formatCAD(latest.netPay)} bold />
                <PillRow label="Gross" value={formatCAD(latest.grossPay)} />
                <PillRow
                  label="Period"
                  value={`${formatDate(latest.periodStart)} → ${formatDate(latest.periodEnd)}`}
                />
                <PillRow label="Pay date" value={formatDate(latest.periodEnd)} />
              </Section>
            )}

            <Section title="Employment">
              <PillRow label="Province" value={PROVINCE_NAMES[employee.province]} />
              <PillRow
                label="Type"
                value={employee.employmentType === "salary" ? "Salary" : "Hourly"}
              />
              <PillRow
                label={employee.employmentType === "salary" ? "Annual salary" : "Hourly rate"}
                value={compRate}
              />
              <PillRow
                label="Pay frequency"
                value={employee.payFrequency.replace("semimonthly", "semi-monthly")}
              />
            </Section>

            <Section title="Hours & overtime">
              <PillRow
                label="Standard weekly hours"
                value={String(employee.standardWeeklyHours)}
              />
              <PillRow
                label="Overtime after"
                value={`${employee.overtimeThresholdHours} hrs / week`}
              />
            </Section>

            <Section title="Vacation">
              <PillRow label="Rate" value={`${employee.vacationPercent}%`} />
              <PillRow
                label="Handling"
                value={
                  employee.vacationMode === "payout"
                    ? "Pay out each period"
                    : "Accrue & bank"
                }
              />
            </Section>

            <Section title="Identity">
              <PillRow label="Email" value={employee.email || "—"} />
              <PillRow label="Phone" value={employee.phone || "—"} />
              <PillRow label="SIN" value={employee.sin} />
              <PillRow label="Started" value={formatDate(employee.startDate)} />
            </Section>
          </div>

          {/* ───────── Year-end document ───────── */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={downloadT4}
              disabled={!hasRuns}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-4 py-2 text-[12px] font-medium text-foreground/80 transition-all duration-200",
                "hover:bg-muted/60 hover:text-foreground hover:shadow-soft",
                "disabled:cursor-not-allowed disabled:opacity-40"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              Download T4 {TAX_YEAR}
            </button>
          </div>
        </div>
        </motion.div>
      </div>

      {/* Edit-employee modal — opens on top of this sheet via Radix portal */}
      <AddEmployeeModal
        open={editOpen}
        onOpenChange={setEditOpen}
        employee={employee}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────────────────

type Tone = "blue" | "rose" | "emerald" | "violet" | "red";

const TONE_CLASSES: Record<Tone, string> = {
  blue: "text-blue-500 dark:text-blue-400",
  rose: "text-rose-500 dark:text-rose-400",
  emerald: "text-emerald-500 dark:text-emerald-400",
  violet: "text-violet-500 dark:text-violet-400",
  red: "text-red-500 dark:text-red-400",
};

function ActionTile({
  icon,
  label,
  tone,
  onClick,
  disabled,
  highlighted,
}: {
  icon: React.ReactNode;
  label: string;
  tone: Tone;
  onClick: () => void;
  disabled?: boolean;
  /** When true, the tile gets a stronger filled background — used for the
      "Confirm?" state on the destructive Remove tile. */
  highlighted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex flex-col items-center justify-center gap-2 rounded-2xl px-2 py-4 text-center transition-all duration-200",
        "hover:-translate-y-[1px] hover:shadow-soft",
        "disabled:pointer-events-none disabled:opacity-40",
        highlighted
          ? "bg-red-500/15 ring-1 ring-red-500/40"
          : "bg-muted/50 hover:bg-muted"
      )}
    >
      <span className={cn("transition-transform group-active:scale-90", TONE_CLASSES[tone])}>
        {icon}
      </span>
      <span
        className={cn(
          "text-[11px] font-medium leading-none tracking-tight",
          highlighted ? TONE_CLASSES[tone] : "text-foreground/80"
        )}
      >
        {label}
      </span>
    </button>
  );
}

function Section({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </span>
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div className="space-y-1.5 px-3 pb-3 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Small per-row icon button (used inside paystub history rows).
 * Same color-tone system as the big ActionTiles for visual consistency.
 */
function RowAction({
  children,
  onClick,
  disabled,
  tone,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone: Tone;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-full bg-background/70 transition-all duration-200",
        "hover:-translate-y-[1px] hover:bg-background hover:shadow-soft",
        "disabled:pointer-events-none disabled:opacity-30",
        TONE_CLASSES[tone]
      )}
    >
      {children}
    </button>
  );
}

function PillRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right text-[13px] capitalize tabular-nums",
          bold ? "font-semibold tracking-tight" : "font-medium"
        )}
      >
        {value}
      </span>
    </div>
  );
}
