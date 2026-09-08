"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { Mail, Sparkles } from "lucide-react";
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
import { calculatePayrollLine } from "@/lib/payroll/engine";
import { OVERTIME_WEEKLY_HOURS, TAX_YEAR } from "@/lib/payroll/constants";
import {
  PROVINCE_NAMES,
  SUPPORTED_PROVINCES,
  type Employee,
  type PayFrequency,
  type ProvinceCode,
} from "@/lib/payroll/types";
import { emptyYTD } from "@/lib/services/ytd";
import { SAMPLE_FREQUENCIES } from "@/lib/sample-paystub";
import { formatDate } from "@/lib/utils";
import { SectionLabel, SectionSub, SectionTitle } from "./section";

const SamplePaystubModal = dynamic(
  () => import("./sample-paystub-modal").then((m) => m.SamplePaystubModal),
  { ssr: false }
);

/*
 * ─── LivePaystub ─────────────────────────────────────────────────────────
 *
 * The homepage demo: a form on the left, a paystub on the right, and the
 * production payroll engine running between them on every keystroke.
 *
 * Nothing here is a mock-up of the maths. `calculatePayrollLine` is the same
 * function that produces real paystubs in the app, fed the same 2026 CRA
 * tables, so the visitor is watching the actual product think — federal and
 * provincial brackets, CPP with the YMPE cap, EI, vacation pay, and 1.5×
 * overtime past their province's weekly threshold.
 *
 * The business is fixed (Lily's Cafe) — this is a demo of the calculation,
 * not an account. Every figure animates to its new value with a critically
 * damped spring so a change reads as the number *moving*, not flickering.
 * ─────────────────────────────────────────────────────────────────────────
 */

const ease = [0.22, 1, 0.36, 1] as const;

const BUSINESS = {
  name: "Lily's Cafe",
  address: "48 Elm Street, Toronto ON",
  account: "CRA payroll account ••• RP0001",
} as const;

const DAY_MS = 86_400_000;
const PERIOD_DAYS: Record<PayFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  semimonthly: 15,
  monthly: 30,
  semiannually: 182,
  annually: 365,
};

interface Inputs {
  firstName: string;
  lastName: string;
  province: ProvinceCode;
  payFrequency: PayFrequency;
  hourlyRate: string;
  hours: string;
}

// Populated from the first frame so the paystub is never an empty frame —
// the visitor edits a working example rather than filling a blank form.
const DEFAULTS: Inputs = {
  firstName: "Jordan",
  lastName: "Bell",
  province: "ON",
  payFrequency: "biweekly",
  hourlyRate: "24.50",
  hours: "80",
};

export function LivePaystub() {
  const [form, setForm] = useState<Inputs>(DEFAULTS);
  const [emailOpen, setEmailOpen] = useState(false);
  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // ── The real engine, on every change ──
  const line = useMemo(() => {
    const rate = Math.min(500, Math.max(0, Number(form.hourlyRate) || 0));
    const hours = Math.min(400, Math.max(0, Number(form.hours) || 0));
    const end = new Date();
    const periodEnd = end.toISOString().slice(0, 10);
    const periodStart = new Date(
      end.getTime() - (PERIOD_DAYS[form.payFrequency] - 1) * DAY_MS
    )
      .toISOString()
      .slice(0, 10);

    const employee: Employee = {
      id: "DEMO",
      firstName: form.firstName,
      lastName: form.lastName,
      email: "",
      sin: "",
      province: form.province,
      employmentType: "hourly",
      hourlyRate: rate,
      payFrequency: form.payFrequency,
      vacationPercent: 4,
      vacationMode: "payout",
      standardWeeklyHours: 40,
      overtimeThresholdHours: OVERTIME_WEEKLY_HOURS[form.province],
      startDate: periodStart,
      createdAt: periodEnd,
    };

    const result = calculatePayrollLine(
      employee,
      { employeeId: employee.id, hoursWorked: hours, payOvertime: true },
      periodStart,
      periodEnd,
      emptyYTD(employee.id, TAX_YEAR, periodEnd)
    );
    return { ...result, periodStart, periodEnd };
  }, [form]);

  const displayName =
    `${form.firstName.trim()} ${form.lastName.trim()}`.trim() || "Your name";
  const freqLabel =
    SAMPLE_FREQUENCIES.find((f) => f.id === form.payFrequency)?.label ?? "";

  return (
    <section id="try-it" className="relative py-32">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>
            <Sparkles className="h-3 w-3" />
            Try it live
          </SectionLabel>
          <SectionTitle>The live paystub calculator.</SectionTitle>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10">
          {/* ── Left: the inputs ──
              Opacity-only entrance. A transform on an ancestor of an <input>
              makes mobile browsers draw the caret in the wrong place. */}
          <div>
            {/* The badges sit ABOVE their cards, as matched labels on a pair.
                Numbering them 1 and 2 reads as a sequence before either label
                is actually read — input, then output. */}
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <span className="inline-flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-background">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-background/25 text-[10px]">1</span>
                You type here
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {BUSINESS.name} · demo
              </span>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease }}
              className="rounded-3xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-xl sm:p-7"
            >
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" htmlFor="lp-first">
                <Input
                  id="lp-first"
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value.slice(0, 30))}
                />
              </Field>
              <Field label="Last name" htmlFor="lp-last">
                <Input
                  id="lp-last"
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value.slice(0, 30))}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Province">
                <Select
                  value={form.province}
                  onValueChange={(v) => set("province", v as ProvinceCode)}
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
            </div>

            <div className="mt-4">
              <Field label="Pay frequency">
                <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border/60 bg-muted/40 p-1 sm:grid-cols-4">
                  {SAMPLE_FREQUENCIES.map((f) => {
                    const active = form.payFrequency === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => set("payFrequency", f.id)}
                        className={`rounded-xl px-2 py-2 text-[12.5px] font-medium tracking-tight transition-colors active:scale-[0.98] ${
                          active
                            ? "bg-card text-foreground shadow-soft"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Hourly rate" htmlFor="lp-rate">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="lp-rate"
                    inputMode="decimal"
                    className="pl-7"
                    value={form.hourlyRate}
                    onChange={(e) =>
                      set("hourlyRate", e.target.value.replace(/[^\d.]/g, "").slice(0, 7))
                    }
                  />
                </div>
              </Field>
              <Field label={`Hours (${freqLabel.toLowerCase()})`} htmlFor="lp-hours">
                <Input
                  id="lp-hours"
                  inputMode="decimal"
                  value={form.hours}
                  onChange={(e) =>
                    set("hours", e.target.value.replace(/[^\d.]/g, "").slice(0, 5))
                  }
                />
              </Field>
            </div>

            <p className="mt-5 text-[11.5px] leading-relaxed text-muted-foreground">
              Overtime past {OVERTIME_WEEKLY_HOURS[form.province]} hours a week in{" "}
              {PROVINCE_NAMES[form.province]} is paid at 1.5× automatically.
              Vacation pay is 4%. Nothing is saved.
            </p>
            </motion.div>
          </div>

          {/* ── Right: the paystub ── */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <span className="inline-flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-background">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-background/25 text-[10px]">2</span>
                Sample paystub
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Generated live · not a real record
              </span>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease }}
              className="relative"
            >
            <div className="pointer-events-none absolute -inset-6 rounded-[40px] bg-gradient-to-br from-emerald-200/30 via-transparent to-sky-200/30 blur-3xl dark:from-emerald-500/10 dark:to-sky-500/10" />

            <div className="relative overflow-hidden rounded-[28px] border border-border/70 bg-background shadow-glass">
              {/* Header band — mirrors the PDF's */}
              <div className="flex items-start justify-between gap-4 bg-muted/50 px-6 py-5">
                <div>
                  <p className="text-[16px] font-semibold tracking-tight">{BUSINESS.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{BUSINESS.address}</p>
                  <p className="text-[11px] text-muted-foreground">{BUSINESS.account}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">
                    Statement of earnings
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDate(line.periodStart)} – {formatDate(line.periodEnd)}
                  </p>
                </div>
              </div>

              {/* Employee block */}
              <div className="grid grid-cols-2 gap-4 px-6 py-4">
                <div>
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Employee
                  </p>
                  <p
                    className={`mt-1 truncate text-[14px] font-medium tracking-tight ${
                      displayName === "Your name" ? "text-muted-foreground/60" : ""
                    }`}
                  >
                    {displayName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">SIN ••• ••• •••</p>
                </div>
                <div>
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Employment
                  </p>
                  <p className="mt-1 text-[14px] font-medium tracking-tight">
                    {PROVINCE_NAMES[form.province]} · Hourly
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {freqLabel} ·{" "}
                    <Money value={Number(form.hourlyRate) || 0} className="tabular-nums" />
                    /hr
                  </p>
                </div>
              </div>

              {/* Earnings + deductions */}
              <div className="grid gap-4 border-t border-border/60 px-6 py-5 sm:grid-cols-2">
                <Table
                  heading="Earnings"
                  rows={[
                    { label: "Regular", value: line.regularPay, id: "reg" },
                    ...(line.overtimePay > 0
                      ? [{ label: "Overtime (1.5×)", value: line.overtimePay, id: "ot" }]
                      : []),
                    { label: "Vacation pay (4%)", value: line.vacationAccrual, id: "vac" },
                  ]}
                  total={{ label: "Gross pay", value: line.grossPay }}
                />
                <Table
                  heading="Deductions"
                  negative
                  rows={[
                    { label: "Federal income tax", value: line.federalTax, id: "fed" },
                    { label: `${form.province} income tax`, value: line.provincialTax, id: "prov" },
                    { label: "CPP contribution", value: line.cppEmployee + line.cpp2Employee, id: "cpp" },
                    { label: "EI premium", value: line.eiEmployee, id: "ei" },
                  ]}
                  total={{ label: "Total deductions", value: line.totalDeductions }}
                />
              </div>

              {/* Net deposit hero */}
              <div className="mx-6 mb-5 flex items-end justify-between rounded-2xl border border-border/70 bg-muted/30 px-5 py-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Net deposit
                  </p>
                  <Pulse watch={line.netPay}>
                    <Money
                      value={line.netPay}
                      className="mt-1 block text-[38px] font-semibold leading-none tracking-tightest tabular-nums"
                    />
                  </Pulse>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Employer cost
                  </p>
                  <Money
                    value={line.grossPay + line.cppEmployer + line.cpp2Employer + line.eiEmployer}
                    className="mt-1 block text-[15px] font-semibold tabular-nums tracking-tight"
                  />
                  <p className="text-[10px] text-success">Paid</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/60 bg-muted/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-muted-foreground">
                  Calculated with {TAX_YEAR} CRA tables · Generated by NorthPay
                </p>
                <Button
                  size="sm"
                  className="group rounded-full"
                  onClick={() => setEmailOpen(true)}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email me this paystub
                </Button>
              </div>
            </div>
            </motion.div>
          </div>
        </div>
      </div>

      {emailOpen && (
        <SamplePaystubModal
          open={emailOpen}
          onOpenChange={setEmailOpen}
          initial={{
            firstName: form.firstName,
            lastName: form.lastName,
            businessName: BUSINESS.name,
            province: form.province,
            payFrequency: form.payFrequency,
            hourlyRate: form.hourlyRate,
            hours: form.hours,
          }}
        />
      )}
    </section>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

/**
 * A dollar figure that moves to its new value instead of flickering.
 * Critically-damped spring — settles quickly with no overshoot, so a
 * deduction never appears to "bounce" through a wrong number.
 */
function Money({
  value,
  negative = false,
  className,
}: {
  value: number;
  negative?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(value);
  const spring = useSpring(mv, reduced
    ? { stiffness: 2000, damping: 200 }
    : { stiffness: 170, damping: 26, mass: 0.6 });
  const text = useTransform(spring, (v) => {
    const abs = Math.abs(v).toLocaleString("en-CA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${negative && v > 0.005 ? "−" : ""}$${abs}`;
  });
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}

/** A soft emerald wash that fires once whenever the watched value changes. */
function Pulse({ watch, children }: { watch: number; children: React.ReactNode }) {
  const prev = useRef(watch);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (prev.current !== watch) {
      prev.current = watch;
      setTick((t) => t + 1);
    }
  }, [watch]);
  return (
    <div className="relative">
      <AnimatePresence>
        {tick > 0 && (
          <motion.span
            key={tick}
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="pointer-events-none absolute -inset-x-3 -inset-y-2 rounded-xl bg-emerald-400/25"
          />
        )}
      </AnimatePresence>
      <div className="relative">{children}</div>
    </div>
  );
}

function Table({
  heading,
  rows,
  total,
  negative = false,
}: {
  heading: string;
  rows: Array<{ id: string; label: string; value: number }>;
  total: { label: string; value: number };
  negative?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <p className="bg-muted/50 px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {heading}
      </p>
      <div className="divide-y divide-border/50">
        <AnimatePresence initial={false}>
          {rows.map((r) => (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 py-2 text-[12.5px]">
                <span className="text-muted-foreground">{r.label}</span>
                <Money value={r.value} negative={negative} className="font-medium tabular-nums" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="flex items-center justify-between bg-muted/50 px-3 py-2 text-[12.5px] font-semibold">
        <span>{total.label}</span>
        <Money value={total.value} negative={negative} className="tabular-nums" />
      </div>
    </div>
  );
}
