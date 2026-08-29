import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  billingConfigured,
  checkCustomer,
  createCheckoutSession,
  findOrCreateCustomer,
  findPromotionCode,
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

  // Optional promo code the customer applied in-app.
  let promoCode = "";
  try {
    const body = (await request.json()) as { promoCode?: string };
    promoCode = (body?.promoCode ?? "").trim();
  } catch {
    // No body is fine — checkout without a pre-applied discount.
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

    // A stored customer id is only usable if it still resolves in the current
    // Stripe mode. Test-mode ids survive the switch to live keys and then fail
    // checkout with "No such customer", so verify before trusting it. Only an
    // explicit "missing" discards it — a transient error keeps the id, since
    // minting a duplicate customer is worse than a retryable failure.
    let customerId = existing?.stripe_customer_id ?? null;
    if (customerId && (await checkCustomer(customerId)) === "missing") {
      customerId = null;
    }
    const staleCleared = !!existing?.stripe_customer_id && !customerId;
    if (!customerId) {
      customerId = await findOrCreateCustomer(user.email, user.id);
    }

    // ── Never let one account stack subscriptions ──
    // Stripe will happily create a second (and third) subscription for the
    // same customer, so a double-tap or a stale tab means a real customer
    // silently pays twice. Check Stripe itself — not just our row, which can
    // lag if a webhook was missed — and send them to manage instead.
    const existingSubs = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(
        customerId
      )}&status=all&limit=10`,
      { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } }
    );
    if (existingSubs.ok) {
      const json = (await existingSubs.json()) as {
        data?: Array<{ status: string }>;
      };
      const alreadyPaying = (json.data ?? []).some((s) =>
        ["active", "trialing", "past_due"].includes(s.status)
      );
      if (alreadyPaying) {
        return NextResponse.json(
          {
            error:
              "You already have an active subscription. Use Manage billing to update or cancel it.",
            alreadySubscribed: true,
          },
          { status: 409 }
        );
      }
    }

    // Ensure a row exists so the webhook can match by customer id later.
    await admin.from("subscriptions").upsert(
      {
        owner_id: user.id,
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
        // When we replaced a dead customer, the subscription fields beside it
        // describe a subscription in the old mode. Drop them so nothing reads
        // back an "active" plan that no longer exists.
        ...(staleCleared
          ? { stripe_subscription_id: null, status: null, current_period_end: null }
          : {}),
      },
      { onConflict: "owner_id" }
    );

    // Resolve the code server-side; an invalid one is ignored rather than
    // blocking checkout, and Stripe's own promo box still appears.
    let promotionCodeId: string | null = null;
    if (promoCode) {
      const promo = await findPromotionCode(promoCode);
      promotionCodeId = promo?.id ?? null;
    }

    const checkoutUrl = await createCheckoutSession({
      customerId,
      userId: user.id,
      promotionCodeId,
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
