import { NextResponse } from "next/server";
import { sendBrevoEmail, emailConfigured } from "@/lib/email/brevo";

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

  const result = await sendBrevoEmail({
    toEmail: to,
    toName: to,
    subject: "NorthPay test email ✓",
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#16161a;">
        <h2 style="font-size:20px;margin:0 0 12px;">It works 🎉</h2>
        <p style="font-size:14px;line-height:1.6;color:#3a3a40;">
          This is a test email from <strong>NorthPay</strong>, sent through Brevo
          from <strong>noreply@thenorthpay.com</strong>. If you're reading this in
          your inbox (not spam), your domain authentication and sending pipeline
          are configured correctly.
        </p>
        <p style="font-size:12px;color:#9a9aa2;margin-top:24px;">
          Sent automatically as a configuration check. No action needed.
        </p>
      </div>`,
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
