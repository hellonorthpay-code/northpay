"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/store/auth";

export interface BillingStatus {
  loading: boolean;
  /** False when Stripe isn't set up yet → treat as fully entitled. */
  configured: boolean;
  /** True when the user may use gated features (paid or in trial). */
  entitled: boolean;
  status: "active" | "trial" | "expired" | "past_due";
  trialDaysLeft?: number;
  /** True when the member has cancelled but access runs to the period end. */
  cancelAtPeriodEnd?: boolean;
  /** ISO date access renews (or ends, when cancelling). */
  renewsAt?: string | null;
  hasCustomer: boolean;
  /** True only for accounts in the billing pilot (BILLING_TEST_EMAILS) —
   *  everyone else must see zero billing UI. */
  pilot: boolean;
}

async function authedFetch(path: string, init?: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

/** Hook: the signed-in employer's billing entitlement. */
export function useBilling(): BillingStatus {
  const user = useAuth((s) => s.user);
  const [state, setState] = useState<BillingStatus>({
    loading: true,
    configured: false,
    entitled: true,
    status: "active",
    hasCustomer: false,
    pilot: false,
  });

  useEffect(() => {
    let alive = true;
    if (!user) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    authedFetch("/api/billing/status")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setState({
          loading: false,
          configured: !!j.configured,
          entitled: j.entitled !== false,
          status: (j.status as BillingStatus["status"]) ?? "active",
          trialDaysLeft: j.trialDaysLeft,
          cancelAtPeriodEnd: !!j.cancelAtPeriodEnd,
          renewsAt: j.renewsAt ?? null,
          hasCustomer: !!j.hasCustomer,
          pilot: !!j.pilot,
        });
      })
      .catch(() => {
        if (alive) setState((s) => ({ ...s, loading: false, entitled: true }));
      });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  return state;
}

/** Start Stripe Checkout and redirect, optionally pre-applying a promo code. */
export async function startCheckout(promoCode?: string): Promise<void> {
  const res = await authedFetch("/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ promoCode: promoCode ?? "" }),
  });
  const json = (await res.json()) as { url?: string; error?: string };
  if (json.url) window.location.href = json.url;
  else throw new Error(json.error || "Could not start checkout.");
}

export interface PromoResult {
  valid: boolean;
  code?: string;
  /** e.g. "20% off" */
  label?: string;
  /** e.g. "on your first month" */
  detail?: string;
}

/** Check a promo code before checkout. Never throws for an invalid code. */
export async function validatePromoCode(code: string): Promise<PromoResult> {
  try {
    const res = await authedFetch("/api/billing/promo", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    const json = (await res.json()) as PromoResult;
    return json?.valid ? json : { valid: false };
  } catch {
    return { valid: false };
  }
}

/** Open the Stripe billing portal and redirect. */
export async function openBillingPortal(): Promise<void> {
  const res = await authedFetch("/api/billing/portal", { method: "POST" });
  const json = (await res.json()) as { url?: string; error?: string };
  if (json.url) window.location.href = json.url;
  else throw new Error(json.error || "Could not open billing portal.");
}

// ─────────────────────────────────────────────────────────────────────────
// Real billing details (card, renewal date, invoices) straight from Stripe.
// Nothing here is ever a placeholder — unknown values come back null and the
// UI omits the row rather than inventing one.
// ─────────────────────────────────────────────────────────────────────────

export interface BillingInvoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  pdf: string | null;
}

export interface BillingSummary {
  loading: boolean;
  hasCustomer: boolean;
  subscription: {
    status: string;
    renewsAt: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  card: { brand: string; last4: string } | null;
  billingEmail: string | null;
  invoices: BillingInvoice[];
}

/** Hook: the signed-in employer's real Stripe billing details. */
export function useBillingSummary(enabled: boolean): BillingSummary {
  const user = useAuth((s) => s.user);
  const [state, setState] = useState<BillingSummary>({
    loading: true,
    hasCustomer: false,
    subscription: null,
    card: null,
    billingEmail: null,
    invoices: [],
  });

  useEffect(() => {
    let alive = true;
    if (!user || !enabled) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    authedFetch("/api/billing/summary")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setState({
          loading: false,
          hasCustomer: !!j.hasCustomer,
          subscription: j.subscription ?? null,
          card: j.card ?? null,
          billingEmail: j.billingEmail ?? null,
          invoices: Array.isArray(j.invoices) ? j.invoices : [],
        });
      })
      .catch(() => {
        if (alive) setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      alive = false;
    };
  }, [user?.id, enabled]);

  return state;
}

/**
 * One place that turns billing state into words. Every surface (settings row,
 * modal card, payroll banner) reads from this so they can never disagree —
 * a cancelled subscription must not read "Active" anywhere.
 */
export function billingLabel(b: BillingStatus): {
  title: string;
  detail: string;
  tone: "active" | "ending" | "trial" | "warn" | "expired";
} {
  const when = b.renewsAt
    ? new Date(`${b.renewsAt}T00:00:00`).toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  if (b.status === "past_due") {
    return {
      title: "Payment failed",
      detail: "Update your card to keep your subscription.",
      tone: "warn",
    };
  }
  if (b.status === "active" && b.cancelAtPeriodEnd) {
    return {
      title: when ? `Cancels on ${when}` : "Cancelling",
      detail: when
        ? `You keep full access until ${when}.`
        : "You keep access until the end of the period.",
      tone: "ending",
    };
  }
  if (b.status === "active") {
    return {
      title: "Active subscription",
      detail: when ? `Renews ${when}.` : "Manage your card or cancel anytime.",
      tone: "active",
    };
  }
  if (b.status === "trial") {
    return {
      title: `Free trial · ${b.trialDaysLeft} day${b.trialDaysLeft === 1 ? "" : "s"} left`,
      detail: "Subscribe any time to keep access.",
      tone: "trial",
    };
  }
  return {
    title: "Trial ended",
    detail: "Subscribe to keep running payroll.",
    tone: "expired",
  };
}

/**
 * Narrow-viewport check for layout decisions that CSS handles badly.
 *
 * Starts false so the first paint matches the server, then corrects on mount
 * and on resize. Used where `hidden`/`flex` utilities would collide on one
 * element — putting both on the same node lets `flex` win and the element
 * stays visible, which is exactly how the mobile cancel button survived two
 * attempts to hide it.
 */
export function useIsNarrow(breakpoint = 640): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [breakpoint]);

  return narrow;
}
