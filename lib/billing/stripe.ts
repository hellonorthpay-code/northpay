// ─────────────────────────────────────────────────────────────────────────
// Minimal Stripe helper — SERVER ONLY. Uses Stripe's REST API via fetch +
// Node crypto for webhook verification, so we don't add the `stripe` npm
// package (which would require a lockfile update we can't run here).
//
// Env (all server-side):
//   STRIPE_SECRET_KEY      — sk_live_… / sk_test_…  (enables billing)
//   STRIPE_PRICE_ID        — price_…  (the recurring monthly price)
//   STRIPE_WEBHOOK_SECRET  — whsec_…  (verifies webhook signatures)
//
// The whole feature stays dormant until STRIPE_SECRET_KEY is present.
// ─────────────────────────────────────────────────────────────────────────

import crypto from "crypto";

const STRIPE_API = "https://api.stripe.com/v1";

export function billingConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PRICE_ID;
}

function key(): string {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error("STRIPE_SECRET_KEY not set");
  return k;
}

// Stripe expects application/x-www-form-urlencoded with bracketed nested keys,
// e.g. line_items[0][price]=price_123.
function encodeForm(
  obj: Record<string, unknown>,
  prefix = ""
): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const name = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") {
      parts.push(encodeForm(v as Record<string, unknown>, name));
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.filter(Boolean).join("&");
}

async function stripePost(
  path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeForm(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message || `Stripe ${path} failed (${res.status})`);
  }
  return json;
}

async function stripeGet(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${key()}` },
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message || `Stripe ${path} failed (${res.status})`);
  }
  return json;
}

/** Reuse a customer for this email, or create one. Returns the customer id. */
export async function findOrCreateCustomer(
  email: string,
  userId: string
): Promise<string> {
  const found = (await stripeGet(
    `/customers?email=${encodeURIComponent(email)}&limit=1`
  )) as { data?: Array<{ id: string }> };
  if (found.data && found.data.length > 0) return found.data[0].id;

  const created = (await stripePost("/customers", {
    email,
    metadata: { northpay_user_id: userId },
  })) as { id: string };
  return created.id;
}

/** Hosted Checkout for the monthly subscription. Returns the redirect URL. */
export async function createCheckoutSession(opts: {
  customerId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const session = (await stripePost("/checkout/sessions", {
    mode: "subscription",
    customer: opts.customerId,
    client_reference_id: opts.userId,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    allow_promotion_codes: "true",
    "line_items[0][price]": process.env.STRIPE_PRICE_ID,
    "line_items[0][quantity]": 1,
    "subscription_data[metadata][northpay_user_id]": opts.userId,
  })) as { url: string };
  return session.url;
}

/** Stripe-hosted "manage subscription" portal. Returns the redirect URL. */
export async function createPortalSession(opts: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const session = (await stripePost("/billing_portal/sessions", {
    customer: opts.customerId,
    return_url: opts.returnUrl,
  })) as { url: string };
  return session.url;
}

/**
 * Verify a Stripe webhook signature (replaces stripe.webhooks.constructEvent).
 * Header format: "t=<ts>,v1=<sig>". signedPayload = `${t}.${rawBody}`,
 * HMAC-SHA256 with the webhook secret.
 */
export function verifyWebhook(
  rawBody: string,
  signatureHeader: string | null
): Record<string, unknown> | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return null;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, ...rest] = p.split("=");
      return [k.trim(), rest.join("=").trim()];
    })
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return null;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");

  // Constant-time compare.
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Reading a subscription's period/cancellation across Stripe API versions.
//
// Stripe moved `current_period_end` off the Subscription and onto each
// Subscription Item in recent API versions (this account is on
// 2026-06-24.dahlia), so reading only the top-level field silently yields
// null — which is why a cancelled plan showed no end date. Check both, and
// fall back to `cancel_at` when the plan is set to cancel.
// ─────────────────────────────────────────────────────────────────────────

export interface StripeSubShape {
  id?: string;
  status?: string;
  current_period_end?: number | null;
  cancel_at?: number | null;
  cancel_at_period_end?: boolean;
  items?: { data?: Array<{ current_period_end?: number | null }> };
}

/** Unix seconds when the current period ends, from wherever Stripe put it. */
export function subPeriodEnd(sub: StripeSubShape): number | null {
  return (
    sub.current_period_end ??
    sub.items?.data?.[0]?.current_period_end ??
    sub.cancel_at ??
    null
  );
}

/** ISO yyyy-mm-dd for the end of the current period, or null. */
export function subPeriodEndISO(sub: StripeSubShape): string | null {
  const secs = subPeriodEnd(sub);
  return secs ? new Date(secs * 1000).toISOString().slice(0, 10) : null;
}

/** True when the member has cancelled and is running out the paid period. */
export function subIsEnding(sub: StripeSubShape): boolean {
  return !!sub.cancel_at_period_end || !!sub.cancel_at;
}
