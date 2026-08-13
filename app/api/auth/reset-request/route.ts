import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { emailConfigured, sendBrevoEmail } from "@/lib/email/brevo";
import { buildPasswordResetEmailHtml } from "@/lib/email/template";

// ─────────────────────────────────────────────────────────────────────────
// Password-reset request.
//
// Why not supabase.auth.resetPasswordForEmail from the browser?
//   1. That sends from Supabase's generic mailer, not noreply@thenorthpay.com.
//   2. It's rate-limited to a couple of emails/hour on the free tier.
//   3. It never reveals whether the account exists — the product wants an
//      explicit "no account found" message on the forgot-password form.
//
// So: the service role generates the recovery link (no email sent by
// Supabase), and we deliver it ourselves through Brevo with the same
// Apple-style template the rest of NorthPay's email uses.
//
// Responses:
//   { found: false }            → no account with that email
//   { ok: true }                → link generated + email sent
//   { error } (4xx/5xx)         → validation/config/send failure
// ─────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anonKey || !secretKey) {
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "That doesn't look like a valid email." },
      { status: 400 }
    );
  }

  const origin =
    request.headers.get("origin") ||
    new URL(request.url).origin ||
    "https://www.thenorthpay.com";
  const redirectTo = `${origin}/dashboard/reset-password`;

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Generate the recovery token WITHOUT sending Supabase's email. This also
  // tells us definitively whether the account exists.
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (error) {
    if (error.status === 404 || /not.?found/i.test(error.message)) {
      return NextResponse.json({ found: false });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // IMPORTANT: we do NOT email Supabase's action_link. That link is a
  // one-time GET through supabase.co/auth/v1/verify — email scanners
  // (Gmail, Outlook SafeLinks) pre-fetch it, consuming the token before the
  // user clicks ("otp_expired"), and its redirect depends on the project's
  // Site URL config. Instead we link straight to OUR reset page with the
  // hashed token; the page exchanges it via verifyOtp() in JS on load,
  // which scanners don't execute.
  const hashedToken = data.properties?.hashed_token;
  if (!hashedToken) {
    return NextResponse.json(
      { error: "Could not create a reset link." },
      { status: 500 }
    );
  }
  const resetUrl = `${redirectTo}?token_hash=${encodeURIComponent(hashedToken)}`;

  const firstName =
    (data.user?.user_metadata?.first_name as string | undefined) ??
    (data.user?.user_metadata?.firstName as string | undefined) ??
    "";

  // Preferred path: our own domain via Brevo.
  if (emailConfigured()) {
    const result = await sendBrevoEmail({
      toEmail: email,
      toName: firstName || email,
      subject: "Reset your NorthPay password",
      html: buildPasswordResetEmailHtml({ firstName, resetUrl }),
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: "Couldn't send the reset email. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  // Fallback (Brevo not configured): let Supabase send its default email so
  // the flow still works.
  const anon = createClient(url, anonKey);
  const { error: fallbackErr } = await anon.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (fallbackErr) {
    return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
