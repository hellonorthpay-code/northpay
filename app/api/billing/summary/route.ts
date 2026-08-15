import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { subPeriodEndISO, subIsEnding, type StripeSubShape } from "@/lib/billing/stripe";

// ─────────────────────────────────────────────────────────────────────────
// Real billing summary for the signed-in employer.
//
// Everything here comes from Stripe — card brand/last4, the actual renewal
// date, whether it's set to cancel, and real invoices with real PDF links.
// Nothing is invented; if a value is unknown it comes back null and the UI
// omits the row rather than showing a plausible-looking placeholder.
// ─────────────────────────────────────────────────────────────────────────

const STRIPE = "https://api.stripe.com/v1";

async function stripeGet(path: string) {
  const res = await fetch(`${STRIPE}${path}`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anonKey || !secretKey || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ configured: false });
  }

  const token = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token)
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const anon = createClient(url, anonKey);
  const {
    data: { user },
    error,
  } = await anon.auth.getUser(token);
  if (error || !user)
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: row } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();

  const customerId = row?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ configured: true, hasCustomer: false });
  }

  // ── Subscription (renewal date, cancel-at-period-end, default card) ──
  const subs = (await stripeGet(
    `/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=10&expand[]=data.default_payment_method`
  )) as {
    data?: Array<{
      id: string;
      status: string;
      current_period_end?: number;
      cancel_at_period_end?: boolean;
      default_payment_method?: {
        card?: { brand?: string; last4?: string };
      } | null;
    }>;
  } | null;

  const sub = (subs?.data ?? []).find((s) =>
    ["active", "trialing", "past_due"].includes(s.status)
  );

  // Card: prefer the subscription's own method, else the customer default.
  let card: { brand: string; last4: string } | null = null;
  if (sub?.default_payment_method?.card?.last4) {
    card = {
      brand: sub.default_payment_method.card.brand ?? "Card",
      last4: sub.default_payment_method.card.last4,
    };
  } else {
    const cust = (await stripeGet(
      `/customers/${encodeURIComponent(customerId)}?expand[]=invoice_settings.default_payment_method`
    )) as {
      invoice_settings?: {
        default_payment_method?: { card?: { brand?: string; last4?: string } };
      };
    } | null;
    const c = cust?.invoice_settings?.default_payment_method?.card;
    if (c?.last4) card = { brand: c.brand ?? "Card", last4: c.last4 };
  }

  // ── Invoices (real amounts, real PDFs) ──
  const inv = (await stripeGet(
    `/invoices?customer=${encodeURIComponent(customerId)}&limit=6`
  )) as {
    data?: Array<{
      id: string;
      created: number;
      amount_paid: number;
      currency: string;
      status: string;
      hosted_invoice_url?: string;
      invoice_pdf?: string;
    }>;
  } | null;

  const invoices = (inv?.data ?? [])
    .filter((i) => i.status !== "draft")
    .map((i) => ({
      id: i.id,
      date: new Date(i.created * 1000).toISOString().slice(0, 10),
      amount: i.amount_paid / 100,
      currency: i.currency,
      status: i.status,
      pdf: i.invoice_pdf ?? i.hosted_invoice_url ?? null,
    }));

  return NextResponse.json({
    configured: true,
    hasCustomer: true,
    subscription: sub
      ? {
          status: sub.status,
          renewsAt: subPeriodEndISO(sub as StripeSubShape),
          cancelAtPeriodEnd: subIsEnding(sub as StripeSubShape),
        }
      : null,
    card,
    billingEmail: user.email ?? null,
    invoices,
  });
}
