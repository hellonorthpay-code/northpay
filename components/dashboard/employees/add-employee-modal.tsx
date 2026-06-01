"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROVINCE_NAMES,
  SUPPORTED_PROVINCES,
  type Employee,
  type EmploymentType,
  type PayFrequency,
  type ProvinceCode,
  type VacationMode,
} from "@/lib/payroll/types";
import {
  DEFAULT_STANDARD_WEEKLY_HOURS,
  DEFAULT_VACATION_PERCENT,
  OVERTIME_WEEKLY_HOURS,
} from "@/lib/payroll/constants";
import { useEmployees } from "@/lib/store/employees";
import { useSettings } from "@/lib/store/settings";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * If provided, the modal is in EDIT mode: form is pre-filled from this
   * employee and submit calls updateEmployee(). If null/undefined, it's
   * ADD mode and submit calls addEmployee().
   */
  employee?: Employee | null;
  /**
   * Viewport-space point the dialog's scale animation should appear to
   * originate from (e.g. the centre of the button that opened it).
   * Defaults to the screen centre when omitted.
   */
  origin?: { x: number; y: number } | null;
}

// iOS-style easing — matches the dialog open/close curve so step
// transitions feel like part of the same motion vocabulary.
const EASE = [0.32, 0.72, 0, 1] as const;

export function AddEmployeeModal({ open, onOpenChange, employee, origin }: Props) {
  const company = useSettings((s) => s.company);
  const addEmployee = useEmployees((s) => s.addEmployee);
  const updateEmployee = useEmployees((s) => s.updateEmployee);
  const isEdit = !!employee;

  /** Default form for ADD mode — uses company defaults. */
  const blankForm = () => ({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    sin: "",
    province: company.defaultProvince as ProvinceCode,
    employmentType: "salary" as EmploymentType,
    annualSalary: "",
    hourlyRate: "",
    payFrequency: company.defaultPayFrequency as PayFrequency,
    vacationPercent: String(DEFAULT_VACATION_PERCENT),
    vacationMode: "payout" as VacationMode,
    standardWeeklyHours: String(DEFAULT_STANDARD_WEEKLY_HOURS),
    overtimeThresholdHours: String(OVERTIME_WEEKLY_HOURS[company.defaultProvince]),
    startDate: new Date().toISOString().slice(0, 10),
  });

  /** Pre-filled form for EDIT mode — stringifies numeric fields for inputs. */
  const formFromEmployee = (emp: Employee) => ({
    firstName: emp.firstName,
    lastName: emp.lastName,
    email: emp.email ?? "",
    phone: emp.phone ?? "",
    sin: emp.sin ?? "",
    province: emp.province,
    employmentType: emp.employmentType,
    annualSalary:
      emp.annualSalary !== undefined ? String(emp.annualSalary) : "",
    hourlyRate: emp.hourlyRate !== undefined ? String(emp.hourlyRate) : "",
    payFrequency: emp.payFrequency,
    vacationPercent: String(emp.vacationPercent),
    vacationMode: emp.vacationMode,
    standardWeeklyHours: String(emp.standardWeeklyHours),
    overtimeThresholdHours: String(emp.overtimeThresholdHours),
    startDate: emp.startDate,
  });

  const [form, setForm] = useState(() =>
    employee ? formFromEmployee(employee) : blankForm()
  );
  // Two-step wizard: 1 = Identity, 2 = Employment / Hours / Vacation.
  // Tracks navigation direction so AnimatePresence can slide pages in the
  // correct direction (forward = right→left, back = left→right).
  const [step, setStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Re-init the form every time the modal is opened so it always reflects
  // the latest employee (or a clean slate for adds). Also resets to step 1
  // so the wizard always starts at Identity.
  useEffect(() => {
    if (open) {
      setForm(employee ? formFromEmployee(employee) : blankForm());
      setStep(1);
      setDirection(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id]);

  function submit() {
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      sin: form.sin.trim() || "*** *** ***",
      province: form.province,
      employmentType: form.employmentType,
      annualSalary:
        form.employmentType === "salary"
          ? Number(form.annualSalary) || 0
          : undefined,
      hourlyRate:
        form.employmentType === "hourly"
          ? Number(form.hourlyRate) || 0
          : undefined,
      payFrequency: form.payFrequency,
      vacationPercent: Number(form.vacationPercent) || DEFAULT_VACATION_PERCENT,
      vacationMode: form.vacationMode,
      standardWeeklyHours:
        Number(form.standardWeeklyHours) || DEFAULT_STANDARD_WEEKLY_HOURS,
      overtimeThresholdHours:
        Number(form.overtimeThresholdHours) ||
        OVERTIME_WEEKLY_HOURS[form.province],
      startDate: form.startDate,
    };

    if (isEdit && employee) {
      void updateEmployee(employee.id, payload);
    } else {
      void addEmployee(payload);
      setForm(blankForm());
    }
    onOpenChange(false);
  }

  // Step 1 advances only when names are populated (matches existing min
  // requirement for canSubmit). Email/phone/SIN/start date are optional.
  const canAdvance =
    form.firstName.trim().length > 0 && form.lastName.trim().length > 0;

  const canSubmit =
    canAdvance &&
    (form.employmentType === "salary"
      ? Number(form.annualSalary) > 0
      : Number(form.hourlyRate) > 0);

  function goNext() {
    setDirection(1);
    setStep(2);
  }
  function goBack() {
    setDirection(-1);
    setStep(1);
  }

  // Convert the click point (viewport coords) into a transform-origin
  // expressed relative to the dialog's own centre. The dialog is centred
  // via `left: 50%; top: 50%; -translate-x-1/2 -translate-y-1/2`, so the
  // offset from viewport centre equals the offset from dialog centre.
  // Result: scale-in appears to swell from the button that opened it.
  const originStyle =
    origin && typeof window !== "undefined"
      ? {
          transformOrigin: `calc(50% + ${origin.x - window.innerWidth / 2}px) calc(50% + ${origin.y - window.innerHeight / 2}px)`,
        }
      : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[88vw] p-5 gap-3 max-h-[85vh] overflow-y-auto scrollbar-none sm:max-w-xl sm:p-7 sm:gap-6"
        style={originStyle}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? `Edit ${employee?.firstName} ${employee?.lastName}`
              : "Add an employee"}
          </DialogTitle>
          <StepDots step={step} />
        </DialogHeader>

        {/* Animated step container.
            Single keyed motion.div that swaps its content as `step`
            changes — AnimatePresence reliably detects the key change
            and runs an exit → enter cycle in `wait` mode. */}
        <div className="relative overflow-hidden">
          {/* Animate via a single keyed motion.div. We use `key={step}` so
              React unmounts/remounts when step changes — motion.div picks
              that up via its `initial` → `animate` lifecycle. No
              AnimatePresence: it was failing to trigger the swap inside
              the Radix Portal here. The new content fades + slides in;
              we accept that the outgoing content snaps away (acceptable
              for a 2-step modal). */}
          <motion.div
            key={step}
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            transition={{ duration: 0.32, ease: EASE }}
            className="space-y-6"
          >
            {step === 1 ? (
              <StepOne form={form} setForm={setForm} />
            ) : (
              <StepTwo form={form} setForm={setForm} />
            )}
          </motion.div>
        </div>

        {/* Footer adapts to the step. Icons replace text:
            Step 1: × (cancel) on the left, › (continue) on the right.
            Step 2: ‹ (back) on the left, ✓ Add/Save on the right. */}
        <div className="flex items-center justify-between gap-2 pt-2">
          {step === 1 ? (
            <DialogClose asChild>
              <IconButton aria-label="Cancel">
                <X className="h-7 w-7" strokeWidth={2.6} />
              </IconButton>
            </DialogClose>
          ) : (
            <IconButton aria-label="Back" onClick={goBack}>
              <ChevronLeft className="h-7 w-7" strokeWidth={2.6} />
            </IconButton>
          )}
          {step === 1 ? (
            <IconButton
              aria-label="Continue"
              onClick={goNext}
              disabled={!canAdvance}
              variant="solid"
              className="group"
            >
              <ChevronRight className="h-7 w-7 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.6} />
            </IconButton>
          ) : (
            <Button onClick={submit} disabled={!canSubmit} className="h-16 rounded-full px-7 text-[16px] font-semibold">
              <Check className="h-6 w-6" strokeWidth={2.6} />
              {isEdit ? "Save" : "Add"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Animation ───────────────────────────────────────────────────────────
// Page slides 24px horizontally + fades — short enough not to wear out,
// long enough to register as "navigation" rather than instant swap.
const pageVariants = {
  enter: (dir: 1 | -1) => ({ x: 24 * dir, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: 1 | -1) => ({ x: -24 * dir, opacity: 0 }),
};

// ─── Progress dots ───────────────────────────────────────────────────────
function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <div className="mt-3 flex items-center gap-2">
      {[1, 2].map((n) => (
        <span
          key={n}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            step === n
              ? "w-6 bg-foreground dark:bg-white"
              : "w-1.5 bg-muted-foreground/40"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Step 1: Identity ────────────────────────────────────────────────────
interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  sin: string;
  province: ProvinceCode;
  employmentType: EmploymentType;
  annualSalary: string;
  hourlyRate: string;
  payFrequency: PayFrequency;
  vacationPercent: string;
  vacationMode: VacationMode;
  standardWeeklyHours: string;
  overtimeThresholdHours: string;
  startDate: string;
}

interface StepProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}

function StepOne({ form, setForm }: StepProps) {
  // Step 1 is the only section on this page, so we drop the explicit
  // "Identity" heading — the modal title already carries the context.
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
      <Field label="First name">
        <Input
          value={form.firstName}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          autoFocus
        />
      </Field>
      <Field label="Last name">
        <Input
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
        />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </Field>
      <Field label="Phone (for WhatsApp)">
        <Input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </Field>
      <Field label="SIN">
        <Input
          value={form.sin}
          onChange={(e) => setForm({ ...form, sin: e.target.value })}
        />
      </Field>
      <Field label="Start date">
        <DatePicker
          value={form.startDate}
          onChange={(v) => setForm({ ...form, startDate: v })}
        />
      </Field>
    </div>
  );
}

// ─── Step 2: Employment, Hours, Vacation ─────────────────────────────────
function StepTwo({ form, setForm }: StepProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
        <Field label="Province">
          <Select
            value={form.province}
            onValueChange={(v) =>
              setForm({ ...form, province: v as ProvinceCode })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_PROVINCES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PROVINCE_NAMES[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Type">
          <Select
            value={form.employmentType}
            onValueChange={(v) =>
              setForm({ ...form, employmentType: v as EmploymentType })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="salary">Salary</SelectItem>
              <SelectItem value="hourly">Hourly</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {form.employmentType === "salary" ? (
          <Field label="Annual salary">
            <Input
              type="number"
              inputMode="decimal"
              value={form.annualSalary}
              onChange={(e) =>
                setForm({ ...form, annualSalary: e.target.value })
              }
              placeholder="92000"
            />
          </Field>
        ) : (
          <Field label="Hourly rate">
            <Input
              type="number"
              inputMode="decimal"
              value={form.hourlyRate}
              onChange={(e) =>
                setForm({ ...form, hourlyRate: e.target.value })
              }
              placeholder="32.50"
            />
          </Field>
        )}

        <Field label="Pay frequency">
          <Select
            value={form.payFrequency}
            onValueChange={(v) =>
              setForm({ ...form, payFrequency: v as PayFrequency })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="biweekly">Bi-weekly</SelectItem>
              <SelectItem value="semimonthly">Semi-monthly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
        <Field label="Standard weekly hours">
          <Input
            type="number"
            inputMode="decimal"
            value={form.standardWeeklyHours}
            onChange={(e) =>
              setForm({ ...form, standardWeeklyHours: e.target.value })
            }
            placeholder="40"
          />
        </Field>
        <Field label="Overtime after (hrs / week)">
          <Input
            type="number"
            inputMode="decimal"
            value={form.overtimeThresholdHours}
            onChange={(e) =>
              setForm({ ...form, overtimeThresholdHours: e.target.value })
            }
            placeholder={String(OVERTIME_WEEKLY_HOURS[form.province])}
          />
        </Field>
        <Field label="Vacation %">
          <Input
            type="number"
            inputMode="decimal"
            value={form.vacationPercent}
            onChange={(e) =>
              setForm({ ...form, vacationPercent: e.target.value })
            }
            placeholder="4"
          />
        </Field>
        <Field label="Handling (required)">
          <Select
            value={form.vacationMode}
            onValueChange={(v) =>
              setForm({ ...form, vacationMode: v as VacationMode })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="payout">Pay out each period</SelectItem>
              <SelectItem value="accrue">Accrue & bank</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:mb-3">
        {title}
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${wide ? "col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// ─── Custom date picker ────────────────────────────────────────────────
// A self-contained popover calendar that matches the site's design
// vocabulary (rounded glass panel, soft motion, foreground accent for
// today/selected). Value is the ISO date string (YYYY-MM-DD) that the
// store already uses, so it's a drop-in for the native <input type=date>.
function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // `viewMonth` is the first day of the month currently displayed —
  // separate from the selected `value` so the user can browse months
  // without committing a date.
  const initial = value ? new Date(value + "T00:00:00") : new Date();
  const [viewMonth, setViewMonth] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1),
  );
  const wrapRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click + Escape — same affordances as a native popover.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const displayLabel = value
    ? new Date(value + "T00:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Pick a date";

  function pick(d: Date) {
    const iso =
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");
    onChange(iso);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 text-[14px] text-foreground shadow-sm transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <span className={value ? "" : "text-muted-foreground"}>{displayLabel}</span>
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.18, ease: EASE }}
          className="absolute left-0 right-0 z-50 mt-2 origin-top rounded-2xl border border-border bg-background/95 p-3 shadow-pop backdrop-blur-xl"
        >
          <CalendarPanel
            viewMonth={viewMonth}
            onViewMonth={setViewMonth}
            selected={value ? new Date(value + "T00:00:00") : null}
            onPick={pick}
          />
        </motion.div>
      )}
    </div>
  );
}

function CalendarPanel({
  viewMonth,
  onViewMonth,
  selected,
  onPick,
}: {
  viewMonth: Date;
  onViewMonth: (d: Date) => void;
  selected: Date | null;
  onPick: (d: Date) => void;
}) {
  const monthLabel = viewMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  // Build the 6-row grid: leading blanks from the previous month so the
  // first of the current month lands under its real weekday column.
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells: ({ d: Date; current: boolean } | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ d: new Date(year, month, d), current: true });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  function shiftMonth(delta: number) {
    onViewMonth(new Date(year, month + delta, 1));
  }
  function jumpToday() {
    onViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onPick(today);
  }

  return (
    <div className="w-[260px]">
      {/* Header: month/year + nav arrows */}
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/10"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[13px] font-semibold tracking-tight">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/10"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-0.5 px-1 pb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div
            key={i}
            className="grid h-7 place-items-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5 px-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="h-8" />;
          const isToday = cell.d.getTime() === today.getTime();
          const isSelected =
            selected !== null &&
            cell.d.getFullYear() === selected.getFullYear() &&
            cell.d.getMonth() === selected.getMonth() &&
            cell.d.getDate() === selected.getDate();
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(cell.d)}
              className={`grid h-8 w-full place-items-center rounded-lg text-[12.5px] font-medium transition-colors ${
                isSelected
                  ? "bg-foreground text-background dark:bg-white dark:text-black"
                  : isToday
                    ? "text-foreground ring-1 ring-foreground/30 dark:ring-white/30"
                    : "text-foreground hover:bg-muted/70 dark:hover:bg-white/10"
              }`}
            >
              {cell.d.getDate()}
            </button>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="mt-2 flex items-center justify-between border-t border-border/60 px-1 pt-2">
        <button
          type="button"
          onClick={jumpToday}
          className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => onPick(today)}
          className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Pick today
        </button>
      </div>
    </div>
  );
}

// Compact circular footer button. `variant="solid"` is the primary action
// (continue) — fills with foreground colour. Default is the ghost X / ‹.
const IconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "ghost" | "solid";
  }
>(({ className, variant = "ghost", ...props }, ref) => {
  const base =
    "inline-flex h-16 w-16 items-center justify-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const tone =
    variant === "solid"
      ? "bg-foreground text-background hover:bg-foreground/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/10";
  return (
    <button ref={ref} type="button" className={`${base} ${tone} ${className ?? ""}`} {...props} />
  );
});
IconButton.displayName = "IconButton";
