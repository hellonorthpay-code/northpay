import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendBrevoEmail, emailConfigured } from "@/lib/email/brevo";

// Stay safely under Brevo's free 300/day cap. We never send more than this
// many in a rolling 24h window across the whole platform; overflow waits for
// the window to roll forward (the "within 24 hours" promise).
const DAILY_CAP = Number(process.env.EMAIL_DAILY_CAP ?? 280);
// How many to send per drain invocation. Keep modest so a single cron tick
// finishes quickly within serverless time limits.
const BATCH = Number(process.env.EMAIL_DRAIN_BATCH ?? 40);
const MAX_ATTEMPTS = 3;
const DAY_MS = 86_400_000;

/**
 * Drain a batch of the email queue. Triggered by a scheduled cron (e.g.
 * cron-job.org or Supabase pg_cron) that calls this every few minutes with
 * the shared secret. GET and POST both work so any cron service can hit it.
 */
async function handle(request: Request) {
  // ── Auth: shared cron secret (header or ?secret=) ──
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set." }, { status: 500 });
  }
  const provided =
    request.headers.get("x-cron-secret") ||
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim() ||
    new URL(request.url).searchParams.get("secret") ||
    "";
  if (provided !== secret) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (!emailConfigured()) {
    return NextResponse.json({ error: "Email not configured." }, { status: 503 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }
  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Proactive daily-cap guard ──
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count: sentLast24h } = await admin
    .from("email_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", since);

  const remaining = DAILY_CAP - (sentLast24h ?? 0);
  if (remaining <= 0) {
    return NextResponse.json({
      sent: 0,
      deferred: "daily cap reached",
      sentLast24h: sentLast24h ?? 0,
    });
  }

  const take = Math.min(BATCH, remaining);

  // ── Pull due pending rows ──
  const nowIso = new Date().toISOString();
  const { data: due, error: selErr } = await admin
    .from("email_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("created_at", { ascending: true })
    .limit(take);

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ sent: 0, deferred: 0, failed: 0, pending: 0 });
  }

  let sent = 0;
  let failed = 0;
  let deferred = 0;

  for (const row of due) {
    const result = await sendBrevoEmail({
      toEmail: row.to_email,
      toName: row.to_name ?? undefined,
      replyTo: row.reply_to ?? undefined,
      subject: row.subject,
      html: row.html,
      attachmentBase64: row.pdf_base64 ?? undefined,
      attachmentName: row.pdf_filename ?? undefined,
    });

    if (result.ok) {
      // Clear the (heavy) base64 attachment once sent to reclaim space.
      await admin
        .from("email_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          pdf_base64: null,
          last_error: null,
        })
        .eq("id", row.id);
      sent++;
      continue;
    }

    if (result.rateLimited) {
      // Brevo throttled us — stop this run and retry the rest in ~1h.
      await admin
        .from("email_queue")
        .update({
          scheduled_for: new Date(Date.now() + 60 * 60_000).toISOString(),
          last_error: "rate-limited",
        })
        .eq("id", row.id);
      deferred++;
      break;
    }

    // Hard failure — back off and eventually give up.
    const attempts = (row.attempts ?? 0) + 1;
    const giveUp = attempts >= MAX_ATTEMPTS;
    await admin
      .from("email_queue")
      .update({
        status: giveUp ? "failed" : "pending",
        attempts,
        last_error: (result.error ?? "send failed").slice(0, 500),
        scheduled_for: giveUp
          ? row.scheduled_for
          : new Date(Date.now() + 15 * 60_000).toISOString(),
      })
      .eq("id", row.id);
    failed += giveUp ? 1 : 0;
    deferred += giveUp ? 0 : 1;
  }

  return NextResponse.json({ sent, deferred, failed, batch: due.length });
}

export async function GET(request: Request) {
  return handle(request);
}
export async function POST(request: Request) {
  return handle(request);
}
