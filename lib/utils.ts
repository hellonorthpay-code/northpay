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

/**
 * Generate a v4 UUID. We persist IDs into Postgres columns typed as
 * `uuid` (e.g. payroll_runs.id) — the previous base36 string would
 * crash the insert with "invalid input syntax for type uuid (22P02)".
 *
 * Uses the browser-native crypto.randomUUID when available (all modern
 * browsers + Node ≥ 19), with a safe RFC4122-compliant fallback for
 * older runtimes / SSR.
 */
export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 fallback
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
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
  semiannually: 182,
  annually: 365,
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
