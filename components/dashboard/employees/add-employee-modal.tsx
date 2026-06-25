"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  ROE_REASON_CODES,
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

// Common dialing codes for the country-code selector. Canada (+1) leads
// since this is a Canadian payroll product; the rest cover the most common
// places employees text from. The stored phone keeps the "+<code>" prefix
// so WhatsApp deep-links (wa.me/<digits>) resolve to the right country.
const COUNTRY_CODES = [
  { code: "+1", flag: "🇨🇦", name: "Canada / US" },
  { code: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { code: "+91", flag: "🇮🇳", name: "India" },
  { code: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "+63", flag: "🇵🇭", name: "Philippines" },
  { code: "+52", flag: "🇲🇽", name: "Mexico" },
  { code: "+92", flag: "🇵🇰", name: "Pakistan" },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+86", flag: "🇨🇳", name: "China" },
  { code: "+971", flag: "🇦🇪", name: "United Arab Emirates" },
] as const;

// Pragmatic email shape check — "something@something.tld". Not RFC-exhaustive
// (that's a losing battle), just enough to catch obvious typos like a missing
// "@" or domain. Used for a soft, non-blocking warning.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/**
 * Split a stored phone (e.g. "+1 4165550100") into its country code and the
 * local part for editing. Falls back to +1 when no recognizable prefix is
 * present, so legacy numbers stored without a code still load cleanly.
 */
function splitPhone(stored: string): { countryCode: string; local: string } {
  const trimmed = stored.trim();
  if (trimmed.startsWith("+")) {
    // Longest-prefix match so "+1" doesn't shadow "+1..." vs "+91" etc.
    const match = [...COUNTRY_CODES]
      .map((c) => c.code)
      .sort((a, b) => b.length - a.length)
      .find((code) => trimmed.startsWith(code));
    if (match) {
      return { countryCode: match, local: trimmed.slice(match.length).trim() };
    }
  }
  return { countryCode: "+1", local: trimmed };
}

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
    countryCode: "+1",
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
    endDate: "",
    roeReasonCode: "",
    roeReasonOther: "",
  });

  /** Pre-filled form for EDIT mode — stringifies numeric fields for inputs. */
  const formFromEmployee = (emp: Employee) => ({
    firstName: emp.firstName,
    lastName: emp.lastName,
    email: emp.email ?? "",
    countryCode: splitPhone(emp.phone ?? "").countryCode,
    phone: splitPhone(emp.phone ?? "").local,
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
    endDate: emp.endDate ?? "",
    roeReasonCode: emp.roeReasonCode ?? "",
    roeReasonOther: emp.roeReasonOther ?? "",
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
      // Store in international format ("+1 4165550100") so WhatsApp
      // deep-links resolve to the right country. Drop it entirely when no
      // local number was entered.
      phone: form.phone.trim()
        ? `${form.countryCode} ${form.phone.trim()}`
        : undefined,
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
      endDate: form.endDate || undefined,
      roeReasonCode: form.roeReasonCode || undefined,
      roeReasonOther:
        form.roeReasonCode === "K" ? form.roeReasonOther || undefined : undefined,
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
        className="max-w-[88vw] p-4 gap-2.5 max-h-[72vh] overflow-y-auto scrollbar-none sm:max-w-xl sm:p-7 sm:gap-6 sm:max-h-[85vh]"
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
            Step 1: › (continue) on the right — the dialog's top-right × is
                    the only close affordance (no duplicate in the footer).
            Step 2: ‹ (back) on the left, ✓ Add/Save on the right. */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {step === 2 && (
            <IconButton aria-label="Back" onClick={goBack}>
              <ChevronLeft className="h-5 w-5 sm:h-7 sm:w-7" strokeWidth={2.6} />
            </IconButton>
          )}
          {step === 1 ? (
            <IconButton
              aria-label="Continue"
              onClick={goNext}
              disabled={!canAdvance}
              variant="solid"
              className="group ml-auto"
            >
              <ChevronRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 sm:h-7 sm:w-7" strokeWidth={2.6} />
            </IconButton>
          ) : (
            <Button onClick={submit} disabled={!canSubmit} className="h-12 rounded-full px-6 text-[15px] font-semibold sm:h-16 sm:px-7 sm:text-[16px]">
              <Check className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.6} />
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
    <div className="mt-2 flex items-center gap-2">
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
  countryCode: string;
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
  endDate: string;
  roeReasonCode: string;
  roeReasonOther: string;
}

interface StepProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}

function StepOne({ form, setForm }: StepProps) {
  // Selected dial code drives the compact flag + code shown in the trigger.
  const selectedCountry =
    COUNTRY_CODES.find((c) => c.code === form.countryCode) ?? COUNTRY_CODES[0];
  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        <Field label="First name">
          <Input
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </Field>
        <Field label="Last name">
          <Input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </Field>
        <Field
          label="Email"
          hint={
            form.email.trim() && !isValidEmail(form.email)
              ? "This doesn’t look like a valid email address."
              : undefined
          }
        >
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            aria-invalid={!!form.email.trim() && !isValidEmail(form.email)}
          />
        </Field>
        <Field label="Phone">
          <div className="flex gap-2">
            <Select
              value={form.countryCode}
              onValueChange={(v) => setForm({ ...form, countryCode: v })}
            >
              <SelectTrigger
                className="w-[96px] shrink-0 px-3"
                aria-label="Country code"
              >
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-[15px] leading-none">
                    {selectedCountry.flag}
                  </span>
                  <span className="text-[15px] tabular-nums">
                    {selectedCountry.code}
                  </span>
                </span>
              </SelectTrigger>
              <SelectContent className="min-w-[15rem]">
                {COUNTRY_CODES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="flex items-center gap-2.5">
                      <span className="text-[15px] leading-none">{c.flag}</span>
                      <span className="w-10 shrink-0 tabular-nums">{c.code}</span>
                      <span className="text-muted-foreground">{c.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) =>
                setForm({
                  ...form,
                  phone: e.target.value.replace(/[^\d\s()+.-]/g, ""),
                })
              }
              placeholder="(416) 555-0100"
            />
          </div>
        </Field>
        <Field
          label="SIN"
          hint={
            form.sin.length > 0 && form.sin.length < 9
              ? "SIN must be 9 digits."
              : undefined
          }
        >
          <Input
            inputMode="numeric"
            value={form.sin}
            onChange={(e) =>
              setForm({
                ...form,
                sin: e.target.value.replace(/\D/g, "").slice(0, 9),
              })
            }
            aria-invalid={form.sin.length > 0 && form.sin.length < 9}
            placeholder="123456789"
          />
        </Field>
        <Field label="Start date">
          <DatePicker
            value={form.startDate}
            onChange={(v) => setForm({ ...form, startDate: v })}
          />
        </Field>
      </div>

      <Section title="End of employment (optional)">
        <Field label="End date">
          <DatePicker
            value={form.endDate}
            onChange={(v) => setForm({ ...form, endDate: v })}
          />
        </Field>
        <Field label="ROE reason (Block 16)">
          <Select
            value={form.roeReasonCode}
            onValueChange={(v) =>
              setForm({ ...form, roeReasonCode: v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select reason" />
            </SelectTrigger>
            <SelectContent>
              {ROE_REASON_CODES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {form.roeReasonCode === "K" && (
          <Field label="Describe reason" wide>
            <Input
              value={form.roeReasonOther}
              onChange={(e) =>
                setForm({ ...form, roeReasonOther: e.target.value })
              }
              placeholder="Reason for departure"
            />
          </Field>
        )}
      </Section>
    </>
  );
}

// ─── Step 2: Employment, Hours, Vacation ─────────────────────────────────
function StepTwo({ form, setForm }: StepProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
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
          <CraRefLink href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/set-up-new-employee/determine-province-employment.html">
            Province of Employment information
          </CraRefLink>
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
              <SelectItem value="semiannually">Semi-Annually</SelectItem>
              <SelectItem value="annually">Annually</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
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
        <Field label="Vacation pay calculation">
          <Input
            type="number"
            inputMode="decimal"
            value={form.vacationPercent}
            onChange={(e) =>
              setForm({ ...form, vacationPercent: e.target.value })
            }
            placeholder="4"
          />
          <CraRefLink href="https://www.canada.ca/en/services/jobs/workplace/federal-labour-standards/vacations-holidays.html">
            Vacation pay standards
          </CraRefLink>
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">{children}</div>
    </div>
  );
}

// Small inline link to an authoritative CRA / labour-standards page. Opens in
// a new tab; used to point operators at the official source for rules they may
// need to look up (province of employment, vacation pay, etc.).
function CraRefLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function Field({
  label,
  wide,
  hint,
  children,
}: {
  label: string;
  wide?: boolean;
  /** Optional inline warning shown below the field (e.g. soft validation). */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${wide ? "col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
      {hint ? (
        <p className="text-xs text-amber-600 dark:text-amber-500">{hint}</p>
      ) : null}
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
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  // `viewMonth` is the first day of the month currently displayed —
  // separate from the selected `value` so the user can browse months
  // without committing a date.
  const initial = value ? new Date(value + "T00:00:00") : new Date();
  const [viewMonth, setViewMonth] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1),
  );
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);

  // Mobile gets a plain typed field instead of the calendar popover — kept
  // as its own local string so the user can type freely (e.g. mid-digit)
  // without the parent value flipping to an invalid date.
  const [typed, setTyped] = useState(value);
  useEffect(() => setTyped(value), [value]);

  function handleTypedChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setTyped(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + "T00:00:00").getTime())) {
      onChange(v);
    }
  }

  useEffect(() => setMounted(true), []);

  // The calendar is portaled to document.body so it floats ABOVE the modal
  // instead of expanding it. It carries [data-northpay-popover] so the
  // Radix Dialog ignores clicks on it (see dialog.tsx) — that's what makes
  // day selection actually register. Width is fixed (288px) so it never
  // overflows the viewport edge.
  const PANEL_W = 288;
  function reposition() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const PANEL_H = 340;
    const below = r.bottom + 8;
    const flipUp = below + PANEL_H > window.innerHeight && r.top - PANEL_H > 0;
    // keep within the viewport horizontally
    const left = Math.min(
      Math.max(8, r.left),
      window.innerWidth - PANEL_W - 8,
    );
    setPos({
      top: flipUp ? Math.max(8, r.top - PANEL_H - 8) : below,
      left,
      width: r.width,
    });
  }

  useEffect(() => {
    if (!open) return;
    reposition();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => reposition();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
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
    <>
      {/* Mobile: plain typed input — no calendar popover. */}
      <Input
        type="text"
        inputMode="numeric"
        placeholder="YYYY-MM-DD"
        value={typed}
        onChange={handleTypedChange}
        className="sm:hidden"
      />

      {/* Desktop: calendar button + popover. */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hidden h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 text-[14px] text-foreground shadow-sm transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:flex"
      >
        <span className={value ? "" : "text-muted-foreground"}>{displayLabel}</span>
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={popRef}
                data-northpay-popover
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.16, ease: EASE }}
                // Stop pointer events from bubbling to the document /
                // Radix Dialog — without this, parent listeners would
                // swallow the click and the day buttons wouldn't fire.
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "fixed",
                  top: pos.top,
                  left: pos.left,
                  width: PANEL_W,
                  zIndex: 80,
                  // Radix Dialog (modal) sets `pointer-events: none` on
                  // <body> while open. This popover is portaled to <body>,
                  // so it inherits that and every click is swallowed —
                  // the calendar renders but nothing is selectable. Re-enable
                  // pointer events here so day/nav clicks register.
                  pointerEvents: "auto",
                }}
                className="origin-top rounded-2xl border border-border bg-background p-3 shadow-pop"
              >
                <CalendarPanel
                  viewMonth={viewMonth}
                  onViewMonth={setViewMonth}
                  selected={value ? new Date(value + "T00:00:00") : null}
                  onPick={pick}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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
  // Which switcher is showing: the day grid (default), the month grid, or
  // the scrollable year list. Clicking the month/year label in the header
  // toggles into the matching switcher; picking a value returns to "day".
  const [mode, setMode] = useState<"day" | "month" | "year">("day");

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

  function pickMonth(m: number) {
    onViewMonth(new Date(year, m, 1));
    setMode("day");
  }
  function pickYear(y: number) {
    onViewMonth(new Date(y, month, 1));
    setMode("day");
  }
  function jumpToday() {
    setMode("day");
    onViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onPick(today);
  }

  // Years offered in the year switcher: a generous window around today,
  // scrollable so the header stays free of paging arrows.
  const YEARS: number[] = [];
  for (let y = today.getFullYear() - 80; y <= today.getFullYear() + 10; y++) {
    YEARS.push(y);
  }
  const selectedYearRef = React.useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (mode === "year") {
      selectedYearRef.current?.scrollIntoView({ block: "center" });
    }
  }, [mode]);

  const headerBtn =
    "rounded-lg px-2.5 py-1 text-[13px] font-semibold tracking-tight text-foreground transition-colors hover:bg-muted/70 dark:hover:bg-white/10";

  return (
    <div className="w-full">
      {/* Header: tapping the month or year opens its switcher. */}
      <div className="mb-2 flex items-center justify-center gap-1 px-1">
        <button
          type="button"
          onClick={() => setMode(mode === "month" ? "day" : "month")}
          className={`${headerBtn} ${mode === "month" ? "bg-muted" : ""}`}
        >
          {MONTH_FULL[month]}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "year" ? "day" : "year")}
          className={`${headerBtn} tabular-nums ${mode === "year" ? "bg-muted" : ""}`}
        >
          {year}
        </button>
      </div>

      {mode === "month" ? (
        /* Month switcher — 3 × 4 grid of month names. */
        <div className="grid grid-cols-3 gap-1 px-1 py-1">
          {MONTH_SHORT.map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => pickMonth(i)}
              className={`rounded-lg py-2.5 text-[13px] font-medium transition-colors ${
                i === month
                  ? "bg-foreground text-background dark:bg-white dark:text-black"
                  : "text-foreground hover:bg-muted/70 dark:hover:bg-white/10"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      ) : mode === "year" ? (
        /* Year switcher — scrollable list, auto-centred on the current year. */
        <div className="max-h-[212px] overflow-y-auto px-1 py-1 scrollbar-none">
          <div className="grid grid-cols-4 gap-1">
            {YEARS.map((y) => (
              <button
                key={y}
                ref={y === year ? selectedYearRef : undefined}
                type="button"
                onClick={() => pickYear(y)}
                className={`rounded-lg py-2 text-[13px] font-medium tabular-nums transition-colors ${
                  y === year
                    ? "bg-foreground text-background dark:bg-white dark:text-black"
                    : "text-foreground hover:bg-muted/70 dark:hover:bg-white/10"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}

      {/* Footer: single "Today" action — jumps the view to the current
          month AND selects today's date. Two separate buttons were
          confusing and did effectively the same thing. */}
      <div className="mt-2 flex items-center justify-center border-t border-border/60 px-1 pt-2">
        <button
          type="button"
          onClick={jumpToday}
          className="rounded-full px-3 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          Today
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
    "inline-flex h-12 w-12 items-center justify-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed sm:h-16 sm:w-16";
  const tone =
    variant === "solid"
      ? "bg-foreground text-background hover:bg-foreground/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/10";
  return (
    <button ref={ref} type="button" className={`${base} ${tone} ${className ?? ""}`} {...props} />
  );
});
IconButton.displayName = "IconButton";
