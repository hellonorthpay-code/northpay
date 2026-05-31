import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCAD(n: number) {
  return CAD.format(n);
}

export function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────
// Next-pay helpers (used by the Employees spreadsheet)
// ─────────────────────────────────────────────────────────────────────────

/** Approximate day offset for the next pay date, by frequency. */
const PAY_FREQ_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  semimonthly: 15,
  monthly: 30,
};

/**
 * Compute the next pay date by adding the frequency offset to the latest
 * paystub's period end. Returns null when there is no paystub history —
 * the UI should render "Awaiting first run".
 */
export function computeNextPay(
  lastPeriodEnd: string | undefined,
  frequency: string
): Date | null {
  if (!lastPeriodEnd) return null;
  const offset = PAY_FREQ_DAYS[frequency] ?? 14;
  const d = new Date(lastPeriodEnd);
  d.setDate(d.getDate() + offset);
  return d;
}

export type RelativeTone = "muted" | "today" | "late";
export interface RelativeFromToday {
  text: string;
  tone: RelativeTone;
}

/**
 * Express a target date relative to today.
 *   diff = 0       → "today"          (tone: today, amber/bold)
 *   diff > 0       → "in N days"      (tone: muted)
 *   diff < 0       → "N days late"    (tone: late, red)
 */
export function relativeFromToday(date: Date): RelativeFromToday {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000
  );

  if (diffDays === 0) return { text: "today", tone: "today" };
  if (diffDays > 0) {
    return {
      text: `in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      tone: "muted",
    };
  }
  const late = Math.abs(diffDays);
  return {
    text: `${late} day${late === 1 ? "" : "s"} late`,
    tone: "late",
  };
}
