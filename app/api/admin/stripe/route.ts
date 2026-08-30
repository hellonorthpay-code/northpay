import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import type { AdminStripeSummary, AdminStripeTx } from "@/lib/admin/types";

// ─────────────────────────────────────────────────────────────────────────
// Every Stripe transaction on the platform, for the admin tab.
//
// Admin-gated by the same allowlist as the rest of /api/admin. Everything
// returned is read straight from Stripe — amounts, refund state, receipt
// links. Nothing is derived from our own tables, so this stays truthful
// even if a webhook was missed.
// ─────────────────────────────────────────────────────────────────────────

const STRIPE = "https://api.stripe.com/v1";

async function stripeGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`${STRIPE}${path}`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** Normalize any recurring price to a monthly figure. */
function monthlyAmount(
  unitAmount: number,
  interval: string,
  intervalCount: number
): number {
  const perMonth =
    interval === "year"
      ? unitAmount / 12
      : interval === "week"
        ? (unitAmount * 52) / 12
        : interval === "day"
          ? (unitAmount * 365) / 12
          : unitAmount;
  return perMonth / Math.max(1, intervalCount);
}

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    const empty: AdminStripeSummary = {
      configured: false,
      netVolume: 0,
      grossVolume: 0,
      refundedTotal: 0,
      currency: "cad",
      activeSubscriptions: 0,
      mrr: 0,
      transactions: [],
    };
    return NextResponse.json(empty);
  }

  const [charges, subs] = await Promise.all([
    stripeGet<{
      data?: Array<{
        id: string;
        created: number;
        amount: number;
        amount_refunded?: number;
        currency: string;
        status: string;
        refunded?: boolean;
        description?: string | null;
        receipt_url?: string | null;
        billing_details?: { email?: string | null };
      }>;
    }>("/charges?limit=100"),
    stripeGet<{
      data?: Array<{
        status: string;
        items?: {
          data?: Array<{
            quantity?: number;
            price?: {
              unit_amount?: number | null;
              recurring?: { interval?: string; interval_count?: number } | null;
            } | null;
          }>;
        };
      }>;
    }>("/subscriptions?status=active&limit=100"),
  ]);

  let grossVolume = 0;
  let refundedTotal = 0;
  let currency = "cad";

  const transactions: AdminStripeTx[] = (charges?.data ?? []).map((c) => {
    const refunded = c.amount_refunded ?? 0;
    if (c.status === "succeeded") {
      grossVolume += c.amount;
      refundedTotal += refunded;
      if (c.currency) currency = c.currency;
    }
    return {
      id: c.id,
      date: new Date(c.created * 1000).toISOString().slice(0, 10),
      amount: c.amount / 100,
      currency: c.currency,
      status: c.status,
      refunded: !!c.refunded || refunded > 0,
      email: c.billing_details?.email ?? null,
      description: c.description ?? null,
      receiptUrl: c.receipt_url ?? null,
    };
  });

  let mrr = 0;
  for (const s of subs?.data ?? []) {
    for (const item of s.items?.data ?? []) {
      const price = item.price;
      const rec = price?.recurring;
      if (!price?.unit_amount || !rec?.interval) continue;
      mrr +=
        monthlyAmount(price.unit_amount, rec.interval, rec.interval_count ?? 1) *
        (item.quantity ?? 1);
    }
  }

  const summary: AdminStripeSummary = {
    configured: true,
    grossVolume: grossVolume / 100,
    refundedTotal: refundedTotal / 100,
    netVolume: (grossVolume - refundedTotal) / 100,
    currency,
    activeSubscriptions: (subs?.data ?? []).length,
    mrr: Math.round(mrr) / 100,
    transactions,
  };

  return NextResponse.json(summary);
}
