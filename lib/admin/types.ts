// Shared admin DTOs — imported by both the server route and the client so the
// server-only guard code is never pulled into the browser bundle.

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSignInAt: string | null;
  provider: string;
  suspended: boolean;
  /** How many employees this user has added. */
  employeeCount: number;
  /** How many payroll runs this user has created. */
  payrollRunCount: number;
  /** ISO timestamp of their most recent payroll run, or null. */
  lastRunAt: string | null;
}

/** One day in a trend series. `date` is ISO yyyy-mm-dd. */
export interface AdminDayPoint {
  date: string;
  value: number;
}

export interface AdminAnalytics {
  /** Signups per day, oldest → newest, last 30 days (zero-filled). */
  signups: AdminDayPoint[];
  /** Payroll runs per day, oldest → newest, last 30 days (zero-filled). */
  runs: AdminDayPoint[];
  /** Employers who have run payroll at least once. */
  activatedUsers: number;
  /** Employers who have added at least one employee. */
  onboardedUsers: number;
  /** Payroll runs in the last 30 days. */
  runs30: number;
  /** Mean employees across employers who have added any. */
  avgEmployees: number;
}

export interface AdminStats {
  totalUsers: number;
  /** Signed in within the last 30 days. */
  activeUsers: number;
  newUsers7: number;
  newUsers30: number;
  totalEmployees: number;
  totalPayrollRuns: number;
  users: AdminUserRow[];
  analytics: AdminAnalytics;
}

// ─── Stripe (live transactions), admin-only ───

export interface AdminStripeTx {
  id: string;
  /** ISO yyyy-mm-dd. */
  date: string;
  /** Major units (dollars), already divided by 100. */
  amount: number;
  currency: string;
  /** succeeded | failed | pending */
  status: string;
  refunded: boolean;
  email: string | null;
  description: string | null;
  receiptUrl: string | null;
}

export interface AdminStripeSummary {
  /** False when Stripe isn't configured — the UI shows a calm empty state. */
  configured: boolean;
  /** Sum of succeeded charges, minus refunds. */
  netVolume: number;
  grossVolume: number;
  refundedTotal: number;
  currency: string;
  activeSubscriptions: number;
  /** Monthly recurring revenue from active subscriptions. */
  mrr: number;
  transactions: AdminStripeTx[];
}
