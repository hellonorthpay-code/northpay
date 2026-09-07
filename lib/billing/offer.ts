// ─────────────────────────────────────────────────────────────────────────
// The launch offer, defined once. Every surface that mentions the code —
// the subscribe sheet, trial copy, the admin creator, the checkout guard —
// reads from here, so the code and its terms can never drift apart.
//
// Mechanism (Stripe): a coupon of 100% off, `repeating` for 2 months, on a
// promotion code restricted to first-time customers. The subscriber adds a
// card at checkout, receives two $0.00 invoices, and is charged the normal
// price from the third month with no further action. Card-up-front is what
// makes "charged after 2 months" a guarantee rather than a hope.
// ─────────────────────────────────────────────────────────────────────────

export const LAUNCH_OFFER = {
  /** What customers type. */
  code: "NORTHPAY60",
  /** Stable coupon id so creation is idempotent across retries. */
  couponId: "northpay60-2mo",
  couponName: "NorthPay launch — 2 months free",
  freeMonths: 2,
  percentOff: 100,
} as const;

/**
 * Day billing opened to every account. Existing users' trial is measured
 * from the LATER of their signup and this date, so opening the gate never
 * expires someone on the spot. Override with BILLING_LAUNCH_DATE (yyyy-mm-dd)
 * if the gate is opened on a different day than this constant.
 */
export const LAUNCH_DATE = "2026-09-07";

/** Free trial length, in days, from the later of signup and launch. */
export const TRIAL_DAYS = 14;
