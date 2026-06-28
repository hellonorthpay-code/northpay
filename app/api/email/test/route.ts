import { NextResponse } from "next/server";
import { sendBrevoEmail, emailConfigured } from "@/lib/email/brevo";
import { buildPaystubEmailHtml } from "@/lib/email/template";

// ─────────────────────────────────────────────────────────────────────────
// One-off email test endpoint — protected by CRON_SECRET.
//
//   GET /api/email/test?secret=<CRON_SECRET>&to=someone@example.com
//
// Sends a single plain test email via Brevo so you can confirm the sender
// domain + API key are working end to end (deliverability, not spam, etc).
// Safe to leave in place: it does nothing without the secret.
// ─────────────────────────────────────────────────────────────────────────

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set." }, { status: 500 });
  }
  const url = new URL(request.url);
  const provided =
    request.headers.get("x-cron-secret") ||
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim() ||
    url.searchParams.get("secret") ||
    "";
  if (provided !== secret) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (!emailConfigured()) {
    return NextResponse.json({ error: "Email not configured." }, { status: 503 });
  }

  const to = url.searchParams.get("to")?.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json(
      { error: "Provide a valid ?to= email address." },
      { status: 400 }
    );
  }

  // Render the real Apple-style paystub template with sample numbers so the
  // test send doubles as a design preview.
  const result = await sendBrevoEmail({
    toEmail: to,
    toName: to,
    subject: "Your paystub — Jun 13 – Jun 26, 2026",
    html: buildPaystubEmailHtml({
      firstName: "there",
      companyName: "NorthPay",
      range: "Jun 13 – Jun 26, 2026",
      gross: 2884.62,
      taxes: 512.18,
      cpp: 178.42,
      ei: 47.0,
      net: 2147.02,
      hasAttachment: false,
    }),
  });

  return NextResponse.json({
    ok: result.ok,
    status: result.status,
    messageId: result.messageId,
    error: result.error,
    to,
  });
}

export async function GET(request: Request) {
  return handle(request);
}
export async function POST(request: Request) {
  return handle(request);
}
