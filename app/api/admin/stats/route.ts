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
      };
    });

  // ── Platform usage (admin client bypasses RLS) ──
  const [{ count: empCount }, { count: runCount }] = await Promise.all([
    admin.from("employees").select("*", { count: "exact", head: true }),
    admin.from("payroll_runs").select("*", { count: "exact", head: true }),
  ]);

  const stats: AdminStats = {
    totalUsers: collected.length,
    activeUsers,
    newUsers7,
    newUsers30,
    totalEmployees: empCount ?? 0,
    totalPayrollRuns: runCount ?? 0,
    users,
  };

  return NextResponse.json(stats);
}
