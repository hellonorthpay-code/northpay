"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
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
  ROE_REASON_CODES,
  type Employee,
  type PayrollLineResult,
} from "@/lib/payroll/types";
import { useEmployees } from "@/lib/store/employees";
import { usePayrollRuns } from "@/lib/store/payroll";
import { useSettings } from "@/lib/store/settings";
import { generatePaystubPDF } from "@/lib/pdf/paystub";
import { formatCAD, formatDate, cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

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
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4 pb-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.35, ease }}
          className="pointer-events-auto relative flex max-h-[72vh] w-[min(94vw,520px)] flex-col overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-pop dark:border-zinc-800 dark:bg-black sm:max-h-[88vh]"
        >
        {/* Top-right close button */}
        <div className="absolute right-4 top-4 z-10">
          <button
            onClick={onClose}
            className="grid h-14 w-14 place-items-center rounded-full bg-black text-white transition-colors hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
            aria-label="Close"
          >
            <X className="h-7 w-7" strokeWidth={2.6} />
          </button>
        </div>

        {/* Scrollable body — hide native scrollbar, smooth scroll */}
        <div
          className="flex-1 overflow-y-auto px-5 pb-5 pt-7 scrollbar-none sm:px-6 sm:pb-6 sm:pt-8"
          style={{ scrollBehavior: "smooth" }}
        >
          {/* Avatar + Name header */}
          <div className="flex flex-col items-center text-center">
            <div className="grid h-[88px] w-[88px] place-items-center rounded-full bg-zinc-900 text-[26px] font-semibold text-white shadow-pop dark:bg-white dark:text-black">
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
            <p className="mt-3 rounded-2xl bg-zinc-100 px-4 py-2.5 text-center text-[11.5px] text-muted-foreground dark:bg-zinc-900">
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
                value={employee.payFrequency
                  .replace("semimonthly", "semi-monthly")
                  .replace("semiannually", "semi-annually")}
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

            {(employee.endDate || employee.roeReasonCode) && (
              <Section title="End of employment">
                {employee.endDate && (
                  <PillRow label="End date" value={formatDate(employee.endDate)} />
                )}
                {employee.roeReasonCode && (
                  <PillRow
                    label="ROE reason (Block 16)"
                    value={`${employee.roeReasonCode} — ${
                      ROE_REASON_CODES.find((c) => c.code === employee.roeReasonCode)?.label ?? "Unknown"
                    }`}
                  />
                )}
                {employee.roeReasonCode === "K" && employee.roeReasonOther && (
                  <PillRow label="Details" value={employee.roeReasonOther} />
                )}
              </Section>
            )}
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

// Monochrome (Wealthsimple-style): all icons sit in the foreground colour;
// only the destructive Remove keeps a red accent.
const TONE_CLASSES: Record<Tone, string> = {
  blue: "text-foreground",
  rose: "text-foreground",
  emerald: "text-foreground",
  violet: "text-foreground",
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
          : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800"
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

// Sections collapse into accordions ONLY on mobile to keep the sheet short.
// On desktop (≥768px) everything stays expanded and the toggle is inert —
// the original always-visible layout.
function Section({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const isDesktop = useIsDesktop();
  // Default to OPEN on mobile too (was collapsed) — the user wants the
  // sections already expanded. The chevron can still collapse them.
  const [open, setOpen] = useState(defaultOpen ?? true);

  // Desktop always shows content; mobile respects the toggle.
  const expanded = isDesktop || open;

  return (
    <div className="overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isDesktop}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left disabled:cursor-default"
      >
        <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </span>
        {!isDesktop && (
          <motion.span
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 text-muted-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </motion.span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
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

// Tracks whether the viewport is at/above Tailwind's `md` breakpoint (768px).
// Initialised synchronously from matchMedia so the first paint is already
// correct (the sheet only mounts client-side after a user opens it).
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 768px)").matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
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
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 dark:bg-zinc-800">
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
