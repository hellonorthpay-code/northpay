import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { billingConfigured } from "@/lib/billing/stripe";

const TRIAL_DAYS = 14;
const DAY_MS = 86_400_000;

/**
 * Current employer's entitlement:
 *   { configured, entitled, status, trialDaysLeft?, hasCustomer }
 *
 * status: "active" (paid) | "trial" | "expired". When billing isn't set up
 * yet (no STRIPE_SECRET_KEY) we return entitled:true so nothing is locked.
 */
export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anonKey || !secretKey) {
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  if (!billingConfigured()) {
    return NextResponse.json({
      configured: false,
      entitled: true,
      status: "active",
      pilot: false,
    });
  }

  const token = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const anon = createClient(url, anonKey);
  const {
    data: { user },
    error,
  } = await anon.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  // Pilot gating: while BILLING_TEST_EMAILS is set, ONLY those accounts are
  // subject to the trial/paywall. Everyone else is treated as fully entitled
  // so real users aren't affected during testing. Clear the env var to roll
  // billing out to all accounts.
  const testList = (process.env.BILLING_TEST_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const email = (user.email ?? "").toLowerCase();
  if (testList.length > 0 && !testList.includes(email)) {
    // Not in the pilot — fully entitled AND sees no billing UI at all.
    return NextResponse.json({
      configured: true,
      entitled: true,
      status: "active",
      pilot: false,
    });
  }

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sub } = await admin
    .from("subscriptions")
    .select("status, current_period_end, stripe_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();

  const now = Date.now();
  const hasCustomer = !!sub?.stripe_customer_id;

  // Paid & current?
  const paidStatuses = ["active", "trialing", "past_due"];
  const periodOk =
    !sub?.current_period_end ||
    new Date(sub.current_period_end).getTime() > now;
  if (sub && paidStatuses.includes(sub.status) && periodOk) {
    return NextResponse.json({
      configured: true,
      entitled: true,
      status: "active",
      pilot: true,
      hasCustomer,
    });
  }

  // ── Self-heal: ask Stripe directly before declaring the trial over ──
  //
  // Webhooks can fail (wrong URL, redirect, outage, signature drift). If that
  // happens we must NOT lock out someone who has actually paid, so when the
  // local row isn't active we reconcile against Stripe as the source of
  // truth — and write the result back so later reads are fast.
  if (sub?.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const res = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(
          sub.stripe_customer_id
        )}&status=all&limit=10`,
        { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } }
      );
      if (res.ok) {
        const json = (await res.json()) as {
          data?: Array<{
            id: string;
            status: string;
            current_period_end?: number;
          }>;
        };
        const live = (json.data ?? []).find((s) =>
          paidStatuses.includes(s.status)
        );
        if (live) {
          const periodEnd = live.current_period_end
            ? new Date(live.current_period_end * 1000).toISOString()
            : null;
          await admin
            .from("subscriptions")
            .update({
              stripe_subscription_id: live.id,
              status: live.status,
              current_period_end: periodEnd,
              updated_at: new Date().toISOString(),
            })
            .eq("owner_id", user.id);

          return NextResponse.json({
            configured: true,
            entitled: true,
            status: "active",
            pilot: true,
            hasCustomer,
            reconciled: true,
          });
        }
      }
    } catch {
      // Non-fatal: fall through to trial/expired below.
    }
  }

  // Free trial — time-based from signup, no card.
  const created = user.created_at ? new Date(user.created_at).getTime() : now;
  const trialEnds = created + TRIAL_DAYS * DAY_MS;
  if (now < trialEnds) {
    return NextResponse.json({
      configured: true,
      entitled: true,
      status: "trial",
      trialDaysLeft: Math.max(1, Math.ceil((trialEnds - now) / DAY_MS)),
      pilot: true,
      hasCustomer,
    });
  }

  return NextResponse.json({
    configured: true,
    entitled: false,
    status: "expired",
    pilot: true,
    hasCustomer,
  });
}
