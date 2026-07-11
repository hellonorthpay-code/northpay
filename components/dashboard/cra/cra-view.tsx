"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  Banknote,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Info,
  PartyPopper,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { usePayrollRuns } from "@/lib/store/payroll";
import { useRemittance } from "@/lib/store/remittance";
import { useSettings } from "@/lib/store/settings";
import { generateRemittancePDF } from "@/lib/pdf/remittance";
import {
  RemittanceService,
  type MonthlyRemittance,
} from "@/lib/services/remittance";
import { cn, formatCAD, formatDate, round2 } from "@/lib/utils";
import { TAX_YEAR } from "@/lib/payroll/constants";
import { ReportsView } from "@/components/dashboard/reports/reports-view";

const ease = [0.22, 1, 0.36, 1] as const;

// ─────────────────────────────────────────────────────────────────────────
// CRA tab — rebuilt around one question: "Do I owe CRA anything right now?"
//
// Layout, top to bottom:
//   1. Hero glass card → the selected month's amount, due date, one action.
//   2. Month timeline → horizontal pills; tap a month, the hero updates.
//   3. Year overview → remitted vs outstanding progress + expandable split.
//   4. Year-end records & filings (T4 · T4A · ROE) — unchanged sub-view.
// Everything secondary (breakdown, how-to-pay) is behind calm reveals.
// ─────────────────────────────────────────────────────────────────────────
export function CRAView() {
  const runs = usePayrollRuns((s) => s.runs);
  const remittedMap = useRemittance((s) => s.remitted);
  const markRemitted = useRemittance((s) => s.markRemitted);
  const unmark = useRemittance((s) => s.unmark);
  const company = useSettings((s) => s.company);

  const service = useMemo(
    () => new RemittanceService(runs, remittedMap),
    [runs, remittedMap]
  );
  const months = useMemo(() => service.getMonthly(), [service]);
  const nextDue = useMemo(() => service.getNextDue(), [service]);

  const [showReports, setShowReports] = useState(false);

  // Selected month drives the hero. Defaults to the next-due month (or the
  // most recent one when everything is settled) and follows nextDue as
  // months get marked — unless the operator explicitly picked one.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const userPicked = useRef(false);
  useEffect(() => {
    if (userPicked.current && selectedKey) return;
    const fallback =
      nextDue?.monthKey ?? months[months.length - 1]?.monthKey ?? null;
    setSelectedKey(fallback);
  }, [nextDue?.monthKey, months, selectedKey]);

  const selected = useMemo(
    () => months.find((m) => m.monthKey === selectedKey) ?? null,
    [months, selectedKey]
  );

  const year = useMemo(() => {
    const sum = (arr: MonthlyRemittance[], k: keyof MonthlyRemittance) =>
      round2(arr.reduce((a, m) => a + (m[k] as number), 0));
    const remitted = months.filter((m) => m.remitted);
    return {
      remitted: sum(remitted, "total"),
      total: sum(months, "total"),
      outstanding: round2(
        sum(
          months.filter((m) => !m.remitted && m.total > 0),
          "total"
        )
      ),
      federalTax: sum(months, "federalTax"),
      provincialTax: sum(months, "provincialTax"),
      cpp: sum(months, "cpp"),
      ei: sum(months, "ei"),
    };
  }, [months]);

  // ─── Year-end records sub-view (kept) ───
  if (showReports) {
    return (
      <div className="space-y-5">
        <motion.button
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease }}
          type="button"
          onClick={() => setShowReports(false)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3.5 py-2 text-[13px] font-medium text-foreground shadow-soft backdrop-blur-xl transition-all duration-200 hover:bg-muted/40 active:scale-95"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to CRA
        </motion.button>
        <ReportsView />
      </div>
    );
  }

  // ─── Empty state: no payroll yet ───
  if (months.length === 0) {
    return (
      <div className="space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease }}
          className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-10 text-center shadow-soft backdrop-blur-xl"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-500/10" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-rose-200/30 blur-3xl dark:bg-rose-500/10" />
          <div className="relative">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-muted">
              <Banknote className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-5 text-[18px] font-semibold tracking-tight">
              Nothing to remit yet
            </p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Run your first payroll and NorthPay will total up what you owe
              CRA each month — taxes, CPP, and EI — and remind you when
              it&rsquo;s due.
            </p>
            <Link
              href="/dashboard/payroll"
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-[14px] font-semibold text-background transition-transform duration-200 hover:scale-[1.02] active:scale-95"
            >
              Go to payroll
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
        <YearEndButton onOpen={() => setShowReports(true)} delay={0.15} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── 1 · Hero ─── */}
      <AnimatePresence mode="wait" initial={false}>
        {selected && (
          <HeroCard
            key={selected.monthKey}
            month={selected}
            isNextDue={selected.monthKey === nextDue?.monthKey}
            allSettled={!nextDue}
            onMark={() => markRemitted(selected.monthKey)}
            onUnmark={() => unmark(selected.monthKey)}
          />
        )}
      </AnimatePresence>

      {/* ─── 2 · Month timeline ─── */}
      <MonthTimeline
        months={months}
        selectedKey={selectedKey}
        onSelect={(k) => {
          userPicked.current = true;
          setSelectedKey(k);
        }}
      />

      {/* ─── 3 · Year overview ─── */}
      {year.total > 0 && (
        <YearOverview
          year={year}
          onExport={() =>
            generateRemittancePDF(
              company,
              months,
              {
                remittedTotal: year.remitted,
                outstandingTotal: year.outstanding,
                total: year.total,
                federalTax: year.federalTax,
                provincialTax: year.provincialTax,
                cpp: year.cpp,
                ei: year.ei,
              },
              TAX_YEAR
            )
          }
        />
      )}

      {/* ─── 4 · Year-end records ─── */}
      <YearEndButton onOpen={() => setShowReports(true)} delay={0.25} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 1 · Hero card — the one number that matters
// ─────────────────────────────────────────────────────────────────────────
function HeroCard({
  month,
  isNextDue,
  allSettled,
  onMark,
  onUnmark,
}: {
  month: MonthlyRemittance;
  isNextDue: boolean;
  allSettled: boolean;
  onMark: () => void;
  onUnmark: () => void;
}) {
  const daysToDue = useMemo(() => {
    const due = new Date(month.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / 86_400_000);
  }, [month.dueDate]);

  const urgency =
    daysToDue < 0 ? "late" : daysToDue <= 7 ? "soon" : "calm";

  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.99 }}
      transition={{ duration: 0.4, ease }}
      className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-soft backdrop-blur-xl"
    >
      {/* Liquid-glass ambience */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-rose-200/35 blur-3xl dark:bg-rose-500/10" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-sky-200/35 blur-3xl dark:bg-sky-500/10" />
      <div className="pointer-events-none absolute left-1/3 top-0 h-40 w-40 rounded-full bg-emerald-100/40 blur-3xl dark:bg-emerald-500/5" />

      <div className="relative p-6 md:p-8">
        {/* Context line */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4, ease }}
          className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
        >
          {month.remitted
            ? `${month.monthLabel} · sent to CRA`
            : isNextDue
            ? `You owe CRA · for ${month.monthLabel}`
            : `Coming up · ${month.monthLabel}`}
        </motion.p>

        {/* The number */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45, ease }}
          className={cn(
            "mt-3 text-[52px] font-semibold leading-none tracking-tightest tabular-nums md:text-[64px]",
            month.remitted &&
              "text-muted-foreground/70 line-through decoration-2 decoration-success/60"
          )}
        >
          {formatCAD(month.total)}
        </motion.p>

        {/* Status line */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease }}
          className="mt-4"
        >
          {month.remitted ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-2 text-[13px] font-medium text-success">
              <Check className="h-4 w-4" strokeWidth={3} />
              Remitted
              {month.remittedAt ? ` on ${formatDate(month.remittedAt)}` : ""}
            </span>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium shadow-soft",
                urgency === "late" &&
                  "border-destructive/30 bg-destructive/10 text-destructive",
                urgency === "soon" &&
                  "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                urgency === "calm" && "border-border/70 bg-background/70"
              )}
            >
              <Calendar className="h-4 w-4" />
              Due {formatDate(month.dueDate)}
              <span className="opacity-40">·</span>
              {daysToDue < 0
                ? `${Math.abs(daysToDue)} day${
                    Math.abs(daysToDue) === 1 ? "" : "s"
                  } late`
                : daysToDue === 0
                ? "today"
                : `in ${daysToDue} days`}
            </span>
          )}
        </motion.div>

        {/* Primary action */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.4, ease }}
          className="mt-7"
        >
          {month.remitted ? (
            <button
              type="button"
              onClick={onUnmark}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border/70 bg-background/70 px-5 text-[13px] font-medium text-muted-foreground transition-all duration-200 hover:bg-muted/50 hover:text-foreground active:scale-95"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Undo — not sent yet
            </button>
          ) : (
            <MarkButton onMark={onMark} amount={month.total} />
          )}
        </motion.div>

        {/* What's in this number — progressive disclosure */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.36, duration: 0.4 }}
          className="mt-7 border-t border-border/60 pt-4"
        >
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="flex items-center gap-2 text-[13.5px] font-medium tracking-tight">
              <Info className="h-4 w-4 text-muted-foreground" />
              What&rsquo;s in this number?
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-300",
                showBreakdown && "rotate-180"
              )}
            />
          </button>

          <AnimatePresence initial={false}>
            {showBreakdown && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.32, ease }}
                style={{ overflow: "hidden" }}
              >
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[
                    { label: "Federal tax", value: month.federalTax },
                    { label: "Provincial tax", value: month.provincialTax },
                    { label: "CPP · both halves", value: month.cpp },
                    { label: "EI · with employer", value: month.ei },
                  ].map((t, i) => (
                    <motion.div
                      key={t.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i, duration: 0.3, ease }}
                      className="rounded-2xl border border-border/60 bg-background/50 px-4 py-3"
                    >
                      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {t.label}
                      </p>
                      <p className="mt-1 text-[15px] font-semibold tabular-nums tracking-tight">
                        {formatCAD(t.value)}
                      </p>
                    </motion.div>
                  ))}
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] leading-relaxed text-muted-foreground">
                  Totalled from {month.runCount} payroll run
                  {month.runCount === 1 ? "" : "s"} in {month.monthLabel}. CPP
                  includes your half as the employer; EI includes 1.4× employer
                  premium.
                  <Link
                    href="/dashboard/payroll"
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    View runs
                  </Link>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* How do I pay */}
        {!month.remitted && <HowToPay />}

        {/* All-clear note when everything is settled */}
        {allSettled && month.remitted && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4, ease }}
            className="mt-5 inline-flex items-center gap-2 text-[12.5px] text-muted-foreground"
          >
            <PartyPopper className="h-4 w-4 text-success" />
            You&rsquo;re all caught up with CRA.
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}

// Big, satisfying primary button with a two-stage confirm → success morph so
// marking feels deliberate (same spirit as slide-to-run on Payroll).
function MarkButton({
  onMark,
  amount,
}: {
  onMark: () => void;
  amount: number;
}) {
  const [stage, setStage] = useState<"idle" | "confirm" | "done">("idle");

  useEffect(() => {
    if (stage !== "confirm") return;
    const t = setTimeout(() => setStage("idle"), 3500);
    return () => clearTimeout(t);
  }, [stage]);

  function handleClick() {
    if (stage === "idle") {
      setStage("confirm");
      return;
    }
    if (stage === "confirm") {
      setStage("done");
      setTimeout(onMark, 650);
    }
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileTap={{ scale: 0.96 }}
      className={cn(
        "relative inline-flex h-14 w-full items-center justify-center gap-2.5 overflow-hidden rounded-full px-7 text-[15px] font-semibold transition-colors duration-300 sm:w-auto",
        stage === "done"
          ? "bg-success text-success-foreground"
          : "bg-foreground text-background"
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {stage === "idle" && (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="inline-flex items-center gap-2.5"
          >
            <Check className="h-5 w-5" strokeWidth={2.6} />
            I&rsquo;ve paid this to CRA
          </motion.span>
        )}
        {stage === "confirm" && (
          <motion.span
            key="confirm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="inline-flex items-center gap-2.5"
          >
            Tap again to confirm · {formatCAD(amount)}
          </motion.span>
        )}
        {stage === "done" && (
          <motion.span
            key="done"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
            className="inline-flex items-center gap-2.5"
          >
            <Check className="h-5 w-5" strokeWidth={3} />
            Marked as remitted
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// Collapsible payment instructions — calm, three options, official link.
function HowToPay() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 border-t border-border/60 pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 text-[13.5px] font-medium tracking-tight">
          <Banknote className="h-4 w-4 text-muted-foreground" />
          How do I pay this?
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-300",
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
            style={{ overflow: "hidden" }}
          >
            <div className="mt-4 space-y-2.5">
              {[
                {
                  title: "Online banking",
                  copy: "Add the payee “Federal – Payroll Deductions” and pay with your 15-character RP account number.",
                },
                {
                  title: "CRA My Business Account",
                  copy: "Use “Pay now” by Interac, or set up pre-authorized debit.",
                },
                {
                  title: "At your bank",
                  copy: "In person with a remittance voucher, or by mailed cheque.",
                },
              ].map((o, i) => (
                <motion.div
                  key={o.title}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.06 * i, duration: 0.3, ease }}
                  className="rounded-2xl border border-border/60 bg-background/50 px-4 py-3"
                >
                  <p className="text-[13px] font-medium tracking-tight">
                    {o.title}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                    {o.copy}
                  </p>
                </motion.div>
              ))}
            </div>
            <a
              href="https://www.canada.ca/en/revenue-agency/services/make-a-payment-canada-revenue-agency.html"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground underline-offset-2 hover:underline"
            >
              CRA — Make a payment
              <ExternalLink className="h-3 w-3" />
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 2 · Month timeline — horizontal pills, one per month
// ─────────────────────────────────────────────────────────────────────────
function MonthTimeline({
  months,
  selectedKey,
  onSelect,
}: {
  months: MonthlyRemittance[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  if (months.length <= 1) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4, ease }}
      className="overflow-x-auto scrollbar-none"
    >
      <div className="flex w-max items-center gap-2 rounded-full border border-border/60 bg-card/70 p-1.5 shadow-soft backdrop-blur-xl">
        {months.map((m) => {
          const active = m.monthKey === selectedKey;
          return (
            <button
              key={m.monthKey}
              type="button"
              onClick={() => onSelect(m.monthKey)}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-colors duration-200",
                active
                  ? "text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="cra-active-month"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-full bg-foreground"
                />
              )}
              <span
                className={cn(
                  "relative z-10 grid h-4 w-4 place-items-center rounded-full",
                  m.remitted
                    ? "bg-success text-success-foreground"
                    : active
                    ? "bg-background/25"
                    : "bg-amber-500/15"
                )}
              >
                {m.remitted ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                ) : (
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      active ? "bg-background" : "bg-amber-500"
                    )}
                  />
                )}
              </span>
              <span className="relative z-10 whitespace-nowrap">
                {m.monthLabel.split(" ")[0]}
              </span>
              <span className="relative z-10 whitespace-nowrap tabular-nums opacity-60">
                {formatCAD(m.total)}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 3 · Year overview — one calm card with a progress bar
// ─────────────────────────────────────────────────────────────────────────
function YearOverview({
  year,
  onExport,
}: {
  year: {
    remitted: number;
    outstanding: number;
    total: number;
    federalTax: number;
    provincialTax: number;
    cpp: number;
    ei: number;
  };
  onExport: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [exported, setExported] = useState(false);
  const pct =
    year.total > 0 ? Math.min(100, (year.remitted / year.total) * 100) : 0;

  function handleExport() {
    onExport();
    setExported(true);
    setTimeout(() => setExported(false), 2400);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.45, ease }}
      className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-xl"
    >
      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {TAX_YEAR} so far
            </p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              Your PD7A statement of account
            </p>
          </div>
          <motion.button
            type="button"
            onClick={handleExport}
            whileTap={{ scale: 0.94 }}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[12.5px] font-medium shadow-soft transition-colors duration-300",
              exported
                ? "border-success/30 bg-success/10 text-success"
                : "border-border/70 bg-background/70 text-foreground hover:bg-muted/50"
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {exported ? (
                <motion.span
                  key="done"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 22 }}
                  className="inline-flex items-center gap-2"
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  Saved
                </motion.span>
              ) : (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="inline-flex items-center gap-2"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export PDF
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <p className="text-[26px] font-semibold leading-none tracking-tightest tabular-nums">
            {formatCAD(year.remitted)}
            <span className="text-[15px] font-medium text-muted-foreground">
              {" "}
              of {formatCAD(year.total)} sent
            </span>
          </p>
          {year.outstanding > 0 ? (
            <p className="text-[13px] font-medium text-amber-600 dark:text-amber-400">
              {formatCAD(year.outstanding)} still to send
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-success">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
              All caught up
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted/70">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ delay: 0.35, duration: 0.9, ease }}
            className="h-full rounded-full bg-success"
          />
        </div>

        {/* Expandable split */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-4 flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="text-[12.5px] font-medium text-muted-foreground">
            See where it goes
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-300",
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
              style={{ overflow: "hidden" }}
            >
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[
                  { label: "Federal tax", value: year.federalTax },
                  { label: "Provincial tax", value: year.provincialTax },
                  { label: "CPP · both halves", value: year.cpp },
                  { label: "EI · with employer", value: year.ei },
                ].map((t, i) => (
                  <motion.div
                    key={t.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.3, ease }}
                    className="rounded-2xl border border-border/60 bg-background/50 px-4 py-3"
                  >
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {t.label}
                    </p>
                    <p className="mt-1 text-[15px] font-semibold tabular-nums tracking-tight">
                      {formatCAD(t.value)}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 4 · Year-end records & filings — kept, same sub-view as before
// ─────────────────────────────────────────────────────────────────────────
function YearEndButton({
  onOpen,
  delay = 0,
}: {
  onOpen: () => void;
  delay?: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease }}
      whileTap={{ scale: 0.985 }}
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card/70 p-5 text-left shadow-soft backdrop-blur-xl transition-colors duration-200 hover:bg-muted/30"
    >
      <span className="flex items-center gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-muted transition-transform duration-200 group-hover:scale-105">
          <FileText className="h-[18px] w-[18px] text-foreground/80" />
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold tracking-tight">
            Year-end records &amp; filings
          </span>
          <span className="block text-[12px] text-muted-foreground">
            T4 slips, T4 Summary, T4A, and ROE
          </span>
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
    </motion.button>
  );
}
