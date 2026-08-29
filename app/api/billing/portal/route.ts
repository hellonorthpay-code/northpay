import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  billingConfigured,
  checkCustomer,
  createPortalSession,
} from "@/lib/billing/stripe";

/**
 * Open Stripe's hosted billing portal so the employer can update their card
 * or cancel. Returns { url } to redirect to.
 */
export async function POST(request: Request) {
  if (!billingConfigured()) {
    return NextResponse.json({ error: "Billing not configured." }, { status: 503 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anonKey || !secretKey) {
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
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
    .select("stripe_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "No customer on file." }, { status: 400 });
  }

  const origin =
    request.headers.get("origin") ||
    new URL(request.url).origin ||
    "https://thenorthpay.com";

  // A customer from another Stripe mode can't open a portal session. Say so
  // in plain language rather than surfacing Stripe's raw "No such customer".
  if ((await checkCustomer(sub.stripe_customer_id)) === "missing") {
    return NextResponse.json(
      { error: "No billing history on this account yet. Subscribe to get started." },
      { status: 400 }
    );
  }

  try {
    const portalUrl = await createPortalSession({
      customerId: sub.stripe_customer_id,
      returnUrl: `${origin}/dashboard/settings`,
    });
    return NextResponse.json({ url: portalUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
