import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import type { AdminTraffic, TrafficBreakdown } from "@/lib/admin/types";

// ─────────────────────────────────────────────────────────────────────────
// Website audience: who visits, where from, on what.
//
// Reads the first-party page_views table. Everything is aggregate — the
// table holds no personal data to begin with (see 0004_page_views.sql).
// ─────────────────────────────────────────────────────────────────────────

const DAY = 86_400_000;

interface Row {
  created_at: string;
  path: string;
  referrer_host: string | null;
  country: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  visitor_hash: string | null;
}

/** Count by key, sorted desc, top N, with share-of-total for the inline bars. */
function tally(
  rows: Row[],
  pick: (r: Row) => string | null,
  limit = 8
): TrafficBreakdown[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    const k = pick(r);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    total++;
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({
      label,
      value,
      share: total ? Math.round((value / total) * 1000) / 10 : 0,
    }));
}

/** ISO-2 → readable country name, via the platform's own data. */
function countryName(code: string): string {
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}

/** ISO-2 → flag emoji (regional indicator pair). */
function flag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))
  );
}

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { admin } = gate;

  const days = Math.min(
    365,
    Math.max(1, Number(new URL(request.url).searchParams.get("days") ?? 30))
  );
  const since = new Date(Date.now() - days * DAY).toISOString();

  // Page through so counts stay right past Supabase's 1000-row response cap.
  const rows: Row[] = [];
  for (let from = 0; from < 100_000; from += 1000) {
    const { data, error } = await admin
      .from("page_views")
      .select(
        "created_at, path, referrer_host, country, city, device, browser, os, visitor_hash"
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) {
      // The table may not exist yet (migration not run) — report that plainly
      // instead of failing the whole admin page.
      return NextResponse.json({
        ready: false,
        message: error.message,
      } satisfies Partial<AdminTraffic>);
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as Row[]));
    if (data.length < 1000) break;
  }

  // ── Daily series, zero-filled: an empty day is a fact, not a gap ──
  const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);
  const viewsByDay = new Map<string, number>();
  const visitorsByDay = new Map<string, Set<string>>();
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(Date.now() - i * DAY);
    viewsByDay.set(k, 0);
    visitorsByDay.set(k, new Set());
  }

  const uniqueVisitors = new Set<string>();
  for (const r of rows) {
    const k = dayKey(new Date(r.created_at).getTime());
    if (viewsByDay.has(k)) viewsByDay.set(k, viewsByDay.get(k)! + 1);
    if (r.visitor_hash) {
      uniqueVisitors.add(r.visitor_hash);
      visitorsByDay.get(k)?.add(r.visitor_hash);
    }
  }

  const countries = tally(rows, (r) => r.country, 10).map((c) => ({
    ...c,
    label: countryName(c.label),
    flag: flag(c.label),
    code: c.label,
  }));

  const traffic: AdminTraffic = {
    ready: true,
    days,
    pageviews: rows.length,
    visitors: uniqueVisitors.size,
    viewsPerVisitor: uniqueVisitors.size
      ? Math.round((rows.length / uniqueVisitors.size) * 10) / 10
      : 0,
    series: [...viewsByDay.entries()].map(([date, value]) => ({
      date,
      value,
      visitors: visitorsByDay.get(date)?.size ?? 0,
    })),
    countries,
    cities: tally(rows, (r) => r.city, 8),
    referrers: tally(rows, (r) => r.referrer_host, 8),
    pages: tally(rows, (r) => r.path, 8),
    devices: tally(rows, (r) => r.device, 4),
    browsers: tally(rows, (r) => r.browser, 6),
    systems: tally(rows, (r) => r.os, 6),
  };

  return NextResponse.json(traffic);
}
