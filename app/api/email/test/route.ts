import { NextResponse } from "next/server";
import { sendBrevoEmail, emailConfigured } from "@/lib/email/brevo";
import {
  buildPaystubEmailHtml,
  buildPayrollSummaryEmailHtml,
} from "@/lib/email/template";

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

  // Render a real Apple-style template with sample numbers so the test send
  // doubles as a design preview. ?kind=summary previews the employer summary;
  // anything else previews the employee paystub.
  const kind = url.searchParams.get("kind");
  const isSummary = kind === "summary";

  const html = isSummary
    ? buildPayrollSummaryEmailHtml({
        companyName: "North Pay",
        range: "Jun 13 – Jun 26, 2026",
        rows: [
          { name: "Rajbir Bal", net: 750.51 },
          { name: "Pawan Bajwa", net: 2051.43 },
          { name: "Aman Sidhu", net: 1820.0 },
          { name: "Priya Kaur", net: 1340.75 },
          { name: "Jas Gill", net: 980.2 },
        ],
        totalNet: 6942.89,
        emailedCount: 5,
      })
    : buildPaystubEmailHtml({
        firstName: "there",
        companyName: "NorthPay",
        range: "Jun 13 – Jun 26, 2026",
        gross: 2884.62,
        taxes: 512.18,
        cpp: 178.42,
        ei: 47.0,
        net: 2147.02,
        hasAttachment: false,
      });

  const result = await sendBrevoEmail({
    toEmail: to,
    toName: to,
    subject: isSummary
      ? "Payroll summary — Jun 13 – Jun 26, 2026"
      : "Your paystub — Jun 13 – Jun 26, 2026",
    html,
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
