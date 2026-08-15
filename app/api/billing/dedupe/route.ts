import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────
// Duplicate-subscription cleanup — protected by CRON_SECRET.
//
//   GET ?secret=…                 → dry run (reports, cancels nothing)
//   GET ?secret=…&apply=1         → cancel duplicates, keep the oldest
//   GET ?secret=…&apply=1&all=1   → cancel EVERY live subscription (clean slate)
//
// Stripe lets the same customer subscribe repeatedly, so before the checkout
// guard existed a double-tap could stack charges. Default behaviour keeps the
// OLDEST live subscription per customer and cancels the rest; `all=1` wipes
// them for a from-scratch test. Dry run unless apply=1 — nothing is cancelled
// by accident.
//
// Cancelled rows are also reset in Supabase so a stale "active" record can't
// keep reporting entitlement after the subscription is gone.
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
  const cancelAll = params.get("all") === "1";

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

  const touchedCustomers = new Set<string>();

  for (const [customer, subs] of byCustomer) {
    // Oldest first. `all` cancels everything; otherwise keep the first.
    subs.sort((a, b) => a.created - b.created);
    const doomed = cancelAll ? subs : subs.slice(1);
    if (!cancelAll && subs[0]) kept.push(subs[0].id);

    for (const extra of doomed) {
      if (!apply) {
        wouldCancel.push(extra.id);
        continue;
      }
      const del = await fetch(`${STRIPE}/subscriptions/${extra.id}`, {
        method: "DELETE",
        headers,
      });
      if (del.ok) {
        cancelled.push(extra.id);
        touchedCustomers.add(customer);
      }
    }
  }

  // Clear local entitlement for customers left with no live subscription, so
  // a stale "active" row can't keep granting access after cancellation.
  let rowsReset = 0;
  if (apply && cancelAll && touchedCustomers.size > 0) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
    if (url && supabaseSecret) {
      const admin = createClient(url, supabaseSecret, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      for (const customer of touchedCustomers) {
        const { error, count } = await admin
          .from("subscriptions")
          .update(
            {
              status: "canceled",
              current_period_end: null,
              updated_at: new Date().toISOString(),
            },
            { count: "exact" }
          )
          .eq("stripe_customer_id", customer);
        if (!error) rowsReset += count ?? 0;
      }
    }
  }

  return NextResponse.json({
    mode: apply ? (cancelAll ? "applied:all" : "applied:duplicates") : "dry-run",
    customers: byCustomer.size,
    kept,
    cancelled,
    wouldCancel,
    rowsReset,
  });
}
