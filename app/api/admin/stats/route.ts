import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin/guard";
import type { AdminStats, AdminUserRow } from "@/lib/admin/types";

const DAY = 86_400_000;

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { admin } = gate;

  // ── Pull all auth users (paginated; cap at 10k to stay bounded) ──
  const perPage = 1000;
  const collected: User[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    collected.push(...data.users);
    if (data.users.length < perPage) break;
  }

  const now = Date.now();
  let activeUsers = 0;
  let newUsers7 = 0;
  let newUsers30 = 0;

  for (const u of collected) {
    const created = u.created_at ? new Date(u.created_at).getTime() : 0;
    const lastSignIn = u.last_sign_in_at
      ? new Date(u.last_sign_in_at).getTime()
      : 0;
    if (lastSignIn && now - lastSignIn <= 30 * DAY) activeUsers++;
    if (created && now - created <= 7 * DAY) newUsers7++;
    if (created && now - created <= 30 * DAY) newUsers30++;
  }

  // ── Per-user usage: tally employees + payroll runs by owner_id ──
  // Pull just the owner column (and run timestamps) in pages so the counts
  // stay accurate past Supabase's default 1000-row response cap.
  async function gatherRows(
    table: string,
    columns: string
  ): Promise<Array<{ owner_id: string; created_at?: string }>> {
    const out: Array<{ owner_id: string; created_at?: string }> = [];
    for (let from = 0; from < 50_000; from += 1000) {
      const { data, error } = await admin
        .from(table)
        .select(columns)
        .range(from, from + 999);
      if (error || !data) break;
      out.push(...(data as unknown as Array<{ owner_id: string; created_at?: string }>));
      if (data.length < 1000) break;
    }
    return out;
  }

  const [empRows, runRows] = await Promise.all([
    gatherRows("employees", "owner_id"),
    gatherRows("payroll_runs", "owner_id, created_at"),
  ]);

  const empByOwner = new Map<string, number>();
  for (const r of empRows) {
    if (r.owner_id) empByOwner.set(r.owner_id, (empByOwner.get(r.owner_id) ?? 0) + 1);
  }
  const runByOwner = new Map<string, number>();
  const lastRunByOwner = new Map<string, string>();
  for (const r of runRows) {
    if (!r.owner_id) continue;
    runByOwner.set(r.owner_id, (runByOwner.get(r.owner_id) ?? 0) + 1);
    if (r.created_at) {
      const prev = lastRunByOwner.get(r.owner_id);
      if (!prev || new Date(r.created_at) > new Date(prev)) {
        lastRunByOwner.set(r.owner_id, r.created_at);
      }
    }
  }

  // Most-recent signups first, capped to a readable table.
  const users: AdminUserRow[] = [...collected]
    .sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime()
    )
    .slice(0, 100)
    .map((u) => {
      const meta = (u.user_metadata ?? {}) as Record<string, string>;
      const name =
        [meta.first_name ?? meta.firstName, meta.last_name ?? meta.lastName]
          .filter(Boolean)
          .join(" ") || "—";
      const bannedUntil = (u as { banned_until?: string }).banned_until;
      return {
        id: u.id,
        email: u.email ?? "—",
        name,
        createdAt: u.created_at ?? "",
        lastSignInAt: u.last_sign_in_at ?? null,
        provider: u.app_metadata?.provider ?? "email",
        suspended: !!bannedUntil && new Date(bannedUntil).getTime() > now,
        employeeCount: empByOwner.get(u.id) ?? 0,
        payrollRunCount: runByOwner.get(u.id) ?? 0,
        lastRunAt: lastRunByOwner.get(u.id) ?? null,
      };
    });

  // ── Platform totals (exact counts, independent of the row cap above) ──
  const [{ count: empCount }, { count: runCount }] = await Promise.all([
    admin.from("employees").select("*", { count: "exact", head: true }),
    admin.from("payroll_runs").select("*", { count: "exact", head: true }),
  ]);

  // ── Analytics ──
  // Built from rows already in memory, so the extra tab costs no extra
  // queries. Series are zero-filled across every day in the window: a gap
  // must read as "nothing happened", not as a missing point.
  const DAYS = 30;
  const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);
  const emptySeries = () => {
    const out = new Map<string, number>();
    for (let i = DAYS - 1; i >= 0; i--) out.set(dayKey(now - i * DAY), 0);
    return out;
  };

  const signupSeries = emptySeries();
  for (const u of collected) {
    if (!u.created_at) continue;
    const k = dayKey(new Date(u.created_at).getTime());
    if (signupSeries.has(k)) signupSeries.set(k, signupSeries.get(k)! + 1);
  }

  const runSeries = emptySeries();
  let runs30 = 0;
  for (const r of runRows) {
    if (!r.created_at) continue;
    const t = new Date(r.created_at).getTime();
    const k = dayKey(t);
    if (runSeries.has(k)) {
      runSeries.set(k, runSeries.get(k)! + 1);
      runs30++;
    }
  }

  const toPoints = (m: Map<string, number>) =>
    [...m.entries()].map(([date, value]) => ({ date, value }));

  const employersWithEmployees = empByOwner.size;
  const totalEmployeesCounted = [...empByOwner.values()].reduce((a, b) => a + b, 0);

  const stats: AdminStats = {
    totalUsers: collected.length,
    activeUsers,
    newUsers7,
    newUsers30,
    totalEmployees: empCount ?? 0,
    totalPayrollRuns: runCount ?? 0,
    users,
    analytics: {
      signups: toPoints(signupSeries),
      runs: toPoints(runSeries),
      activatedUsers: runByOwner.size,
      onboardedUsers: employersWithEmployees,
      runs30,
      avgEmployees: employersWithEmployees
        ? Math.round((totalEmployeesCounted / employersWithEmployees) * 10) / 10
        : 0,
    },
  };

  return NextResponse.json(stats);
}
