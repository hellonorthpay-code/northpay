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
