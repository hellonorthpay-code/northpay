import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { emailConfigured } from "@/lib/email/brevo";
import { drainQueue } from "@/lib/email/drain-core";

// Accept a generous-but-bounded batch. A single payroll run for one employer
// is a handful of paystubs; this cap just stops a malformed/abusive request
// from inserting tens of thousands of rows at once.
const MAX_ITEMS = 200;

interface EnqueueItem {
  toEmail: string;
  toName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  pdfBase64?: string;
  pdfFilename?: string;
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anonKey || !secretKey) {
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  // If Brevo isn't set up yet, tell the client so it can fall back to the
  // old mailto behaviour. This keeps things working before the domain is
  // verified, and upgrades automatically once BREVO_API_KEY is added.
  if (!emailConfigured()) {
    return NextResponse.json({ configured: false }, { status: 200 });
  }

  // ── Authenticate the caller ──
  const token = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const anon = createClient(url, anonKey);
  const {
    data: { user },
    error: authErr,
  } = await anon.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  // ── Parse + validate the batch ──
  let payload: { items?: EnqueueItem[] };
  try {
    payload = (await request.json()) as { items?: EnqueueItem[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "No items to queue." }, { status: 400 });
  }
  if (items.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `Too many items (max ${MAX_ITEMS}).` },
      { status: 400 }
    );
  }

  const rows = items
    .filter((i) => i.toEmail && i.subject && i.html)
    .map((i) => ({
      owner_id: user.id,
      to_email: i.toEmail,
      to_name: i.toName ?? null,
      reply_to: i.replyTo ?? null,
      subject: i.subject,
      html: i.html,
      pdf_base64: i.pdfBase64 ?? null,
      pdf_filename: i.pdfFilename ?? null,
      status: "pending",
    }));

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid items." }, { status: 400 });
  }

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.from("email_queue").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Drain immediately so paystubs go out within seconds of clicking "send".
  // Best-effort: if it throws or hits the daily cap, the rows stay pending
  // and the cron backstop picks them up. Never fail the enqueue over this.
  let sent = 0;
  try {
    const result = await drainQueue(admin);
    sent = result.sent;
  } catch (e) {
    console.warn("[enqueue] immediate drain failed (non-fatal):", e);
  }

  return NextResponse.json({ configured: true, queued: rows.length, sent });
}
