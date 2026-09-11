"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { DatePicker } from "@/components/dashboard/date-picker";
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
    employmentType: "hourly" as EmploymentType,
    annualSalary: "",
    hourlyRate: "",
    payStartDate: "",
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
    // Hourly-only: every employee is treated as hourly in this form.
    employmentType: "hourly" as EmploymentType,
    annualSalary:
      emp.annualSalary !== undefined ? String(emp.annualSalary) : "",
    hourlyRate: emp.hourlyRate !== undefined ? String(emp.hourlyRate) : "",
    payStartDate: emp.payStartDate ?? "",
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
      // Hourly-only: no salary path.
      employmentType: "hourly" as EmploymentType,
      annualSalary: undefined,
      hourlyRate: Number(form.hourlyRate) || 0,
      payStartDate: form.payStartDate || undefined,
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

  const canSubmit = canAdvance && Number(form.hourlyRate) > 0;

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
        // Don't auto-focus the first field when the modal opens — on mobile
        // that pops the keyboard up immediately, which is jarring. The user
        // taps into a field when they're ready.
        onOpenAutoFocus={(e) => e.preventDefault()}
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
        <AutoHeight step={step}>
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
            transition={{ duration: 0.3, ease: EASE, delay: 0.08 }}
            className="space-y-6"
          >
            {step === 1 ? (
              <StepOne form={form} setForm={setForm} />
            ) : (
              <StepTwo form={form} setForm={setForm} />
            )}
          </motion.div>
        </AutoHeight>

        {/* Footer adapts to the step. Icons replace text:
            Step 1: › (continue) on the right — the dialog's top-right × is
                    the only close affordance (no duplicate in the footer).
            Step 2: ‹ (back) on the left, ✓ Add/Save on the right. */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {step === 2 && (
            <IconButton aria-label="Back" onClick={goBack}>
              <ChevronLeft className="h-9 w-9" strokeWidth={2.4} />
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
              <ChevronRight className="h-9 w-9 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.4} />
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

/**
 * Eases the sheet between step heights instead of snapping to the taller
 * one. Step 2 has more fields than step 1, so advancing used to resize the
 * dialog in a single frame — the "abrupt" part of the transition.
 *
 * Animates `height`, deliberately NOT a layout/transform animation: a
 * transform left on an ancestor of an <input> makes mobile browsers draw
 * the caret in the wrong place, which is the same rule the opacity-only
 * page variants below follow.
 *
 * A ResizeObserver keeps it honest when the content itself grows within a
 * step (the ROE fields appearing, a validation line), so the box tracks its
 * contents rather than a height measured once.
 */
function AutoHeight({ step, children }: { step: number; children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  // Skip the very first animation — the sheet should open at its natural
  // size, not grow into it.
  const first = useRef(true);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step]);

  useEffect(() => {
    first.current = false;
  }, []);

  return (
    <motion.div
      animate={{ height }}
      initial={false}
      transition={
        first.current ? { duration: 0 } : { duration: 0.42, ease: EASE }
      }
      style={{ overflow: "hidden" }}
      className="relative"
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

// ─── Animation ───────────────────────────────────────────────────────────
// Opacity-only step transition. We deliberately do NOT animate `x` here:
// any horizontal slide leaves framer-motion's inline `transform` on this
// container, and a transformed ancestor makes mobile browsers (Android
// Chrome / iOS) draw the text caret in the wrong place inside the child
// inputs. A clean cross-fade keeps the caret exactly where it should be.
const pageVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
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
  payStartDate: string;
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
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
          wide
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
        <Field label="Phone" wide>
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
    </>
  );
}

// ─── Step 2: Employment, Hours, Vacation ─────────────────────────────────
// Build the next N bi-weekly pay cycles from a base date (the employee's
// employment start date). Each cycle is 14 days; value = ISO start date.
function nextBiweeklyCycles(baseIso: string, count = 4) {
  const base = baseIso ? new Date(`${baseIso}T00:00:00`) : new Date();
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const cycles: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const start = new Date(base);
    start.setDate(base.getDate() + i * 14);
    const end = new Date(start);
    end.setDate(start.getDate() + 13);
    cycles.push({
      value: start.toISOString().slice(0, 10),
      label: `${fmt(start)} – ${fmt(end)}`,
    });
  }
  return cycles;
}

function StepTwo({ form, setForm }: StepProps) {
  // Offer the next four bi-weekly cycles from the employee's start date. If an
  // already-saved pay-start date isn't among them (edit mode), keep it listed.
  const payCycles = nextBiweeklyCycles(form.startDate);
  const cycleOptions =
    form.payStartDate && !payCycles.some((c) => c.value === form.payStartDate)
      ? [
          {
            value: form.payStartDate,
            label: new Date(`${form.payStartDate}T00:00:00`).toLocaleDateString(
              "en-CA",
              { month: "short", day: "numeric", year: "numeric" }
            ),
          },
          ...payCycles,
        ]
      : payCycles;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Field label="Hourly rate">
          <Input
            type="number"
            inputMode="decimal"
            value={form.hourlyRate}
            onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
            placeholder="32.50"
          />
        </Field>

        <Field label="First pay period">
          <Select
            value={form.payStartDate}
            onValueChange={(v) => setForm({ ...form, payStartDate: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a cycle" />
            </SelectTrigger>
            <SelectContent>
              {cycleOptions.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

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
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
// Compact circular footer button. `variant="solid"` is the primary action
// (continue) — fills with foreground colour. Default is the ghost X / ‹.
const IconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "ghost" | "solid";
  }
>(({ className, variant = "ghost", ...props }, ref) => {
  // 80px: the step has spare room below the fields, and this is the one
  // control the eye should land on there. Also comfortably past the ~44px
  // touch-target floor for a thumb reaching the bottom corner.
  const base =
    "inline-flex h-20 w-20 items-center justify-center rounded-full transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed";
  const tone =
    variant === "solid"
      ? "bg-foreground text-background hover:bg-foreground/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/10";
  return (
    <button ref={ref} type="button" className={`${base} ${tone} ${className ?? ""}`} {...props} />
  );
});
IconButton.displayName = "IconButton";
