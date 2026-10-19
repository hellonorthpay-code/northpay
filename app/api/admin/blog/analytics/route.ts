import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import type { BlogPostAnalytics, TrafficBreakdown } from "@/lib/admin/types";

// ─────────────────────────────────────────────────────────────────────────
// Readership for a single blog post. Owner only.
//
// GET /api/admin/blog/analytics?slug=<slug>
//
// Reads the same first-party page_views table as the Analytics tab — the
// beacon already records every /blog/<slug> view — so there is no second
// tracker to keep in sync. Aggregates only; the table holds no personal data.
// ─────────────────────────────────────────────────────────────────────────

const DAY = 86_400_000;

interface Row {
  created_at: string;
  referrer_host: string | null;
  country: string | null;
  device: string | null;
  visitor_hash: string | null;
}

function tally(
  rows: Row[],
  pick: (r: Row) => string | null,
  limit = 5
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

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const slug = (new URL(request.url).searchParams.get("slug") ?? "").trim();
  if (!slug) return NextResponse.json({ error: "A slug is required." }, { status: 400 });

  const path = `/blog/${slug}`;

  // Page through — Supabase caps a single response at 1,000 rows, and a
  // popular post passes that quickly. Bounded so one post can't run away.
  const rows: Row[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await gate.admin
      .from("page_views")
      .select("created_at, referrer_host, country, device, visitor_hash")
      .in("path", [path, `${path}/`])
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }

  const now = Date.now();
  const within = (days: number) =>
    rows.filter((r) => now - new Date(r.created_at).getTime() <= days * DAY).length;

  // Last 30 days, one bucket per calendar day (UTC), zeros included so the
  // chart's x-axis is honest about quiet days.
  const buckets = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    buckets.set(new Date(now - i * DAY).toISOString().slice(0, 10), 0);
  }
  for (const r of rows) {
    const d = r.created_at.slice(0, 10);
    if (buckets.has(d)) buckets.set(d, (buckets.get(d) ?? 0) + 1);
  }

  const result: BlogPostAnalytics = {
    slug,
    views: rows.length,
    readers: new Set(rows.map((r) => r.visitor_hash).filter(Boolean)).size,
    views7d: within(7),
    views30d: within(30),
    firstViewAt: rows[0]?.created_at ?? null,
    lastViewAt: rows[rows.length - 1]?.created_at ?? null,
    daily: [...buckets.entries()].map(([date, views]) => ({ date, views })),
    countries: tally(rows, (r) => r.country).map((c) => ({
      ...c,
      code: c.label,
      label: countryName(c.label),
    })),
    devices: tally(rows, (r) => r.device),
    // No referrer = typed the address, a bookmark, an app, or internal nav.
    referrers: tally(rows, (r) => r.referrer_host ?? "Direct"),
  };

  return NextResponse.json(result);
}
