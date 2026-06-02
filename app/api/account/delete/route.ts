import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Permanently deletes the calling user's account.
 *
 * Flow:
 *  1. Client sends its access token in the Authorization header.
 *  2. We verify it with the anon client to resolve the user id.
 *  3. An admin client (secret key) deletes the auth user. Because every
 *     table references auth.users(id) ON DELETE CASCADE, all of the
 *     user's data (profile, employees, payroll runs, remittances) is
 *     wiped automatically in the same transaction.
 *
 * The secret key NEVER reaches the browser — it's a server-only env var.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !anonKey || !secretKey) {
    return NextResponse.json(
      { error: "Server not configured for account deletion." },
      { status: 500 }
    );
  }

  // Extract the bearer token
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Verify the token → resolve the user
  const anon = createClient(url, anonKey);
  const {
    data: { user },
    error: userErr,
  } = await anon.auth.getUser(token);

  if (userErr || !user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  // Admin delete — cascades to all owned rows
  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
