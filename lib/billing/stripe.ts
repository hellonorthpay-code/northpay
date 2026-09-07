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

// ─────────────────────────────────────────────────────────────────────────
// Is a stored customer id still real?
//
// Customer ids are scoped to one Stripe mode. Switching test → live (or
// rotating accounts) leaves rows pointing at ids that no longer resolve, and
// Stripe answers `resource_missing`. That is NOT a transient outage: falling
// back to the stored row on it makes the app claim an active subscription
// that cannot be billed, and sends checkout to a customer that can't be used.
// Distinguish the three cases so callers can react correctly.
// ─────────────────────────────────────────────────────────────────────────

export type CustomerState = "exists" | "missing" | "unknown";

/** Does this customer id resolve in the CURRENT Stripe mode? */
export async function checkCustomer(customerId: string): Promise<CustomerState> {
  try {
    const res = await fetch(
      `${STRIPE_API}/customers/${encodeURIComponent(customerId)}`,
      { headers: { Authorization: `Bearer ${key()}` } }
    );
    if (res.status === 404) return "missing";
    if (!res.ok) return isResourceMissing(await res.json().catch(() => null))
      ? "missing"
      : "unknown";
    const json = (await res.json()) as { deleted?: boolean };
    // A deleted customer still resolves but can't be charged — treat as gone.
    return json.deleted ? "missing" : "exists";
  } catch {
    // Network/DNS failure — say nothing rather than destroying a good row.
    return "unknown";
  }
}

/**
 * True when a Stripe error body means "that object doesn't exist here".
 * Deliberately narrow — only the explicit code counts, so a malformed
 * request or a bad key can never be mistaken for a stale customer and
 * trigger us to wipe a perfectly good row.
 */
export function isResourceMissing(body: unknown): boolean {
  return (
    (body as { error?: { code?: string } } | null)?.error?.code ===
    "resource_missing"
  );
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

export interface PromoLookup {
  id: string;
  code: string;
  /** Human-readable discount, e.g. "20% off" or "$5.00 off". */
  label: string;
  /** "forever" | "once" | "repeating" */
  duration: string;
  durationInMonths?: number | null;
  /** Stripe will refuse this code for any customer with a prior payment. */
  firstTimeOnly: boolean;
}

/**
 * Look up an active promotion code by the string a customer typed.
 * Returns null when it doesn't exist, is inactive, or is expired —
 * we never explain WHY beyond "not valid", so codes can't be probed.
 */
export async function findPromotionCode(
  code: string
): Promise<PromoLookup | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const res = (await stripeGet(
    `/promotion_codes?code=${encodeURIComponent(trimmed)}&active=true&limit=1`
  )) as {
    data?: Array<{
      id: string;
      code: string;
      restrictions?: { first_time_transaction?: boolean };
      coupon?: {
        percent_off?: number | null;
        amount_off?: number | null;
        currency?: string | null;
        duration?: string;
        duration_in_months?: number | null;
        valid?: boolean;
      };
    }>;
  };

  const promo = res.data?.[0];
  if (!promo || !promo.coupon?.valid) return null;

  const c = promo.coupon;
  const label = c.percent_off
    ? `${c.percent_off}% off`
    : c.amount_off
      ? `$${(c.amount_off / 100).toFixed(2)} ${(c.currency ?? "").toUpperCase()} off`
      : "Discount";

  return {
    id: promo.id,
    code: promo.code,
    label,
    duration: c.duration ?? "once",
    durationInMonths: c.duration_in_months ?? null,
    firstTimeOnly: !!promo.restrictions?.first_time_transaction,
  };
}

/**
 * Has this customer ever successfully paid? Mirrors Stripe's own
 * `first_time_transaction` rule so the in-app validator and the checkout
 * guard reach the same verdict Stripe will — a code must never read "valid"
 * on our screen and then be refused on Stripe's.
 *
 * A $0 invoice (e.g. a fully discounted month) is not a payment. A refunded
 * charge still is: the payment succeeded, which is what the rule is about.
 */
export async function customerHasPaid(customerId: string): Promise<boolean> {
  const [charges, invoices] = await Promise.all([
    stripeGet(`/charges?customer=${encodeURIComponent(customerId)}&limit=100`) as Promise<{
      data?: Array<{ status: string; amount: number }>;
    }>,
    stripeGet(
      `/invoices?customer=${encodeURIComponent(customerId)}&status=paid&limit=100`
    ) as Promise<{ data?: Array<{ amount_paid: number }> }>,
  ]);
  const paidCharge = (charges.data ?? []).some(
    (c) => c.status === "succeeded" && c.amount > 0
  );
  const paidInvoice = (invoices.data ?? []).some((i) => (i.amount_paid ?? 0) > 0);
  return paidCharge || paidInvoice;
}

// ─────────────────────────────────────────────────────────────────────────
// Launch offer — created from the admin panel with parameters fixed here,
// not typed into a dashboard where "once" sits one click from "repeating".
// Idempotent: safe to press twice, and it reports drift if the code exists
// with different terms instead of silently accepting them.
// ─────────────────────────────────────────────────────────────────────────

export interface LaunchOfferState {
  code: string;
  exists: boolean;
  /** True when it exists AND every term matches LAUNCH_OFFER. */
  ok: boolean;
  /** Human-readable terms that differ, when ok is false. */
  mismatches: string[];
  promotionCodeId?: string;
  timesRedeemed?: number;
}

interface PromoRecord {
  id: string;
  code: string;
  active: boolean;
  times_redeemed?: number;
  restrictions?: { first_time_transaction?: boolean };
  coupon?: {
    id: string;
    percent_off?: number | null;
    duration?: string;
    duration_in_months?: number | null;
    valid?: boolean;
  };
}

function auditOffer(
  p: PromoRecord,
  offer: { code: string; percentOff: number; freeMonths: number }
): LaunchOfferState {
  const mismatches: string[] = [];
  if (!p.active) mismatches.push("promotion code is inactive");
  if (!p.restrictions?.first_time_transaction)
    mismatches.push("not restricted to first-time customers");
  const c = p.coupon;
  if (!c) mismatches.push("no coupon attached");
  else {
    if (c.percent_off !== offer.percentOff)
      mismatches.push(`discount is ${c.percent_off ?? 0}% not ${offer.percentOff}%`);
    if (c.duration !== "repeating")
      mismatches.push(`duration is "${c.duration}" not "repeating"`);
    if (c.duration_in_months !== offer.freeMonths)
      mismatches.push(
        `applies for ${c.duration_in_months ?? 0} months not ${offer.freeMonths}`
      );
    if (c.valid === false) mismatches.push("coupon is no longer valid");
  }
  return {
    code: p.code,
    exists: true,
    ok: mismatches.length === 0,
    mismatches,
    promotionCodeId: p.id,
    timesRedeemed: p.times_redeemed ?? 0,
  };
}

/** Current state of the launch offer in Stripe — never creates anything. */
export async function getLaunchOffer(offer: {
  code: string;
  percentOff: number;
  freeMonths: number;
}): Promise<LaunchOfferState> {
  const res = (await stripeGet(
    `/promotion_codes?code=${encodeURIComponent(offer.code)}&limit=1`
  )) as { data?: PromoRecord[] };
  const p = res.data?.[0];
  if (!p) return { code: offer.code, exists: false, ok: false, mismatches: [] };
  return auditOffer(p, offer);
}

/** Create the launch offer if absent. Existing-but-different is reported, not overwritten. */
export async function ensureLaunchOffer(offer: {
  code: string;
  couponId: string;
  couponName: string;
  percentOff: number;
  freeMonths: number;
}): Promise<LaunchOfferState> {
  const current = await getLaunchOffer(offer);
  if (current.exists) return current;

  // Coupon: reuse by fixed id if a previous attempt got this far.
  let couponExists = false;
  try {
    await stripeGet(`/coupons/${encodeURIComponent(offer.couponId)}`);
    couponExists = true;
  } catch {
    couponExists = false;
  }
  if (!couponExists) {
    await stripePost("/coupons", {
      id: offer.couponId,
      name: offer.couponName,
      percent_off: offer.percentOff,
      duration: "repeating",
      duration_in_months: offer.freeMonths,
    });
  }

  await stripePost("/promotion_codes", {
    promotion_code: offer.code,
    coupon: offer.couponId,
    active: true,
    restrictions: { first_time_transaction: true },
  });

  return getLaunchOffer(offer);
}

/** Hosted Checkout for the monthly subscription. Returns the redirect URL. */
export async function createCheckoutSession(opts: {
  customerId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
  /** Stripe promotion_code id (promo_…), when the customer pre-applied one. */
  promotionCodeId?: string | null;
}): Promise<string> {
  const body: Record<string, unknown> = {
    mode: "subscription",
    customer: opts.customerId,
    client_reference_id: opts.userId,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    "line_items[0][price]": process.env.STRIPE_PRICE_ID,
    "line_items[0][quantity]": 1,
    "subscription_data[metadata][northpay_user_id]": opts.userId,
  };

  // Stripe rejects a session that both pre-applies a discount AND offers the
  // promo-code box, so pick one: pre-apply what the customer already entered,
  // otherwise let them add a code on Stripe's page.
  if (opts.promotionCodeId) {
    body["discounts[0][promotion_code]"] = opts.promotionCodeId;
  } else {
    body.allow_promotion_codes = "true";
  }

  const session = (await stripePost("/checkout/sessions", body)) as {
    url: string;
  };
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
