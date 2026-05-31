import type { PayrollRun } from "@/lib/payroll/types";
import { round2 } from "@/lib/utils";

/**
 * PD7A remittance — what the employer owes CRA each month for payroll
 * deductions on runs paid during that month.
 *
 * The remittance consists of:
 *   • Federal income tax + provincial income tax (Box 22 on T4s)
 *   • CPP — BOTH employee and employer contributions (×2 of the deducted)
 *     (plus CPP2 both sides)
 *   • EI — BOTH employee and employer premiums (employer = 1.4× employee)
 *
 * Due date: 15th of the month FOLLOWING the pay date.
 * (Threshold-1 remitters; quarterly/accelerated remitters use different
 * schedules — out of scope for this prototype.)
 */
export interface MonthlyRemittance {
  /** "2026-04" — the calendar month the pay-dates fall in. */
  monthKey: string;
  /** "April 2026" — human label */
  monthLabel: string;
  /** ISO date of the 1st of the month */
  monthStart: string;
  /** ISO date the remittance is due (15th of the following month). */
  dueDate: string;

  // ── Component totals ──
  /** Federal income tax withheld from all employees in this month. */
  federalTax: number;
  /** Provincial income tax withheld. */
  provincialTax: number;
  /** CPP1 + CPP2 employee + employer combined. */
  cpp: number;
  /** EI employee + employer combined. */
  ei: number;
  /** Total owed to CRA. */
  total: number;

  /** Convenience — how many payroll runs landed in this month. */
  runCount: number;

  // ── Operator-marked status (from RemittanceStore) ──
  remitted: boolean;
  /** ISO timestamp when the operator marked it remitted. */
  remittedAt?: string;
}

export class RemittanceService {
  constructor(
    private readonly runs: PayrollRun[],
    /** monthKey → ISO timestamp when remitted (or undefined if not). */
    private readonly remittedMap: Record<string, string>
  ) {}

  /**
   * Fold finalized runs into monthly remittance buckets, plus generate
   * upcoming-month placeholders for the next 2 months even if no runs
   * have landed yet (so the calendar of due dates is always visible).
   */
  getMonthly(): MonthlyRemittance[] {
    const byMonth = new Map<
      string,
      {
        federalTax: number;
        provincialTax: number;
        cpp: number;
        ei: number;
        runCount: number;
      }
    >();

    for (const run of this.runs) {
      if (run.status !== "finalized") continue;
      const monthKey = run.payDate.slice(0, 7); // "YYYY-MM"
      const acc = byMonth.get(monthKey) ?? {
        federalTax: 0,
        provincialTax: 0,
        cpp: 0,
        ei: 0,
        runCount: 0,
      };
      for (const line of run.lines) {
        acc.federalTax += line.federalTax;
        acc.provincialTax += line.provincialTax;
        acc.cpp +=
          line.cppEmployee +
          line.cppEmployer +
          line.cpp2Employee +
          line.cpp2Employer;
        acc.ei += line.eiEmployee + line.eiEmployer;
      }
      acc.runCount += 1;
      byMonth.set(monthKey, acc);
    }

    const months: MonthlyRemittance[] = Array.from(byMonth.entries()).map(
      ([monthKey, acc]) => {
        const total = round2(
          acc.federalTax + acc.provincialTax + acc.cpp + acc.ei
        );
        const remittedAt = this.remittedMap[monthKey];
        return {
          monthKey,
          monthLabel: monthLabelFor(monthKey),
          monthStart: `${monthKey}-01`,
          dueDate: dueDateFor(monthKey),
          federalTax: round2(acc.federalTax),
          provincialTax: round2(acc.provincialTax),
          cpp: round2(acc.cpp),
          ei: round2(acc.ei),
          total,
          runCount: acc.runCount,
          remitted: !!remittedAt,
          remittedAt,
        };
      }
    );

    return months.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }

  /** Convenience — the month containing today's date. */
  getCurrentMonth(): MonthlyRemittance | null {
    const todayKey = new Date().toISOString().slice(0, 7);
    return this.getMonthly().find((m) => m.monthKey === todayKey) ?? null;
  }

  /**
   * "Next remittance due" — the earliest month whose due-date is in the
   * future and which isn't already marked remitted. Surfaces the obligation
   * the operator actually needs to act on.
   */
  getNextDue(): MonthlyRemittance | null {
    const today = new Date().toISOString().slice(0, 10);
    return (
      this.getMonthly()
        .filter((m) => !m.remitted && m.dueDate >= today && m.total > 0)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null
    );
  }
}

// ───────────────────────── helpers ─────────────────────────
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthLabelFor(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Due date: the 15th of the month following monthKey. */
function dueDateFor(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-15`;
}
