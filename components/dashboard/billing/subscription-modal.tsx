"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronRight,
  CreditCard,
  Download,
  Mail,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useBilling,
  startCheckout,
  openBillingPortal,
} from "@/lib/billing/client";
import { useAuth } from "@/lib/store/auth";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

// ─────────────────────────────────────────────────────────────────────────
// Subscription pop-up + its entry rows (profile page & mobile Settings).
//
// Pilot-only: every component here renders null unless the signed-in account
// is in BILLING_TEST_EMAILS (billing.pilot).
//
// ACTIVE renders a dark "membership card" so paying feels like joining
// something. Invoices are NOT faked for active members — that row deep-links
// to Stripe's portal, which holds the real receipts. The card/renewal rows
// remain sample values in the inactive state only, and say so.
// ─────────────────────────────────────────────────────────────────────────

export function SubscriptionModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const billing = useBilling();
  const user = useAuth((s) => s.user);
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isActive = billing.status === "active";

  async function run(kind: "checkout" | "portal") {
    setBusy(kind);
    setErr(null);
    try {
      if (kind === "checkout") await startCheckout();
      else await openBillingPortal();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[88vw] gap-2.5 p-4 max-h-[80vh] overflow-y-auto scrollbar-none sm:max-w-md sm:gap-5 sm:p-7">
        <DialogHeader>
          <DialogTitle className="text-[17px] sm:text-xl">Subscription</DialogTitle>
        </DialogHeader>

        {/* ── Active: a premium, inverted membership card ──
            Subscribing should feel like joining something, not like a status
            field flipping to green. Deep ink surface, a slow sheen sweep, and
            a check that draws itself in. */}
        {isActive ? (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease }}
            className="relative overflow-hidden rounded-2xl bg-[#111113] p-4 text-white shadow-pop sm:p-5"
          >
            {/* Depth + colour bloom */}
            <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-400/15 blur-3xl" />
            {/* Sheen sweep */}
            <motion.div
              initial={{ x: "-120%" }}
              animate={{ x: "220%" }}
              transition={{ duration: 1.6, ease, delay: 0.35 }}
              className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                    NorthPay Monthly
                  </p>
                  <p className="mt-2 text-[26px] font-semibold leading-none tracking-tightest tabular-nums sm:text-[32px]">
                    $9.99
                    <span className="text-[13px] font-medium text-white/50">
                      {" "}
                      CAD / month
                    </span>
                  </p>
                </div>

                {/* Drawn check */}
                <motion.span
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.15 }}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-400 text-[#111113] shadow-[0_0_22px_rgba(52,211,153,0.55)]"
                >
                  <Check className="h-[18px] w-[18px]" strokeWidth={3.2} />
                </motion.span>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease, delay: 0.28 }}
                className="mt-4 text-[15px] font-semibold tracking-tight"
              >
                You&rsquo;re subscribed
              </motion.p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-white/55">
                Unlimited employees · payroll runs · paystub emails
              </p>

              <div className="mt-3.5 flex items-center gap-1.5 border-t border-white/10 pt-3 text-[11px] text-white/45">
                <Sparkles className="h-3 w-3" />
                Thanks for supporting NorthPay.
              </div>
            </div>
          </motion.div>
        ) : (
        /* Plan hero */
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/60 p-3.5 sm:p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-rose-200/30 blur-2xl dark:bg-rose-500/10" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                NorthPay Monthly
              </p>
              <p className="mt-1 text-[23px] font-semibold leading-none tracking-tightest tabular-nums sm:text-[30px]">
                $9.99
                <span className="text-[14px] font-medium text-muted-foreground">
                  {" "}
                  CAD / month
                </span>
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Unlimited employees · payroll runs · paystub emails
              </p>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] sm:px-3 sm:py-1.5 sm:text-[11px]",
                isActive
                  ? "bg-success/15 text-success"
                  : billing.status === "trial"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              {isActive ? (
                <>
                  <Check className="h-3 w-3" strokeWidth={3} />
                  Active
                </>
              ) : billing.status === "trial" ? (
                <>
                  <Sparkles className="h-3 w-3" />
                  Trial · {billing.trialDaysLeft}d left
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3" />
                  Expired
                </>
              )}
            </span>
          </div>
        </div>
        )}

        {/* Details — sample data, labelled */}
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <DetailRow
            icon={CreditCard}
            label="Payment method"
            value="Visa •••• 4242"
          />
          <DetailRow
            icon={CalendarClock}
            label="Next renewal"
            value="Aug 15, 2026"
          />
          <DetailRow
            icon={Mail}
            label="Billing email"
            value={user?.email ?? "—"}
            last
          />
        </div>

        {/* Invoices live in Stripe's portal — we deliberately do NOT invent
            rows here. Showing a paying member fabricated "Paid" receipts is
            both dishonest and the fastest way to make the product feel cheap. */}
        {isActive ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("portal")}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-60"
          >
            <span className="flex items-center gap-2.5">
              <Download className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px] font-medium tracking-tight">
                Invoices &amp; receipts
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ) : (
          <p className="px-1 text-[9.5px] leading-relaxed sm:text-[10px] text-muted-foreground/70">
            Card and renewal details shown above are sample values until a
            subscription is active.
          </p>
        )}

        {err && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] font-medium text-destructive">
            {err}
          </p>
        )}

        {/* Actions */}
        <div className="space-y-1.5 sm:space-y-2">
          {/* Primary action is Checkout until a subscription is genuinely
              ACTIVE. A Stripe customer record alone is not a subscription —
              routing on hasCustomer sent people to the manage screen with
              nothing to manage ("No invoice history") and no way to pay. */}
          {isActive ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              disabled={busy !== null}
              onClick={() => run("portal")}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-foreground text-[13.5px] font-semibold text-background transition-colors disabled:opacity-60 sm:h-12 sm:text-[14px]"
            >
              <CreditCard className="h-4 w-4" />
              {busy === "portal" ? "Opening…" : "Manage billing"}
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              disabled={busy !== null}
              onClick={() => run("checkout")}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-foreground text-[13.5px] font-semibold text-background transition-colors disabled:opacity-60 sm:h-12 sm:text-[14px]"
            >
              {busy === "checkout" ? "Opening…" : "Subscribe now"}
              <ArrowUpRight className="h-4 w-4" />
            </motion.button>
          )}

          {/* Only worth showing once Stripe actually has something to manage. */}
          {billing.hasCustomer && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run("portal")}
              className="flex h-9 w-full items-center justify-center rounded-full border border-border/70 bg-background/70 text-[12.5px] font-medium sm:h-11 sm:text-[13px] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-60 sm:h-11"
            >
              {isActive ? "Cancel subscription" : "View billing portal"}
            </button>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  last,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 bg-background/50 px-3 py-2 sm:px-3.5 sm:py-2.5",
        !last && "border-b border-border/50"
      )}
    >
      <span className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="truncate text-[13px] font-medium tracking-tight">
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Entry rows
// ─────────────────────────────────────────────────────────────────────────

/** Profile page — a row card matching the "About NorthPay" card style. */
export function SubscriptionCard({ delay = 0.34 }: { delay?: number }) {
  const billing = useBilling();
  const [open, setOpen] = useState(false);

  if (!billing.configured || !billing.pilot) return null;

  const subtitle =
    billing.status === "active"
      ? "Active · manage your plan and payment method."
      : billing.status === "trial"
      ? `Free trial · ${billing.trialDaysLeft} day${
          billing.trialDaysLeft === 1 ? "" : "s"
        } left.`
      : "Trial ended · subscribe to keep running payroll.";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5, ease }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex w-full items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card/80 px-6 py-6 text-left shadow-soft backdrop-blur-xl transition-colors duration-200 hover:bg-muted/30"
        >
          <div className="min-w-0">
            <p className="text-[15.5px] font-semibold tracking-tight">
              Subscription
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </motion.div>
      <SubscriptionModal open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Mobile Settings — a row styled like the accordion headers. */
export function SubscriptionSettingsRow() {
  const billing = useBilling();
  const [open, setOpen] = useState(false);

  if (!billing.configured || !billing.pilot) return null;

  const subtitle =
    billing.status === "active"
      ? "Active plan"
      : billing.status === "trial"
      ? `Free trial · ${billing.trialDaysLeft} day${
          billing.trialDaysLeft === 1 ? "" : "s"
        } left`
      : "Trial ended";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-4 text-left shadow-soft backdrop-blur-xl transition-colors active:bg-muted/30"
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted">
          <CreditCard className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold tracking-tight">
            Subscription
          </p>
          <p className="text-[12px] text-muted-foreground">{subtitle}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      <SubscriptionModal open={open} onOpenChange={setOpen} />
    </>
  );
}
