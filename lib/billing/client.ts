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
  status: "active" | "trial" | "expired";
  trialDaysLeft?: number;
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

/** Start Stripe Checkout and redirect. */
export async function startCheckout(): Promise<void> {
  const res = await authedFetch("/api/billing/checkout", { method: "POST" });
  const json = (await res.json()) as { url?: string; error?: string };
  if (json.url) window.location.href = json.url;
  else throw new Error(json.error || "Could not start checkout.");
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
