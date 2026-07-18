import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  billingConfigured,
  createCheckoutSession,
  findOrCreateCustomer,
} from "@/lib/billing/stripe";

/**
 * Start a Stripe Checkout for the signed-in employer's monthly subscription.
 * Returns { url } to redirect to. Stripe hosts the card form (no PCI burden).
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
  if (error || !user || !user.email) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const origin =
    request.headers.get("origin") ||
    new URL(request.url).origin ||
    "https://thenorthpay.com";

  try {
    const admin = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Reuse a stored customer if we have one, else find/create in Stripe.
    const { data: existing } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("owner_id", user.id)
      .maybeSingle();

    const customerId =
      existing?.stripe_customer_id ||
      (await findOrCreateCustomer(user.email, user.id));

    // Ensure a row exists so the webhook can match by customer id later.
    await admin.from("subscriptions").upsert(
      { owner_id: user.id, stripe_customer_id: customerId, updated_at: new Date().toISOString() },
      { onConflict: "owner_id" }
    );

    const checkoutUrl = await createCheckoutSession({
      customerId,
      userId: user.id,
      successUrl: `${origin}/dashboard/settings?billing=success`,
      cancelUrl: `${origin}/dashboard/settings?billing=cancelled`,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
