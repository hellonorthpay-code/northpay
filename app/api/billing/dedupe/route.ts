import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────
// Duplicate-subscription cleanup — protected by CRON_SECRET.
//
//   GET /api/billing/dedupe?secret=<CRON_SECRET>          → dry run (reports)
//   GET /api/billing/dedupe?secret=<CRON_SECRET>&apply=1  → cancels extras
//
// Keeps the OLDEST live subscription per customer (the one the member
// actually intended) and cancels the rest immediately. Stripe lets the same
// customer subscribe repeatedly, so before the checkout guard existed a
// double-tap could stack charges. Dry run by default — nothing is cancelled
// unless apply=1 is passed.
// ─────────────────────────────────────────────────────────────────────────

const STRIPE = "https://api.stripe.com/v1";
const LIVE = ["active", "trialing", "past_due"];

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) {
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }
  const params = new URL(request.url).searchParams;
  if (params.get("secret") !== secret) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const apply = params.get("apply") === "1";

  const headers = { Authorization: `Bearer ${key}` };

  const res = await fetch(`${STRIPE}/subscriptions?status=all&limit=100`, {
    headers,
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: "Could not list subscriptions." },
      { status: 502 }
    );
  }
  interface Sub {
    id: string;
    customer: string;
    status: string;
    created: number;
    cancel_at_period_end?: boolean;
  }
  const json = (await res.json()) as { data?: Sub[] };

  // Group live subscriptions by customer.
  const byCustomer = new Map<string, Sub[]>();
  for (const s of json.data ?? []) {
    if (!LIVE.includes(s.status)) continue;
    const list = byCustomer.get(s.customer) ?? [];
    list.push(s);
    byCustomer.set(s.customer, list);
  }

  const kept: string[] = [];
  const cancelled: string[] = [];
  const wouldCancel: string[] = [];

  for (const [, subs] of byCustomer) {
    if (subs.length < 2) {
      if (subs[0]) kept.push(subs[0].id);
      continue;
    }
    // Oldest first — keep that one, cancel the rest.
    subs.sort((a, b) => a.created - b.created);
    kept.push(subs[0].id);
    for (const extra of subs.slice(1)) {
      if (!apply) {
        wouldCancel.push(extra.id);
        continue;
      }
      const del = await fetch(`${STRIPE}/subscriptions/${extra.id}`, {
        method: "DELETE",
        headers,
      });
      if (del.ok) cancelled.push(extra.id);
    }
  }

  return NextResponse.json({
    mode: apply ? "applied" : "dry-run",
    customers: byCustomer.size,
    kept,
    cancelled,
    wouldCancel,
  });
}
