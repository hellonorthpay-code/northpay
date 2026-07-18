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
    return NextResponse.json({ configured: false, entitled: true, status: "active" });
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
      hasCustomer,
    });
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
      hasCustomer,
    });
  }

  return NextResponse.json({
    configured: true,
    entitled: false,
    status: "expired",
    hasCustomer,
  });
}
