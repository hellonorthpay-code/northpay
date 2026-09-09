"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Download,
  History,
  Loader2,
  Mail,
  Plus,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddEmployeeModal } from "@/components/dashboard/employees/add-employee-modal";
import { DatePicker } from "@/components/dashboard/date-picker";
import { PaystubSheet } from "@/components/dashboard/paystubs/paystub-sheet";
import { UpgradeBanner } from "@/components/dashboard/billing/billing";
import { useBilling } from "@/lib/billing/client";
import { useEmployees } from "@/lib/store/employees";
import { usePayrollRuns } from "@/lib/store/payroll";
import { useSettings } from "@/lib/store/settings";
import { getRepositories } from "@/lib/repositories";
import { PayrollLifecycleService } from "@/lib/services/lifecycle";
import { enqueuePaystubEmails } from "@/lib/email/enqueue-client";
import { generatePaystubPDF } from "@/lib/pdf/paystub";
import { OVERTIME_WEEKLY_HOURS, TAX_YEAR } from "@/lib/payroll/constants";
import {
  PROVINCE_NAMES,
  SUPPORTED_PROVINCES,
  type Employee,
  type PayFrequency,
  type PayrollLineResult,
  type PayrollRun,
  type ProvinceCode,
} from "@/lib/payroll/types";
import { SAMPLE_FREQUENCIES } from "@/lib/sample-paystub";
import { cn, formatCAD, formatDate } from "@/lib/utils";

/*
 * ─── LiveView ────────────────────────────────────────────────────────────
 *
 * Pay one person, now. Pick an employee (or add one inline and save them),
 * enter hours, optionally add vacation pay, set the period, watch the
 * paystub build itself, email it.
 *
 * Every number on the right comes from PayrollLifecycleService.preview —
 * the same engine and the same year-to-date fold that the full Payroll run
 * uses — so CPP and EI caps are honoured across the year. "Email paystub"
 * finalizes a real one-line payroll run: it lands in History, feeds YTD,
 * and rolls into the CRA remittance. This is the product, not a printer.
 *
 * Business details are read from Settings and never edited here.
 * ─────────────────────────────────────────────────────────────────────────
 */

const ease = [0.22, 1, 0.36, 1] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_MS = 86_400_000;
const PERIOD_DAYS: Record<PayFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  semimonthly: 15,
  monthly: 30,
  semiannually: 182,
  annually: 365,
};

// Local calendar date. toISOString() is UTC, which is already tomorrow after
// ~8pm in Toronto — a paystub made in the evening must not carry the wrong
// period end.
const iso = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const addDays = (isoDate: string, n: number) =>
  iso(new Date(new Date(`${isoDate}T00:00:00`).getTime() + n * DAY_MS));

/** A period that ends today, sized to the frequency. */
function defaultPeriod(freq: PayFrequency) {
  const end = iso(new Date());
  return { start: addDays(end, -(PERIOD_DAYS[freq] - 1)), end, pay: end };
}

type Selection = "new" | string;

interface Draft {
  firstName: string;
  lastName: string;
  email: string;
  sin: string;
  province: ProvinceCode;
  payFrequency: PayFrequency;
  hourlyRate: string;
}

function LiveEditor() {
  const employees = useEmployees((s) => s.employees);
  const addEmployee = useEmployees((s) => s.addEmployee);
  const updateEmployee = useEmployees((s) => s.updateEmployee);
  const company = useSettings((s) => s.company);
  const runs = usePayrollRuns((s) => s.runs);
  const upsertRun = usePayrollRuns((s) => s.upsertRun);
  const billing = useBilling();

  // Seeded synchronously from the already-hydrated store (LiveView gates on
  // that), so the first paint is the right employee — no "New employee"
  // fields flashing for a frame before the list arrives.
  const [selectedId, setSelectedId] = useState<Selection>(
    () => useEmployees.getState().employees[0]?.id ?? "new"
  );
  const selected = useMemo(
    () => employees.find((e) => e.id === selectedId) ?? null,
    [employees, selectedId]
  );

  // Only meaningful while adding someone new.
  const [draft, setDraft] = useState<Draft>(() => ({
    firstName: "",
    lastName: "",
    email: "",
    sin: "",
    province: company.defaultProvince,
    payFrequency: company.defaultPayFrequency,
    hourlyRate: "",
  }));
  const setD = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    bump();
    setDraft((d) => ({ ...d, [k]: v }));
  };

  // Per-paystub inputs.
  const [hours, setHours] = useState("");
  // For a saved employee: a rate change applies to THIS paystub only. The
  // permanent rate is edited through the gear → edit sheet.
  const [rateOverride, setRateOverride] = useState("");
  const [vacOn, setVacOn] = useState(false);
  const [vacAmount, setVacAmount] = useState("");
  const [period, setPeriod] = useState(() => defaultPeriod(company.defaultPayFrequency));
  // A saved employee with no email needs one before we can send.
  const [emailFix, setEmailFix] = useState("");

  // Ring "thinking" state — on for a beat after every input, so the border
  // visibly reacts and then settles once the user pauses.
  const [active, setActive] = useState(false);
  const activeTimer = useRef<number | null>(null);
  const bump = () => {
    setActive(true);
    if (activeTimer.current) window.clearTimeout(activeTimer.current);
    activeTimer.current = window.setTimeout(() => setActive(false), 900);
  };
  useEffect(
    () => () => {
      if (activeTimer.current) window.clearTimeout(activeTimer.current);
    },
    []
  );

  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState<"save" | "email" | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<{
    run: PayrollRun;
    line: PayrollLineResult;
    emailedTo: string | null;
    configured: boolean;
  } | null>(null);

  // Selecting someone resets the per-paystub inputs and re-derives the
  // period from THEIR frequency. Keeping stale hours from the previous
  // person is exactly the kind of quiet mistake this screen must not make.
  //
  // Exception: when the selection changes because we just saved the person
  // being typed in, the hours and period the user entered must survive.
  const keepInputs = useRef(false);
  useEffect(() => {
    if (keepInputs.current) {
      keepInputs.current = false;
      return;
    }
    setHours("");
    setRateOverride("");
    setVacOn(false);
    setVacAmount("");
    setEmailFix("");
    setErrors([]);
    setDone(null);
    const freq = selected?.payFrequency ?? draft.payFrequency;
    setPeriod(defaultPeriod(freq));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Frequency change (new employee) re-sizes the period from its start.
  const effectiveFreq: PayFrequency = selected?.payFrequency ?? draft.payFrequency;
  function setStart(start: string) {
    if (!start) return;
    const end = addDays(start, PERIOD_DAYS[effectiveFreq] - 1);
    setPeriod({ start, end, pay: end });
  }
  useEffect(() => {
    if (selected) return;
    setPeriod((p) => {
      const end = addDays(p.start, PERIOD_DAYS[draft.payFrequency] - 1);
      return { ...p, end, pay: end };
    });
  }, [draft.payFrequency, selected]);

  // ── The employee the engine sees ──
  const snapshot: Employee | null = useMemo(() => {
    if (selected) {
      const override = Number(rateOverride);
      return {
        ...selected,
        employmentType: "hourly",
        hourlyRate: rateOverride && override > 0 ? override : selected.hourlyRate,
      };
    }
    return {
      id: "new",
      firstName: draft.firstName,
      lastName: draft.lastName,
      email: draft.email,
      sin: draft.sin || "*** *** ***",
      province: draft.province,
      employmentType: "hourly",
      hourlyRate: Number(draft.hourlyRate) || 0,
      payFrequency: draft.payFrequency,
      vacationPercent: 4,
      vacationMode: "payout",
      standardWeeklyHours: 40,
      overtimeThresholdHours: OVERTIME_WEEKLY_HOURS[draft.province],
      startDate: period.start,
      createdAt: new Date().toISOString(),
    };
  }, [selected, draft, rateOverride, period.start]);

  // ── Live preview through the real lifecycle (real YTD) ──
  const lifecycle = useMemo(
    () => new PayrollLifecycleService(getRepositories(), runs),
    [runs]
  );
  const hoursNum = Math.min(400, Math.max(0, Number(hours) || 0));
  const vacationAmount = vacOn ? Math.max(0, Number(vacAmount) || 0) : 0;
  const preview = useMemo(() => {
    if (!snapshot) return null;
    return lifecycle.preview({
      employees: [snapshot],
      inputs: [
        {
          employeeId: snapshot.id,
          hoursWorked: hoursNum,
          payOvertime: true,
          vacationAmount,
        },
      ],
      periodStart: period.start,
      periodEnd: period.end,
      payDate: period.pay,
    });
  }, [snapshot, lifecycle, hoursNum, vacationAmount, period]);
  const line = preview?.lines[0] ?? null;

  // What 4% would be — offered as a one-tap suggestion when vacation is on.
  const suggestedVacation = useMemo(() => {
    if (!line) return 0;
    const base = line.regularPay + line.overtimePay;
    const pct = (selected?.vacationPercent ?? 4) / 100;
    return Math.round(base * pct * 100) / 100;
  }, [line, selected]);

  // ── Gates ──
  const companyReady = Boolean(
    company.legalName?.trim() &&
      company.businessNumber?.trim() &&
      company.address?.trim() &&
      company.city?.trim() &&
      company.postalCode?.trim()
  );
  const billingBlocked = billing.configured && !billing.entitled;

  const recipientEmail = (selected ? selected.email || emailFix : draft.email).trim();
  const rateOk = (snapshot?.hourlyRate ?? 0) > 0;
  const nameOk = !!snapshot?.firstName.trim() && !!snapshot?.lastName.trim();
  const canSave = !selected && nameOk && rateOk;
  const canEmail =
    nameOk &&
    rateOk &&
    hoursNum > 0 &&
    EMAIL_RE.test(recipientEmail) &&
    companyReady &&
    !billingBlocked &&
    busy === null;

  // ── Actions ──
  async function saveNewEmployee(): Promise<Employee | null> {
    if (!snapshot || selected) return selected;
    const before = new Set(useEmployees.getState().employees.map((e) => e.id));
    await addEmployee({
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      email: draft.email.trim(),
      sin: draft.sin.trim() || "*** *** ***",
      province: draft.province,
      employmentType: "hourly",
      hourlyRate: Number(draft.hourlyRate) || 0,
      payFrequency: draft.payFrequency,
      vacationPercent: 4,
      vacationMode: "payout",
      standardWeeklyHours: 40,
      overtimeThresholdHours: OVERTIME_WEEKLY_HOURS[draft.province],
      startDate: period.start,
    });
    const created =
      useEmployees.getState().employees.find((e) => !before.has(e.id)) ?? null;
    if (created) {
      keepInputs.current = true;
      setSelectedId(created.id);
    }
    return created;
  }

  async function handleSave() {
    if (!canSave) return;
    setBusy("save");
    setErrors([]);
    try {
      const created = await saveNewEmployee();
      if (!created) setErrors(["The employee was saved but couldn't be reselected — pick them from the list."]);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Couldn't save the employee."]);
    } finally {
      setBusy(null);
    }
  }

  async function handleEmail() {
    if (!canEmail || !snapshot) return;
    setBusy("email");
    setErrors([]);
    try {
      // 1. A new employee is saved first — a run must reference a real record.
      let employee = selected;
      if (!employee) {
        employee = await saveNewEmployee();
        if (!employee) throw new Error("Couldn't save the employee.");
      }
      // 2. A saved employee without an email gets the one just entered.
      if (!employee.email && emailFix) {
        await updateEmployee(employee.id, { email: emailFix.trim() });
        employee = { ...employee, email: emailFix.trim() };
      }
      const runEmployee: Employee = {
        ...employee,
        employmentType: "hourly",
        hourlyRate: snapshot.hourlyRate,
      };

      // 3. Finalize against a FRESH runs snapshot so duplicate-period and
      //    YTD checks see everything, including a paystub sent a minute ago.
      const freshRuns = await getRepositories().payroll.getAll();
      const svc = new PayrollLifecycleService(getRepositories(), freshRuns);
      const result = await svc.finalize({
        employees: [runEmployee],
        inputs: [
          {
            employeeId: runEmployee.id,
            hoursWorked: hoursNum,
            payOvertime: true,
            vacationAmount,
          },
        ],
        periodStart: period.start,
        periodEnd: period.end,
        payDate: period.pay,
      });
      if (!result.ok) {
        setErrors(result.result.errors.map((e) => e.message));
        return;
      }
      upsertRun(result.run);

      // 4. Email — best-effort; the run is already recorded either way.
      let configured = false;
      try {
        const allRuns = await getRepositories().payroll.getAll();
        const outcome = await enqueuePaystubEmails(result.run, company, allRuns);
        configured = outcome.configured;
      } catch (e) {
        console.warn("[live] email dispatch failed (non-fatal):", e);
      }
      setDone({
        run: result.run,
        line: result.run.lines[0],
        emailedTo: configured ? runEmployee.email : null,
        configured,
      });
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
    } finally {
      setBusy(null);
    }
  }

  function startAnother() {
    setDone(null);
    setHours("");
    setVacOn(false);
    setVacAmount("");
    setErrors([]);
    setPeriod(defaultPeriod(effectiveFreq));
  }

  const freqLabel =
    SAMPLE_FREQUENCIES.find((f) => f.id === effectiveFreq)?.label ??
    effectiveFreq;

  return (
    <div className="space-y-4 md:space-y-5">
      {!companyReady && (
        <div className="flex flex-col gap-3 rounded-3xl border border-amber-300/50 bg-amber-50 p-5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-[14px] font-semibold tracking-tight">
                Add your business details first
              </p>
              <p className="mt-1 text-[12.5px] opacity-90">
                Legal name, business number and address print on every paystub.
                You can preview here, but not send.
              </p>
            </div>
          </div>
          <Link href="/dashboard/settings">
            <Button size="sm" className="rounded-full">Open Settings</Button>
          </Link>
        </div>
      )}
      <UpgradeBanner />

      <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr] lg:gap-5">
        {/* ═══════════ Left: who and how much ═══════════ */}
        <div className="rounded-3xl border border-border/70 bg-card/70 p-4 shadow-soft backdrop-blur-xl sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Employee
          </p>

          <div className="mt-2.5">
            <EmployeePicker
              employees={employees}
              value={selectedId}
              onChange={setSelectedId}
              onEdit={(id) => {
                setSelectedId(id);
                setEditOpen(true);
              }}
            />
          </div>

          <Collapse show={!selected}>
            <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First name" htmlFor="lv-first">
                    <Input id="lv-first" value={draft.firstName} onChange={(e) => setD("firstName", e.target.value.slice(0, 40))} />
                  </Field>
                  <Field label="Last name" htmlFor="lv-last">
                    <Input id="lv-last" value={draft.lastName} onChange={(e) => setD("lastName", e.target.value.slice(0, 40))} />
                  </Field>
                </div>
                <Field label="Email" htmlFor="lv-email" hint="Where the paystub is sent.">
                  <Input id="lv-email" type="email" inputMode="email" autoComplete="off" value={draft.email} onChange={(e) => setD("email", e.target.value)} />
                </Field>
                <Field label="SIN" htmlFor="lv-sin" hint="9 digits. Printed on the paystub and required for the T4.">
                  <Input
                    id="lv-sin"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="123456789"
                    value={draft.sin}
                    onChange={(e) => setD("sin", e.target.value.replace(/\D/g, "").slice(0, 9))}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Province">
                    <Select value={draft.province} onValueChange={(v) => setD("province", v as ProvinceCode)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_PROVINCES.map((p) => (
                          <SelectItem key={p} value={p}>{PROVINCE_NAMES[p]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Pay frequency">
                    <Select value={draft.payFrequency} onValueChange={(v) => setD("payFrequency", v as PayFrequency)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SAMPLE_FREQUENCIES.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
            </div>
          </Collapse>

          {/* ── This paystub ── */}
          <div className="mt-5 border-t border-border/60 pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              This paystub
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-3">
              <Field label="Hourly rate" htmlFor="lv-rate" hint={selected ? "This paystub only" : undefined}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-muted-foreground">$</span>
                  <Input
                    id="lv-rate"
                    inputMode="decimal"
                    className="pl-7"
                    placeholder={selected ? String(selected.hourlyRate ?? "") : "24.50"}
                    value={selected ? rateOverride : draft.hourlyRate}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d.]/g, "").slice(0, 7);
                      bump();
                      if (selected) setRateOverride(v);
                      else setD("hourlyRate", v);
                    }}
                  />
                </div>
              </Field>
              <Field label={`Hours (${freqLabel.toLowerCase()})`} htmlFor="lv-hours">
                <Input
                  id="lv-hours"
                  inputMode="decimal"
                  placeholder="80"
                  value={hours}
                  onChange={(e) => { bump(); setHours(e.target.value.replace(/[^\d.]/g, "").slice(0, 6)); }}
                />
              </Field>
            </div>

            {/* Vacation pay — opt-in, as a dollar amount, with the standard
                percentage offered as a one-tap suggestion so "the usual" is
                never a calculation the user has to do in their head. */}
            <div className="mt-4">
              <Collapse show={!vacOn}>
                <button
                  type="button"
                  onClick={() => {
                    setVacOn(true);
                    if (!vacAmount && suggestedVacation > 0) setVacAmount(suggestedVacation.toFixed(2));
                  }}
                  className="flex items-center gap-1.5 px-1 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add vacation pay
                </button>
              </Collapse>
              <Collapse show={vacOn}>
                  <div className="rounded-2xl border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="lv-vac">Vacation pay</Label>
                      <button
                        type="button"
                        onClick={() => { setVacOn(false); setVacAmount(""); }}
                        aria-label="Remove vacation pay"
                        className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-muted-foreground">$</span>
                        <Input id="lv-vac" inputMode="decimal" className="pl-7" value={vacAmount} onChange={(e) => { bump(); setVacAmount(e.target.value.replace(/[^\d.]/g, "").slice(0, 8)); }} />
                      </div>
                      {suggestedVacation > 0 && (
                        <button
                          type="button"
                          onClick={() => { bump(); setVacAmount(suggestedVacation.toFixed(2)); }}
                          className="shrink-0 rounded-full border border-border/70 px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          {selected?.vacationPercent ?? 4}% = {formatCAD(suggestedVacation)}
                        </button>
                      )}
                    </div>
                  </div>
              </Collapse>
            </div>

            {/* Period */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Field label="Period start" htmlFor="lv-start">
                <DatePicker value={period.start} onChange={setStart} />
              </Field>
              <Field label="Period end" htmlFor="lv-end">
                <DatePicker value={period.end} onChange={(v) => setPeriod((p) => ({ ...p, end: v, pay: v > p.pay ? v : p.pay }))} />
              </Field>
              <Field label="Pay date" htmlFor="lv-pay">
                <DatePicker value={period.pay} onChange={(v) => setPeriod((p) => ({ ...p, pay: v }))} />
              </Field>
            </div>

            <Collapse show={!!selected && !selected.email}>
              <div className="mt-4">
                <Field label="Employee email" htmlFor="lv-emailfix" hint="Saved to their record when you send.">
                  <Input id="lv-emailfix" type="email" inputMode="email" value={emailFix} onChange={(e) => setEmailFix(e.target.value)} />
                </Field>
              </div>
            </Collapse>
          </div>

          <Collapse show={errors.length > 0}>
            <ul className="mt-4 space-y-1 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12.5px] font-medium text-destructive">
              {errors.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </Collapse>

          {/* Actions */}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Fade show={!selected}>
              <Button
                variant="outline"
                disabled={!canSave || busy !== null}
                onClick={handleSave}
                className="h-11 w-full rounded-full sm:h-10 sm:w-auto"
              >
                {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2.6} />}
                Save employee
              </Button>
            </Fade>
            <Button
              disabled={!canEmail}
              onClick={handleEmail}
              className="h-12 rounded-full text-[15px] font-semibold sm:h-10 sm:text-[13px] sm:font-medium"
            >
              {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {busy === "email" ? "Sending" : "Email paystub"}
            </Button>
          </div>
          <Collapse show={!selected}>
            <p className="mt-2 text-right text-[11.5px] text-muted-foreground">
              Emailing saves the employee for next time.
            </p>
          </Collapse>
        </div>

        {/* ═══════════ Right: the paystub ═══════════ */}
        <div className="relative">
          {/* Same ring as the homepage calculator: a slow conic gradient that
              always turns, a faster one that fades in while typing, and a
              blurred copy behind the card as a glow. */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0.28, scale: 1 }}
            animate={
              active
                ? { opacity: 0.55, scale: [1, 1.015, 1] }
                : { opacity: 0.28, scale: 1 }
            }
            transition={
              active
                ? { opacity: { duration: 0.25 }, scale: { duration: 1.1, repeat: Infinity, ease: "easeInOut" } }
                : { duration: 0.6, ease }
            }
            className="np-ring np-ring--fast pointer-events-none absolute -inset-2 rounded-[36px] blur-2xl"
          />
          <div className="relative rounded-[30px] p-[2px]">
            <div aria-hidden className="np-ring absolute inset-0 rounded-[30px]" />
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: active ? 1 : 0 }}
              transition={{ duration: 0.3 }}
              className="np-ring np-ring--fast absolute inset-0 rounded-[30px]"
            />
          <div className="relative overflow-hidden rounded-[28px] bg-background shadow-glass">
            <AnimatePresence mode="wait" initial={false}>
              {done ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease }}
                >
                  <SentCard
                    done={done}
                    onDownload={() => generatePaystubPDF(done.line, company, runs)}
                    onAnother={startAnother}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease }}
                >
                  {line && snapshot && (
                    <PaystubPreview
                      line={line}
                      employee={snapshot}
                      company={company}
                      freqLabel={freqLabel}
                      onHistory={() => setHistoryOpen(true)}
                      historyCount={runs.filter((r) => r.status === "finalized").length}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          </div>
        </div>
      </div>

      {selected && (
        <AddEmployeeModal open={editOpen} onOpenChange={setEditOpen} employee={selected} />
      )}
      <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} runs={runs} company={company} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Entry: wait for the stores, then fade the editor in once
// ═════════════════════════════════════════════════════════════════════════

export function LiveView() {
  const employeesReady = useEmployees((s) => s.hydrated);
  const settingsReady = useSettings((s) => s.hydrated);
  const runsReady = usePayrollRuns((s) => s.hydrated);
  const ready = employeesReady && settingsReady && runsReady;

  // Rendering the editor before the stores arrive is what caused the
  // flash: it painted "New employee" and empty fields, then re-seeded to
  // the first real employee a moment later. A calm skeleton, then one fade.
  if (!ready) return <LiveSkeleton />;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease }}
    >
      <LiveEditor />
    </motion.div>
  );
}

function LiveSkeleton() {
  const block = "animate-pulse rounded-2xl bg-muted/60";
  return (
    <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr] lg:gap-5" aria-busy>
      <div className="rounded-3xl border border-border/70 bg-card/70 p-4 shadow-soft sm:p-6">
        <div className={`${block} h-3 w-20`} />
        <div className={`${block} mt-3 h-12 w-full`} />
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className={`${block} h-11`} />
          <div className={`${block} h-11`} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className={`${block} h-11`} />
          <div className={`${block} h-11`} />
          <div className={`${block} h-11`} />
        </div>
      </div>
      <div className="rounded-[28px] border border-border/70 bg-background p-6 shadow-glass">
        <div className={`${block} h-5 w-40`} />
        <div className={`${block} mt-6 h-24 w-full`} />
        <div className={`${block} mt-4 h-24 w-full`} />
        <div className={`${block} mt-4 h-16 w-full`} />
      </div>
    </div>
  );
}

/**
 * Height + opacity in/out, no transforms — so nothing above an <input>
 * ever carries a lingering transform (the mobile caret rule), and a block
 * that appears pushes its neighbours down instead of snapping them.
 */
function Collapse({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ height: { duration: 0.32, ease }, opacity: { duration: 0.22, ease } }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Opacity-only in/out for things that live inside a row. */
function Fade({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease }}
          className="w-full sm:w-auto"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Employee picker — a real dropdown with a gear on every row
// ═════════════════════════════════════════════════════════════════════════

function EmployeePicker({
  employees,
  value,
  onChange,
  onEdit,
}: {
  employees: Employee[];
  value: Selection;
  onChange: (v: Selection) => void;
  onEdit: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = employees.find((e) => e.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-3.5 text-left transition-colors hover:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/20"
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-3">
            <Avatar name={`${selected.firstName} ${selected.lastName}`} />
            <span className="min-w-0 truncate text-[14px] font-medium tracking-tight">
              {selected.firstName} {selected.lastName}
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-background">
              <Plus className="h-4 w-4" strokeWidth={2.6} />
            </span>
            <span className="text-[14px] font-medium tracking-tight">New employee</span>
          </span>
        )}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.18, ease }}
            className="absolute left-0 right-0 top-full z-30 mt-2 origin-top overflow-hidden rounded-2xl border border-border bg-background shadow-pop"
          >
            <ul className="max-h-72 overflow-y-auto py-1">
              {employees.map((e) => {
                const active = e.id === value;
                return (
                  <li key={e.id} className="flex items-center gap-1 pr-1.5">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => { onChange(e.id); setOpen(false); }}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                        active && "bg-muted/40"
                      )}
                    >
                      <Avatar name={`${e.firstName} ${e.lastName}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium tracking-tight">{e.firstName} {e.lastName}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {PROVINCE_NAMES[e.province]} · {formatCAD(e.hourlyRate ?? 0)}/hr
                        </span>
                      </span>
                      {active && <Check className="ml-auto h-4 w-4 shrink-0" strokeWidth={2.6} />}
                    </button>
                    {/* The gear lives on the row, as asked: name, then settings. */}
                    <button
                      type="button"
                      onClick={() => { setOpen(false); onEdit(e.id); }}
                      aria-label={`Edit ${e.firstName} ${e.lastName}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
              <li className={cn(employees.length > 0 && "border-t border-border/60 mt-1 pt-1")}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === "new"}
                  onClick={() => { onChange("new"); setOpen(false); }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-background">
                    <Plus className="h-4 w-4" strokeWidth={2.6} />
                  </span>
                  <span className="text-[13.5px] font-medium tracking-tight">Add a new employee</span>
                </button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold">
      {initials}
    </span>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Paystub preview — the statement, live
// ═════════════════════════════════════════════════════════════════════════

function PaystubPreview({
  line,
  employee,
  company,
  freqLabel,
  onHistory,
  historyCount,
}: {
  line: PayrollLineResult;
  employee: Employee;
  company: { operatingName: string; legalName: string; address: string; city: string; craPayrollAccount?: string };
  freqLabel: string;
  onHistory: () => void;
  historyCount: number;
}) {
  const name = `${employee.firstName.trim()} ${employee.lastName.trim()}`.trim();
  const rows = [
    { id: "reg", label: "Regular", value: line.regularPay },
    ...(line.overtimePay > 0 ? [{ id: "ot", label: "Overtime (1.5×)", value: line.overtimePay }] : []),
    ...(line.vacationAccrual > 0 ? [{ id: "vac", label: "Vacation pay", value: line.vacationAccrual }] : []),
  ];
  return (
    <div>
      <div className="flex items-start justify-between gap-4 bg-muted/50 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold tracking-tight">
            {company.operatingName || company.legalName || "Your business"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {[company.address, company.city].filter(Boolean).join(", ") || "Add your address in Settings"}
          </p>
        </div>
        <button
          type="button"
          onClick={onHistory}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-1.5 text-[12px] font-medium text-muted-foreground shadow-soft transition-colors hover:text-foreground active:scale-95"
        >
          <History className="h-3.5 w-3.5" />
          History
          {historyCount > 0 && <span className="tabular-nums text-foreground">· {historyCount}</span>}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Employee</p>
          <p className={cn("mt-1 truncate text-[14px] font-medium tracking-tight", !name && "text-muted-foreground/60")}>
            {name || "Employee name"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            SIN {employee.sin || "•••"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatDate(line.periodStart)} – {formatDate(line.periodEnd)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Employment</p>
          <p className="mt-1 truncate text-[14px] font-medium tracking-tight">{PROVINCE_NAMES[employee.province]} · Hourly</p>
          <p className="text-[11px] text-muted-foreground">
            {freqLabel} · <Money value={employee.hourlyRate ?? 0} />/hr · {line.hoursWorked + line.overtimeHours}h
          </p>
        </div>
      </div>

      <div className="grid gap-3 border-t border-border/60 px-5 py-4 sm:grid-cols-2 sm:px-6">
        <Table heading="Earnings" rows={rows} total={{ label: "Gross pay", value: line.grossPay }} />
        <Table
          heading="Deductions"
          negative
          rows={[
            { id: "fed", label: "Federal income tax", value: line.federalTax },
            { id: "prov", label: `${employee.province} income tax`, value: line.provincialTax },
            { id: "cpp", label: "CPP contribution", value: line.cppEmployee + line.cpp2Employee },
            { id: "ei", label: "EI premium", value: line.eiEmployee },
          ]}
          total={{ label: "Total deductions", value: line.totalDeductions }}
        />
      </div>

      <div className="mx-5 mb-5 flex items-end justify-between rounded-2xl border border-border/70 bg-muted/30 px-4 py-4 sm:mx-6 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Net deposit</p>
          <Pulse watch={line.netPay}>
            <Money value={line.netPay} className="mt-1 block text-[34px] font-semibold leading-none tracking-tightest tabular-nums sm:text-[38px]" />
          </Pulse>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Employer cost</p>
          <Money value={line.grossPay + line.cppEmployer + line.cpp2Employer + line.eiEmployer} className="mt-1 block text-[15px] font-semibold tabular-nums tracking-tight" />
          <p className="text-[10px] text-muted-foreground">Pay date {formatDate(line.periodEnd)}</p>
        </div>
      </div>

      <p className="border-t border-border/60 bg-muted/40 px-5 py-3 text-[11px] text-muted-foreground sm:px-6">
        Calculated with {TAX_YEAR} CRA tables · year-to-date applied
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// After sending
// ═════════════════════════════════════════════════════════════════════════

function SentCard({
  done,
  onDownload,
  onAnother,
}: {
  done: { run: PayrollRun; line: PayrollLineResult; emailedTo: string | null; configured: boolean };
  onDownload: () => void;
  onAnother: () => void;
}) {
  const l = done.line;
  return (
    <div className="p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-success/15 text-success">
          <Check className="h-5 w-5" strokeWidth={3} />
        </span>
        <div>
          <p className="text-[16px] font-semibold tracking-tight">
            {done.emailedTo ? "Paystub sent" : "Paystub recorded"}
          </p>
          <p className="text-[12.5px] text-muted-foreground">
            {done.emailedTo
              ? <>On its way to <span className="font-medium text-foreground">{done.emailedTo}</span>.</>
              : "Email isn't set up on this environment yet, but the run is saved."}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl bg-foreground px-6 py-6 text-background dark:bg-white dark:text-black">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
          {l.employee.firstName}&rsquo;s net pay · {formatDate(l.periodStart)} – {formatDate(l.periodEnd)}
        </p>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease }}
          className="mt-2 text-[40px] font-semibold leading-none tracking-tightest tabular-nums"
        >
          {formatCAD(l.netPay)}
        </motion.p>
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
        Recorded as a finalized payroll run. It counts toward year-to-date and
        this month&rsquo;s CRA remittance, and it&rsquo;s in History.
      </p>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onDownload} className="h-11 rounded-full sm:h-10">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
        <Button onClick={onAnother} className="h-11 rounded-full sm:h-10">
          <Sparkles className="h-4 w-4" />
          New paystub
        </Button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// History — every paystub, by month
// ═════════════════════════════════════════════════════════════════════════

function HistoryDialog({
  open,
  onOpenChange,
  runs,
  company,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  runs: PayrollRun[];
  company: Parameters<typeof enqueuePaystubEmails>[1];
}) {
  const [viewing, setViewing] = useState<PayrollLineResult | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // One row per paystub (a run from the Payroll tab may hold several).
  const groups = useMemo(() => {
    const items = runs
      .filter((r) => r.status === "finalized" && !r.reverses)
      .flatMap((r) => r.lines.map((line) => ({ run: r, line })))
      .sort((a, b) => b.run.payDate.localeCompare(a.run.payDate));
    const map = new Map<string, typeof items>();
    for (const it of items) {
      const key = it.run.payDate.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), it]);
    }
    return [...map.entries()].map(([ym, list]) => ({
      ym,
      label: new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-CA", { month: "long", year: "numeric" }),
      list,
      total: list.reduce((s, it) => s + it.line.netPay, 0),
    }));
  }, [runs]);

  async function resend(run: PayrollRun, line: PayrollLineResult) {
    const key = `${run.id}:${line.employeeId}`;
    setResending(key);
    setNote(null);
    try {
      if (!line.employee.email) {
        setNote(`${line.employee.firstName} has no email on file.`);
        return;
      }
      const single: PayrollRun = { ...run, lines: [line] };
      const outcome = await enqueuePaystubEmails(single, company, runs);
      setNote(outcome.configured ? `Sent again to ${line.employee.email}.` : "Email isn't configured on this environment.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't resend.");
    } finally {
      setResending(null);
    }
  }

  return (
    <>
      <Dialog open={open && !viewing} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[92vw] gap-3 p-4 max-h-[84vh] overflow-y-auto scrollbar-none sm:max-w-lg sm:gap-5 sm:p-7">
          <DialogHeader className="pr-12 sm:pr-14">
            <DialogTitle className="text-[17px] sm:text-xl">Paystub history</DialogTitle>
          </DialogHeader>

          {groups.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-8 text-center">
              <History className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-[13.5px] font-medium tracking-tight">No paystubs yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">The first one you email will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.ym}>
                  <div className="flex items-baseline justify-between px-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.label}</p>
                    <p className="text-[12px] tabular-nums text-muted-foreground">{formatCAD(g.total)} net</p>
                  </div>
                  <ul className="mt-2 divide-y divide-border/50 rounded-2xl border border-border/60 bg-background/60">
                    {g.list.map(({ run, line }) => {
                      const key = `${run.id}:${line.employeeId}`;
                      return (
                        <li key={key} className="flex items-center gap-3 px-3.5 py-3">
                          <Avatar name={`${line.employee.firstName} ${line.employee.lastName}`} />
                          <button type="button" onClick={() => setViewing(line)} className="min-w-0 flex-1 text-left">
                            <p className="truncate text-[13.5px] font-medium tracking-tight">
                              {line.employee.firstName} {line.employee.lastName}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {formatDate(line.periodStart)} – {formatDate(line.periodEnd)} · paid {formatDate(run.payDate)}
                            </p>
                          </button>
                          <p className="shrink-0 text-[13.5px] font-semibold tabular-nums tracking-tight">{formatCAD(line.netPay)}</p>
                          <div className="flex shrink-0 items-center">
                            <IconAction label="Download PDF" onClick={() => generatePaystubPDF(line, company, runs)}>
                              <Download className="h-3.5 w-3.5" />
                            </IconAction>
                            <IconAction label="Email again" onClick={() => resend(run, line)} busy={resending === key}>
                              <Mail className="h-3.5 w-3.5" />
                            </IconAction>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {note && (
            <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-[12px] font-medium">{note}</p>
          )}
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {viewing && <PaystubSheet line={viewing} onClose={() => setViewing(null)} />}
      </AnimatePresence>
    </>
  );
}

function IconAction({ label, onClick, busy, children }: { label: string; onClick: () => void; busy?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={busy}
      className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Bits
// ═════════════════════════════════════════════════════════════════════════

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A figure that moves to its new value on a critically damped spring. */
function Money({ value, negative = false, className }: { value: number; negative?: boolean; className?: string }) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(value);
  const spring = useSpring(mv, reduced ? { stiffness: 2000, damping: 200 } : { stiffness: 170, damping: 26, mass: 0.6 });
  const text = useTransform(spring, (v) => {
    const abs = Math.abs(v).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${negative && v > 0.005 ? "−" : ""}$${abs}`;
  });
  useEffect(() => { mv.set(value); }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}

function Pulse({ watch, children }: { watch: number; children: React.ReactNode }) {
  const prev = useRef(watch);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (prev.current !== watch) { prev.current = watch; setTick((t) => t + 1); }
  }, [watch]);
  return (
    <div className="relative">
      <AnimatePresence>
        {tick > 0 && (
          <motion.span key={tick} initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: "easeOut" }} className="pointer-events-none absolute -inset-x-3 -inset-y-2 rounded-xl bg-emerald-400/25" />
        )}
      </AnimatePresence>
      <div className="relative">{children}</div>
    </div>
  );
}

function Table({ heading, rows, total, negative = false }: { heading: string; rows: Array<{ id: string; label: string; value: number }>; total: { label: string; value: number }; negative?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <p className="bg-muted/50 px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{heading}</p>
      <div className="divide-y divide-border/50">
        <AnimatePresence initial={false}>
          {rows.map((r) => (
            <motion.div key={r.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease }} className="overflow-hidden">
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
