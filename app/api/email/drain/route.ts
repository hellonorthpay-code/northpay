import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { emailConfigured } from "@/lib/email/brevo";
import { drainQueue } from "@/lib/email/drain-core";

/**
 * Drain a batch of the email queue. Triggered by a scheduled cron (e.g.
 * cron-job.org or Supabase pg_cron) that calls this every few minutes with
 * the shared secret. Acts as a backstop — enqueue already drains immediately.
 * GET and POST both work so any cron service can hit it.
 */
async function handle(request: Request) {
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

  try {
    const result = await drainQueue(admin);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}
export async function POST(request: Request) {
  return handle(request);
}
