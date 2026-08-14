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
