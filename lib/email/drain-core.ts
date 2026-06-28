// ─────────────────────────────────────────────────────────────────────────
// Shared queue-drain logic — SERVER ONLY.
//
// Used both by the cron endpoint (/api/email/drain) and immediately after
// enqueue (/api/email/enqueue) so paystubs go out within seconds of clicking
// "send", with the cron acting as a backstop for retries and overflow.
// ─────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendBrevoEmail } from "./brevo";

const DAY_MS = 86_400_000;
const MAX_ATTEMPTS = 3;

export interface DrainResult {
  sent: number;
  deferred: number;
  failed: number;
  batch: number;
  note?: string;
}

export async function drainQueue(
  admin: SupabaseClient,
  opts?: { batch?: number; dailyCap?: number }
): Promise<DrainResult> {
  const dailyCap = opts?.dailyCap ?? Number(process.env.EMAIL_DAILY_CAP ?? 280);
  const batch = opts?.batch ?? Number(process.env.EMAIL_DRAIN_BATCH ?? 40);

  // ── Proactive daily-cap guard: never exceed the free 300/day tier ──
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count: sentLast24h } = await admin
    .from("email_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", since);

  const remaining = dailyCap - (sentLast24h ?? 0);
  if (remaining <= 0) {
    return { sent: 0, deferred: 0, failed: 0, batch: 0, note: "daily cap reached" };
  }

  const take = Math.min(batch, remaining);
  const nowIso = new Date().toISOString();
  const { data: due, error: selErr } = await admin
    .from("email_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("created_at", { ascending: true })
    .limit(take);

  if (selErr) throw new Error(selErr.message);
  if (!due || due.length === 0) {
    return { sent: 0, deferred: 0, failed: 0, batch: 0 };
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
      // Brevo throttled us — stop and retry the rest in ~1h.
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

  return { sent, deferred, failed, batch: due.length };
}
