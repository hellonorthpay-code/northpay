"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  Send,
} from "lucide-react";
import Link from "next/link";
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
  type PayFrequency,
  type ProvinceCode,
} from "@/lib/payroll/types";
import {
  SAMPLE_FREQUENCIES,
  requestSamplePaystub,
  type SamplePaystubResult,
} from "@/lib/sample-paystub";
import { formatCAD } from "@/lib/utils";

/*
 * ─── SamplePaystubModal ──────────────────────────────────────────────────
 *
 * The landing page's "Try a sample paystub" funnel. Same sheet, same step
 * dots, same 80px circular controls as "Add an employee" — a visitor who
 * later signs up meets a form they have already used.
 *
 *   1 · Who's getting paid      first + last name
 *   2 · The business            name, province, pay frequency
 *   3 · This pay period         hourly rate, hours (live gross estimate)
 *   4 · Where to send it        email → "Send my paystub"
 *   ✓ · Done                    net pay reveal, breakdown, inbox note
 *
 * The figures on the done screen come straight from the payroll engine on
 * the server — the same call that produced the emailed PDF — so the number
 * on screen and the number in the inbox can never disagree.
 * ─────────────────────────────────────────────────────────────────────────
 */

const EASE = [0.32, 0.72, 0, 1] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 1 | 2 | 3 | 4;

interface FormState {
  firstName: string;
  lastName: string;
  businessName: string;
  province: ProvinceCode;
  payFrequency: PayFrequency;
  hourlyRate: string;
  hours: string;
  email: string;
  website: string; // honeypot — never shown
}

const blank = (): FormState => ({
  firstName: "",
  lastName: "",
  businessName: "",
  province: "ON",
  payFrequency: "biweekly",
  hourlyRate: "",
  hours: "",
  email: "",
  website: "",
});

export function SamplePaystubModal({
  open,
  onOpenChange,
  origin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origin?: { x: number; y: number } | null;
}) {
  const [form, setForm] = useState<FormState>(blank);
  const [step, setStep] = useState<Step>(1);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SamplePaystubResult | null>(null);

  // Fresh slate every open, so a second try never inherits a stale result.
  useEffect(() => {
    if (open) {
      setForm(blank());
      setStep(1);
      setSending(false);
      setError(null);
      setResult(null);
    }
  }, [open]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canAdvance: Record<Step, boolean> = {
    1: form.firstName.trim().length > 0 && form.lastName.trim().length > 0,
    2: form.businessName.trim().length > 0,
    3: Number(form.hourlyRate) > 0 && Number(form.hours) > 0,
    4: EMAIL_RE.test(form.email.trim()),
  };

  // The one figure a visitor can sanity-check themselves. Shown live on
  // step 3 so the form gives something back before it asks for an email.
  const grossEstimate = useMemo(() => {
    const rate = Number(form.hourlyRate);
    const hrs = Number(form.hours);
    return rate > 0 && hrs > 0 ? rate * hrs : 0;
  }, [form.hourlyRate, form.hours]);

  function goNext() {
    setError(null);
    setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  }
  function goBack() {
    setError(null);
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }

  async function submit() {
    if (!canAdvance[4] || sending) return;
    setSending(true);
    setError(null);
    const res = await requestSamplePaystub({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      businessName: form.businessName.trim(),
      province: form.province,
      payFrequency: form.payFrequency,
      hourlyRate: Number(form.hourlyRate),
      hours: Number(form.hours),
      email: form.email.trim(),
      website: form.website,
    });
    setSending(false);
    if (res.ok) setResult(res);
    else setError(res.error);
  }

  // Enter advances a step, or sends on the last one — the wizard should be
  // completable without ever reaching for the mouse.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" || result) return;
    // Let Radix Select handle its own Enter.
    if ((e.target as HTMLElement).closest("[role=combobox]")) return;
    e.preventDefault();
    if (step < 4 && canAdvance[step]) goNext();
    else if (step === 4) void submit();
  }

  // Scale-in from the button that opened it (see AddEmployeeModal).
  const originStyle =
    origin && typeof window !== "undefined"
      ? {
          transformOrigin: `calc(50% + ${origin.x - window.innerWidth / 2}px) calc(50% + ${origin.y - window.innerHeight / 2}px)`,
        }
      : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[88vw] p-4 gap-2.5 max-h-[80vh] overflow-y-auto scrollbar-none sm:max-w-xl sm:p-7 sm:gap-6 sm:max-h-[85vh]"
        style={originStyle}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
      >
        <DialogHeader>
          <DialogTitle>
            {result ? "Your sample paystub" : "Try a sample paystub"}
          </DialogTitle>
          {!result && <StepDots step={step} />}
        </DialogHeader>

        {/* Opacity-only step transition — no `x`. A lingering transform on
            this container makes mobile browsers draw the caret in the wrong
            place inside the inputs below. */}
        <div className="relative overflow-hidden">
          <motion.div
            key={result ? "done" : step}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="space-y-6"
          >
            {result ? (
              <Done result={result} form={form} onClose={() => onOpenChange(false)} />
            ) : step === 1 ? (
              <StepOne form={form} set={set} />
            ) : step === 2 ? (
              <StepTwo form={form} set={set} />
            ) : step === 3 ? (
              <StepThree form={form} set={set} gross={grossEstimate} />
            ) : (
              <StepFour form={form} set={set} />
            )}
          </motion.div>
        </div>

        {error && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12.5px] font-medium text-destructive">
            {error}
          </p>
        )}

        {!result && (
          <div className="flex items-center justify-between gap-2 pt-1">
            {step > 1 ? (
              <IconButton aria-label="Back" onClick={goBack} disabled={sending}>
                <ChevronLeft className="h-9 w-9" strokeWidth={2.4} />
              </IconButton>
            ) : (
              <span />
            )}

            {step < 4 ? (
              <IconButton
                aria-label="Continue"
                onClick={goNext}
                disabled={!canAdvance[step]}
                variant="solid"
                className="group"
              >
                <ChevronRight
                  className="h-9 w-9 transition-transform duration-200 group-hover:translate-x-0.5"
                  strokeWidth={2.4}
                />
              </IconButton>
            ) : (
              <Button
                onClick={submit}
                disabled={!canAdvance[4] || sending}
                className="h-12 rounded-full px-6 text-[15px] font-semibold sm:h-16 sm:px-7 sm:text-[16px]"
              >
                {sending ? (
                  <Loader2 className="h-5 w-5 animate-spin sm:h-6 sm:w-6" />
                ) : (
                  <Send className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.4} />
                )}
                {sending ? "Sending" : "Send my paystub"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Steps ───────────────────────────────────────────────────────────────

type Setter = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StepOne({ form, set }: { form: FormState; set: Setter }) {
  return (
    <div className="space-y-5">
      <Lead
        eyebrow="Step 1 of 4"
        title="Who's getting paid?"
        body="Any name works — this is a sample, not a record."
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" htmlFor="sp-first">
          <Input
            id="sp-first"
            autoComplete="given-name"
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
          />
        </Field>
        <Field label="Last name" htmlFor="sp-last">
          <Input
            id="sp-last"
            autoComplete="family-name"
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

function StepTwo({ form, set }: { form: FormState; set: Setter }) {
  return (
    <div className="space-y-5">
      <Lead
        eyebrow="Step 2 of 4"
        title="The business"
        body="Province sets the tax tables and overtime rules."
      />
      <Field label="Business name" htmlFor="sp-biz">
        <Input
          id="sp-biz"
          autoComplete="organization"
          value={form.businessName}
          onChange={(e) => set("businessName", e.target.value)}
        />
      </Field>
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
      <Field label="Pay frequency">
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border/60 bg-muted/40 p-1 sm:grid-cols-4">
          {SAMPLE_FREQUENCIES.map((f) => {
            const active = form.payFrequency === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => set("payFrequency", f.id)}
                className={`rounded-xl px-3 py-2.5 text-[13px] font-medium tracking-tight transition-colors active:scale-[0.98] ${
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
  );
}

function StepThree({
  form,
  set,
  gross,
}: {
  form: FormState;
  set: Setter;
  gross: number;
}) {
  const freq = SAMPLE_FREQUENCIES.find((f) => f.id === form.payFrequency)?.label ?? "";
  return (
    <div className="space-y-5">
      <Lead
        eyebrow="Step 3 of 4"
        title="This pay period"
        body={`Hours past your province's weekly threshold are paid at 1.5×, just like a real run.`}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Hourly rate" htmlFor="sp-rate">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-muted-foreground">
              $
            </span>
            <Input
              id="sp-rate"
              inputMode="decimal"
              placeholder="22.00"
              className="pl-7"
              value={form.hourlyRate}
              onChange={(e) => set("hourlyRate", e.target.value.replace(/[^\d.]/g, ""))}
            />
          </div>
        </Field>
        <Field label={`Hours (${freq.toLowerCase()})`} htmlFor="sp-hours">
          <Input
            id="sp-hours"
            inputMode="decimal"
            placeholder="80"
            value={form.hours}
            onChange={(e) => set("hours", e.target.value.replace(/[^\d.]/g, ""))}
          />
        </Field>
      </div>

      {/* Live gross — the form gives something back before asking for
          an email. The net figure needs the engine, so it waits. */}
      <div className="flex items-baseline justify-between rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
        <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Gross this period
        </span>
        <span className="text-[18px] font-semibold tabular-nums tracking-tight">
          {gross > 0 ? formatCAD(gross) : "—"}
        </span>
      </div>
    </div>
  );
}

function StepFour({ form, set }: { form: FormState; set: Setter }) {
  return (
    <div className="space-y-5">
      <Lead
        eyebrow="Step 4 of 4"
        title="Where should it go?"
        body="We'll email the PDF — the same statement of earnings an employee would receive."
      />
      <Field label="Email" htmlFor="sp-email">
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="sp-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@business.ca"
            className="pl-9"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
      </Field>

      {/* Honeypot. Visually and semantically hidden; bots fill it anyway. */}
      <div aria-hidden className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
          />
        </label>
      </div>

      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        One email, nothing else. No account is created.
      </p>
    </div>
  );
}

function Done({
  result,
  form,
  onClose,
}: {
  result: SamplePaystubResult;
  form: FormState;
  onClose: () => void;
}) {
  const rows: Array<[string, number]> = [
    ["Gross pay", result.gross],
    ["Federal tax", -result.federalTax],
    ["Provincial tax", -result.provincialTax],
    ["CPP", -result.cpp],
    ["EI", -result.ei],
  ];
  return (
    <div className="space-y-5">
      {/* Net pay reveal — the one number that matters, given the room. */}
      <div className="rounded-3xl bg-foreground px-6 py-6 text-background dark:bg-white dark:text-black">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
          {form.firstName}&rsquo;s net pay · {result.periodLabel}
        </p>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: EASE }}
          className="mt-2 text-[40px] font-semibold leading-none tracking-tightest tabular-nums"
        >
          {formatCAD(result.net)}
        </motion.p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-muted/20">
        {rows.map(([label, value], i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 + i * 0.05, duration: 0.3 }}
            className={`flex items-center justify-between px-4 py-2.5 text-[13.5px] ${
              i < rows.length - 1 ? "border-b border-border/50" : ""
            }`}
          >
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium tabular-nums tracking-tight">
              {value < 0 ? `−${formatCAD(-value)}` : formatCAD(value)}
            </span>
          </motion.div>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success/15 text-success">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {result.emailed ? (
            <>
              The full PDF is on its way to{" "}
              <span className="font-medium text-foreground">{form.email.trim()}</span>.
              If it isn&rsquo;t there in a few minutes, check spam.
            </>
          ) : (
            <>Email delivery isn&rsquo;t set up on this environment yet — but these figures are real.</>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-[11.5px] text-muted-foreground">
          Calculated with 2026 CRA rates. A sample, not a payroll record.
        </p>
        <Link href="/dashboard" onClick={onClose}>
          <Button className="group h-12 rounded-full px-6 text-[15px] font-semibold">
            Run payroll for real
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────

function Lead({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {eyebrow}
      </p>
      <p className="mt-1 text-[17px] font-semibold tracking-tight">{title}</p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{body}</p>
    </div>
  );
}

function StepDots({ step }: { step: Step }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            step === n
              ? "w-6 bg-foreground dark:bg-white"
              : n < step
                ? "w-1.5 bg-foreground/50"
                : "w-1.5 bg-muted-foreground/40"
          }`}
        />
      ))}
    </div>
  );
}

// Same 80px circular control as the employee wizard.
const IconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "ghost" | "solid" }
>(({ className, variant = "ghost", ...props }, ref) => {
  const base =
    "inline-flex h-20 w-20 items-center justify-center rounded-full transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed";
  const tone =
    variant === "solid"
      ? "bg-foreground text-background hover:bg-foreground/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/10";
  return <button ref={ref} type="button" className={`${base} ${tone} ${className ?? ""}`} {...props} />;
});
IconButton.displayName = "IconButton";
