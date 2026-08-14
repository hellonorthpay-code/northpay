import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────
// Billing config check — protected by CRON_SECRET.
//
//   GET /api/billing/diagnose?secret=<CRON_SECRET>
//
// Reports whether the Stripe env vars are present and ACTUALLY WORK, without
// ever echoing a secret. Values are reduced to booleans / lengths / prefixes,
// plus the result of two live Stripe calls (auth check + price lookup).
//
// Built because a truncated paste of STRIPE_SECRET_KEY (an ellipsis from
// copying the masked value on screen) failed at runtime with an opaque
// "Cannot convert argument to a ByteString" error. This makes the state of
// the config unambiguous.
// ─────────────────────────────────────────────────────────────────────────

const STRIPE_API = "https://api.stripe.com/v1";

/** Non-ASCII chars (…, curly quotes, NBSP) can't go in an HTTP header. */
function nonAsciiReport(v: string) {
  const bad: { index: number; code: number; char: string }[] = [];
  for (let i = 0; i < v.length; i++) {
    const code = v.charCodeAt(i);
    if (code < 32 || code > 126) bad.push({ index: i, code, char: v[i] });
  }
  return bad;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set." }, { status: 500 });
  }
  const provided =
    request.headers.get("x-cron-secret") ||
    new URL(request.url).searchParams.get("secret") ||
    "";
  if (provided !== secret) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const priceId = process.env.STRIPE_PRICE_ID ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const pilot = process.env.BILLING_TEST_EMAILS ?? "";

  const report: Record<string, unknown> = {
    STRIPE_SECRET_KEY: {
      present: !!key,
      length: key.length,
      prefix: key.slice(0, 8),
      // A real test key is ~107 chars; a masked/truncated paste is far shorter.
      looksTruncated: key.length > 0 && key.length < 80,
      invalidChars: nonAsciiReport(key),
    },
    STRIPE_PRICE_ID: {
      present: !!priceId,
      value: priceId.startsWith("price_") ? priceId : `(unexpected) ${priceId}`,
      invalidChars: nonAsciiReport(priceId),
    },
    STRIPE_WEBHOOK_SECRET: {
      present: !!webhookSecret,
      length: webhookSecret.length,
      prefix: webhookSecret.slice(0, 6),
      invalidChars: nonAsciiReport(webhookSecret),
    },
    BILLING_TEST_EMAILS: {
      present: !!pilot,
      value: pilot,
    },
  };

  // ── Live checks ──
  if (key && nonAsciiReport(key).length === 0) {
    try {
      const auth = await fetch(`${STRIPE_API}/balance`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      report.stripeAuth = auth.ok
        ? { ok: true, mode: key.startsWith("sk_test") ? "test" : "live" }
        : { ok: false, status: auth.status, body: (await auth.text()).slice(0, 300) };
    } catch (e) {
      report.stripeAuth = { ok: false, error: String(e).slice(0, 300) };
    }

    if (priceId) {
      try {
        const res = await fetch(`${STRIPE_API}/prices/${priceId}`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (res.ok) {
          const p = (await res.json()) as {
            unit_amount?: number;
            currency?: string;
            recurring?: { interval?: string };
            active?: boolean;
          };
          report.price = {
            ok: true,
            amount: p.unit_amount != null ? p.unit_amount / 100 : null,
            currency: p.currency,
            interval: p.recurring?.interval,
            active: p.active,
          };
        } else {
          report.price = {
            ok: false,
            status: res.status,
            body: (await res.text()).slice(0, 300),
          };
        }
      } catch (e) {
        report.price = { ok: false, error: String(e).slice(0, 300) };
      }
    }
  } else if (key) {
    report.stripeAuth = {
      ok: false,
      reason:
        "Key contains non-ASCII characters — it was pasted from the masked on-screen value. Re-copy with the clipboard icon in Stripe.",
    };
  }

  const ready =
    (report.stripeAuth as { ok?: boolean } | undefined)?.ok === true &&
    (report.price as { ok?: boolean } | undefined)?.ok === true &&
    !!webhookSecret;

  return NextResponse.json({ ready, ...report });
}
