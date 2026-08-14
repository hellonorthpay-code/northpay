"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Sparkles, Check, ArrowUpRight } from "lucide-react";
import {
  useBilling,
  startCheckout,
  openBillingPortal,
} from "@/lib/billing/client";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Shown on the Payroll tab when the trial has ended and there's no active
 * subscription — locks the run behind a subscribe CTA.
 */
export function UpgradeBanner() {
  const billing = useBilling();
  const [busy, setBusy] = useState(false);

  // Only block when billing is actually configured AND the user is not
  // entitled — and only ever for pilot accounts (BILLING_TEST_EMAILS).
  if (!billing.configured || !billing.pilot || billing.entitled || billing.loading)
    return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease }}
      className="flex flex-col gap-3 rounded-3xl border border-amber-300/50 bg-amber-50 p-5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-[14px] font-semibold tracking-tight">
            Your free trial has ended
          </p>
          <p className="mt-1 text-[12.5px] opacity-90">
            Subscribe to keep running payroll and emailing paystubs.
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await startCheckout();
          } catch {
            setBusy(false);
          }
        }}
        className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full bg-amber-900 px-5 py-2.5 text-[13px] font-medium text-amber-50 transition-transform duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 sm:self-center"
      >
        <CreditCard className="h-4 w-4" />
        {busy ? "Opening…" : "Subscribe"}
      </button>
    </motion.div>
  );
}

/** Trial-days pill for the top of Payroll — gentle nudge, not a block. */
export function TrialBadge() {
  const billing = useBilling();
  if (!billing.configured || !billing.pilot || billing.status !== "trial")
    return null;
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-[12px] font-medium text-muted-foreground shadow-soft">
      <Sparkles className="h-3.5 w-3.5" />
      {billing.trialDaysLeft} day{billing.trialDaysLeft === 1 ? "" : "s"} left in
      your free trial
    </div>
  );
}

/** Full billing card for Settings — shows plan status + manage/subscribe. */
export function BillingSettingsCard() {
  const billing = useBilling();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Hide until Stripe is configured, and always for non-pilot accounts.
  if (!billing.configured || !billing.pilot) return null;

  const label =
    billing.status === "active"
      ? "Active subscription"
      : billing.status === "trial"
      ? `Free trial · ${billing.trialDaysLeft} day${
          billing.trialDaysLeft === 1 ? "" : "s"
        } left`
      : "Trial ended";

  async function primary() {
    setBusy(true);
    setErr(null);
    try {
      if (billing.status === "active" || billing.hasCustomer) {
        await openBillingPortal();
      } else {
        await startCheckout();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease }}
      className="overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-soft backdrop-blur-xl"
    >
      <header className="border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted">
            <CreditCard className="h-4 w-4" />
          </div>
          <p className="text-[17px] font-semibold tracking-tight">Billing</p>
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-2.5">
          <span
            className={
              billing.status === "active"
                ? "grid h-8 w-8 place-items-center rounded-full bg-success/15 text-success"
                : "grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground"
            }
          >
            {billing.status === "active" ? (
              <Check className="h-4 w-4" strokeWidth={3} />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </span>
          <div>
            <p className="text-[13.5px] font-medium tracking-tight">{label}</p>
            <p className="text-[11.5px] text-muted-foreground">
              {billing.status === "active"
                ? "Manage your card or cancel anytime."
                : "NorthPay subscription."}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={primary}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-[13px] font-medium text-background transition-transform duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          {billing.status === "active" || billing.hasCustomer ? (
            <>Manage billing</>
          ) : (
            <>
              Subscribe
              <ArrowUpRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
      {err && (
        <p className="border-t border-destructive/20 bg-destructive/5 px-5 py-3 text-[12px] text-destructive">
          {err}
        </p>
      )}
    </motion.section>
  );
}
