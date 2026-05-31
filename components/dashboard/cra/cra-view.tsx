"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Check,
  Clock,
  FileText,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePayrollRuns } from "@/lib/store/payroll";
import { useRemittance } from "@/lib/store/remittance";
import { useEmployees } from "@/lib/store/employees";
import {
  RemittanceService,
  type MonthlyRemittance,
} from "@/lib/services/remittance";
import { cn, formatCAD, formatDate } from "@/lib/utils";
import { TAX_YEAR } from "@/lib/payroll/constants";

const ease = [0.22, 1, 0.36, 1] as const;

export function CRAView() {
  const runs = usePayrollRuns((s) => s.runs);
  const remittedMap = useRemittance((s) => s.remitted);
  const markRemitted = useRemittance((s) => s.markRemitted);
  const unmark = useRemittance((s) => s.unmark);
  const employees = useEmployees((s) => s.employees);

  const service = useMemo(
    () => new RemittanceService(runs, remittedMap),
    [runs, remittedMap]
  );

  const months = useMemo(() => service.getMonthly(), [service]);
  const nextDue = useMemo(() => service.getNextDue(), [service]);

  // Partition: anything not yet remitted = upcoming/current; rest = history
  const upcoming = months.filter((m) => !m.remitted);
  const history = months.filter((m) => m.remitted);

  return (
    <div className="space-y-5">
      {/* ─── This-month banner ─── */}
      {nextDue ? (
        <NextDueCard
          month={nextDue}
          onMark={() => markRemitted(nextDue.monthKey)}
        />
      ) : (
        <NothingDueCard />
      )}

      {/* ─── Upcoming list ─── */}
      {upcoming.length > 1 && (
        <Section title="Upcoming remittances" count={upcoming.length - 1}>
          <ul className="divide-y divide-border/40">
            {upcoming
              .filter((m) => m.monthKey !== nextDue?.monthKey)
              .map((m) => (
                <UpcomingRow
                  key={m.monthKey}
                  month={m}
                  onMark={() => markRemitted(m.monthKey)}
                />
              ))}
          </ul>
        </Section>
      )}

      {/* ─── History list ─── */}
      {history.length > 0 && (
        <Section title="History" count={history.length}>
          <ul className="divide-y divide-border/40">
            {history.map((m) => (
              <HistoryRow
                key={m.monthKey}
                month={m}
                onUnmark={() => unmark(m.monthKey)}
              />
            ))}
          </ul>
        </Section>
      )}

      {/* ─── Year-end T4 section ─── */}
      <Section title={`Year-end · ${TAX_YEAR}`}>
        <div className="space-y-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-muted">
              <FileText className="h-4 w-4 text-foreground/80" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium tracking-tight">
                T4 slips · {TAX_YEAR}
              </p>
              <p className="text-[11.5px] text-muted-foreground">
                {employees.length} employee{employees.length === 1 ? "" : "s"} · download from the Employees tab
              </p>
            </div>
            <Link href="/dashboard/employees">
              <Button variant="outline" size="sm">
                <Users className="h-3.5 w-3.5" />
                Open Employees
              </Button>
            </Link>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Next-due hero card
// ─────────────────────────────────────────────────────────────────────────
function NextDueCard({
  month,
  onMark,
}: {
  month: MonthlyRemittance;
  onMark: () => void;
}) {
  const daysToDue = useMemo(() => {
    const due = new Date(month.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / 86_400_000);
  }, [month.dueDate]);

  const tone =
    daysToDue < 0
      ? "destructive"
      : daysToDue <= 7
      ? "amber"
      : "default";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease }}
      className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-7 shadow-soft backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-rose-200/30 blur-3xl dark:bg-rose-500/10" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-500/10" />

      <div className="relative grid gap-6 sm:grid-cols-[1.4fr_auto] sm:items-end">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Next remittance · for {month.monthLabel}
          </p>
          <p className="mt-3 text-[44px] font-semibold leading-none tracking-tightest tabular-nums">
            {formatCAD(month.total)}
          </p>
          <p
            className={cn(
              "mt-2 text-[13px]",
              tone === "destructive" && "text-destructive font-medium",
              tone === "amber" &&
                "text-amber-600 dark:text-amber-400 font-medium",
              tone === "default" && "text-muted-foreground"
            )}
          >
            Due {formatDate(month.dueDate)}
            {daysToDue < 0
              ? ` · ${Math.abs(daysToDue)} day${
                  Math.abs(daysToDue) === 1 ? "" : "s"
                } late`
              : daysToDue === 0
              ? " · today"
              : ` · in ${daysToDue} day${daysToDue === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="self-center sm:self-end">
          <Button size="lg" onClick={onMark} className="w-full sm:w-auto">
            <Check className="h-4 w-4" />
            Mark as remitted
          </Button>
        </div>
      </div>

      {/* Tiny breakdown strip */}
      <div className="relative mt-7 grid grid-cols-4 divide-x divide-border/60 rounded-2xl border border-border/60 bg-background/40 text-center">
        <Stat label="Federal tax" value={formatCAD(month.federalTax)} />
        <Stat label="Provincial tax" value={formatCAD(month.provincialTax)} />
        <Stat label="CPP (×2)" value={formatCAD(month.cpp)} />
        <Stat label="EI (×2.4)" value={formatCAD(month.ei)} />
      </div>
    </motion.div>
  );
}

function NothingDueCard() {
  return (
    <div className="rounded-3xl border border-success/30 bg-success/10 p-5 text-success">
      <p className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
        <Check className="h-4 w-4" />
        Nothing due to CRA
      </p>
      <p className="mt-1 text-[12.5px] opacity-80">
        Every monthly remittance has been marked as sent.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Section wrapper + rows
// ─────────────────────────────────────────────────────────────────────────
function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span>{title}</span>
        {count !== undefined && <span>· {count}</span>}
      </div>
      {children}
    </div>
  );
}

function UpcomingRow({
  month,
  onMark,
}: {
  month: MonthlyRemittance;
  onMark: () => void;
}) {
  return (
    <li className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-3.5">
      <div className="grid h-9 w-9 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Clock className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium tracking-tight">
          {month.monthLabel} remittance
        </p>
        <p className="text-[11.5px] text-muted-foreground">
          Due {formatDate(month.dueDate)} · {month.runCount} run
          {month.runCount === 1 ? "" : "s"}
        </p>
      </div>
      <p className="text-[13.5px] font-semibold tabular-nums tracking-tight">
        {formatCAD(month.total)}
      </p>
      <Button size="sm" variant="ghost" onClick={onMark}>
        <Check className="h-3.5 w-3.5" />
        Mark
      </Button>
    </li>
  );
}

function HistoryRow({
  month,
  onUnmark,
}: {
  month: MonthlyRemittance;
  onUnmark: () => void;
}) {
  return (
    <li className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-3.5">
      <div className="grid h-9 w-9 place-items-center rounded-2xl bg-success/15 text-success">
        <Check className="h-4 w-4" strokeWidth={3} />
      </div>
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium tracking-tight">
          {month.monthLabel}
        </p>
        <p className="text-[11.5px] text-muted-foreground">
          Remitted {month.remittedAt ? formatDate(month.remittedAt) : ""} ·{" "}
          {month.runCount} run{month.runCount === 1 ? "" : "s"}
        </p>
      </div>
      <p className="text-[13.5px] font-semibold tabular-nums tracking-tight">
        {formatCAD(month.total)}
      </p>
      <Button
        size="sm"
        variant="ghost"
        onClick={onUnmark}
        title="Undo — mark as not remitted"
      >
        Undo
      </Button>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-semibold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}
