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
  Tag,
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
  useBillingSummary,
  useIsNarrow,
  billingLabel,
  startCheckout,
  validatePromoCode,
  openBillingPortal,
  type PromoResult,
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
// something. Every value shown — card brand/last4, renewal date, invoices and
// their PDF links — comes from Stripe via /api/billing/summary. Nothing is
// placeholder data: an unknown value hides its row rather than inventing one.
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

  // Promo code — validated before checkout so the discount is confirmed on
  // this screen rather than being a surprise (good or bad) on Stripe's page.
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoChecking, setPromoChecking] = useState(false);
  const [promo, setPromo] = useState<PromoResult | null>(null);

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    setPromoChecking(true);
    setPromo(null);
    const result = await validatePromoCode(code);
    setPromo(result);
    setPromoChecking(false);
  }

  const isActive = billing.status === "active" || billing.status === "past_due";
  const ending = !!billing.cancelAtPeriodEnd;
  const label = billingLabel(billing);
  // Real Stripe details — only fetched once billing is relevant to this user.
  const summary = useBillingSummary(billing.pilot && billing.configured);
  // Narrow viewports get a trimmed sheet. Decided in JS, not CSS: `hidden`
  // alongside `flex` on one element lets flex win, which kept the cancel
  // button on screen through two CSS-only attempts.
  const narrow = useIsNarrow();
  const visibleInvoices = narrow
    ? summary.invoices.slice(0, 2)
    : summary.invoices;
  // Cancelling stays reachable inside Manage billing, so the phone sheet
  // drops the duplicate destructive action. Resume / View portal are not
  // cancel actions and remain at every size.
  const showSecondaryAction =
    billing.hasCustomer && !(narrow && isActive && !ending);

  const renewalLabel = summary.subscription?.renewsAt
    ? new Date(`${summary.subscription.renewsAt}T00:00:00`).toLocaleDateString(
        "en-CA",
        { month: "short", day: "numeric", year: "numeric" }
      )
    : null;

  async function run(kind: "checkout" | "portal") {
    setBusy(kind);
    setErr(null);
    try {
      if (kind === "checkout") {
        await startCheckout(promo?.valid ? promo.code : undefined);
      }
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
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#111113]",
                    ending
                      ? "bg-amber-300 shadow-[0_0_22px_rgba(252,211,77,0.5)]"
                      : "bg-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.55)]"
                  )}
                >
                  {ending ? (
                    <CalendarClock className="h-[18px] w-[18px]" strokeWidth={2.6} />
                  ) : (
                    <Check className="h-[18px] w-[18px]" strokeWidth={3.2} />
                  )}
                </motion.span>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease, delay: 0.28 }}
                className="mt-4 text-[15px] font-semibold tracking-tight"
              >
                {ending ? label.title : "You’re subscribed"}
              </motion.p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-white/55">
                {ending
                  ? label.detail
                  : "Unlimited employees · payroll runs · paystub emails"}
              </p>

              <div className="mt-3.5 flex items-center gap-1.5 border-t border-white/10 pt-3 text-[11px] text-white/45">
                <Sparkles className="h-3 w-3" />
                {ending
                  ? "You can resume any time before then."
                  : "Thanks for supporting NorthPay."}
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

        {/* Details — real Stripe values only. A row is omitted entirely
            rather than shown with an invented value. */}
        {(summary.card || renewalLabel || user?.email) && (
          <div className="overflow-hidden rounded-2xl border border-border/60">
            {summary.card && (
              <DetailRow
                icon={CreditCard}
                label="Payment method"
                value={`${cardBrand(summary.card.brand)} •••• ${summary.card.last4}`}
              />
            )}
            {renewalLabel && (
              <DetailRow
                icon={CalendarClock}
                label={
                  summary.subscription?.cancelAtPeriodEnd
                    ? "Access until"
                    : "Next renewal"
                }
                value={renewalLabel}
              />
            )}
            <DetailRow
              icon={Mail}
              label="Billing email"
              value={summary.billingEmail ?? user?.email ?? "—"}
              last
            />
          </div>
        )}

        {/* Real invoices, with real PDF links. */}
        {visibleInvoices.length > 0 && (
          <div>
            <p className="mb-1 px-1 text-[10px] sm:text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Invoices
            </p>
            <div className="overflow-hidden rounded-2xl border border-border/60">
              {visibleInvoices.map((inv, i) => (
                <InvoiceRow
                  key={inv.id}
                  date={inv.date}
                  amount={inv.amount}
                  currency={inv.currency}
                  status={inv.status}
                  pdf={inv.pdf}
                  last={i === visibleInvoices.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        {summary.loading && isActive && (
          <p className="px-1 text-[11px] text-muted-foreground">
            Loading billing details…
          </p>
        )}

        {/* Promo code — only worth offering to someone about to subscribe.
            Validated here so the discount is confirmed before leaving the app;
            Stripe's own promo box still appears if no code is pre-applied. */}
        {!isActive && (
          <div>
            {!promoOpen ? (
              <button
                type="button"
                onClick={() => setPromoOpen(true)}
                className="flex items-center gap-1.5 px-1 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Tag className="h-3.5 w-3.5" />
                Have a promo code?
              </button>
            ) : (
              <div className="rounded-2xl border border-border/60 p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={promoInput}
                    onChange={(e) => {
                      setPromoInput(e.target.value.toUpperCase());
                      setPromo(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void applyPromo();
                      }
                    }}
                    placeholder="Enter code"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-[14px] uppercase tracking-wide outline-none transition-colors placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground focus:border-foreground/30"
                  />
                  <button
                    type="button"
                    onClick={() => void applyPromo()}
                    disabled={promoChecking || !promoInput.trim()}
                    className="h-10 shrink-0 rounded-xl bg-foreground px-4 text-[13px] font-semibold text-background transition-opacity disabled:opacity-40"
                  >
                    {promoChecking ? "Checking…" : "Apply"}
                  </button>
                </div>

                {promo?.valid && (
                  <p className="mt-2 flex items-center gap-1.5 px-0.5 text-[12px] font-medium text-success">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    {promo.label} {promo.detail} — applied at checkout.
                  </p>
                )}
                {promo && !promo.valid && (
                  <p className="mt-2 px-0.5 text-[12px] font-medium text-destructive">
                    That code isn&rsquo;t valid.
                  </p>
                )}
              </div>
            )}
          </div>
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

          {/* Only worth showing once Stripe actually has something to manage.
              The hide is on a WRAPPER, not the button: putting `hidden` and
              `flex` on the same element makes two display utilities fight,
              which is why the cancel action still appeared on phones. */}
          {showSecondaryAction && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run("portal")}
              className="flex h-9 w-full items-center justify-center rounded-full border border-border/70 bg-background/70 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-60 sm:h-11 sm:text-[13px]"
            >
              {ending
                ? "Resume subscription"
                : isActive
                ? "Cancel subscription"
                : "View billing portal"}
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
        !last && "border-b border-border/50",
        className
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

  const subtitle = billingLabel(billing).detail;

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

  const subtitle = billingLabel(billing).title;

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

function cardBrand(brand: string) {
  const map: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "Amex",
    discover: "Discover",
    jcb: "JCB",
    diners: "Diners",
    unionpay: "UnionPay",
  };
  return map[brand?.toLowerCase()] ?? "Card";
}

function InvoiceRow({
  date,
  amount,
  currency,
  status,
  pdf,
  last,
  className,
}: {
  date: string;
  amount: number;
  currency: string;
  status: string;
  pdf: string | null;
  last?: boolean;
  className?: string;
}) {
  const label = new Date(`${date}T00:00:00`).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const paid = status === "paid";
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 bg-background/50 px-3 py-2 sm:px-3.5 sm:py-2.5",
        !last && "border-b border-border/50",
        className
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium tracking-tight">{label}</p>
        <p
          className={cn(
            "text-[11px] capitalize",
            paid ? "text-success" : "text-muted-foreground"
          )}
        >
          {status}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-[13px] font-medium tabular-nums">
          ${amount.toFixed(2)}{" "}
          <span className="text-[10px] uppercase text-muted-foreground">
            {currency}
          </span>
        </span>
        {pdf && (
          <a
            href={pdf}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Download invoice for ${label}`}
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
