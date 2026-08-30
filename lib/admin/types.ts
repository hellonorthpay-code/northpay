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

export interface AdminStats {
  totalUsers: number;
  /** Signed in within the last 30 days. */
  activeUsers: number;
  newUsers7: number;
  newUsers30: number;
  totalEmployees: number;
  totalPayrollRuns: number;
  users: AdminUserRow[];
}

// ─── Website audience ───

export interface TrafficBreakdown {
  label: string;
  value: number;
  /** Percent of the total for this dimension, for the inline bar. */
  share: number;
  /** Country rows only. */
  flag?: string;
  code?: string;
}

export interface TrafficDayPoint {
  date: string;
  /** Pageviews that day. */
  value: number;
  /** Distinct visitors that day. */
  visitors: number;
}

export interface AdminTraffic {
  /** False when the page_views migration hasn't been run yet. */
  ready: boolean;
  message?: string;
  days: number;
  pageviews: number;
  visitors: number;
  viewsPerVisitor: number;
  series: TrafficDayPoint[];
  countries: TrafficBreakdown[];
  cities: TrafficBreakdown[];
  referrers: TrafficBreakdown[];
  pages: TrafficBreakdown[];
  devices: TrafficBreakdown[];
  browsers: TrafficBreakdown[];
  systems: TrafficBreakdown[];
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
