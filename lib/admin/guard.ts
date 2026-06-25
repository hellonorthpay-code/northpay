import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only admin gate. NEVER import this into client code — it reads the
 * Supabase secret key.
 *
 * Flow (mirrors app/api/account/delete):
 *   1. Read the caller's bearer token.
 *   2. Verify it with the anon client to resolve the user.
 *   3. Check the user's email against the ADMIN_EMAILS allowlist.
 *   4. Only then hand back an admin (secret-key) client for elevated reads.
 *
 * Admins are configured via the ADMIN_EMAILS env var (comma-separated),
 * e.g. ADMIN_EMAILS="ray@example.com,owner@example.com". The secret key and
 * the allowlist are both server-only — neither reaches the browser.
 */
export interface AdminGuardOk {
  ok: true;
  admin: SupabaseClient;
  userId: string;
  email: string;
}
export interface AdminGuardFail {
  ok: false;
  status: number;
  error: string;
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdmin(
  request: Request
): Promise<AdminGuardOk | AdminGuardFail> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !anonKey || !secretKey) {
    return { ok: false, status: 500, error: "Server not configured." };
  }

  const token = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return { ok: false, status: 401, error: "Not authenticated." };

  const anon = createClient(url, anonKey);
  const {
    data: { user },
    error,
  } = await anon.auth.getUser(token);
  if (error || !user) {
    return { ok: false, status: 401, error: "Invalid session." };
  }

  const email = (user.email ?? "").toLowerCase();
  const allow = adminEmails();
  if (!email || allow.length === 0 || !allow.includes(email)) {
    return { ok: false, status: 403, error: "Not authorized." };
  }

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { ok: true, admin, userId: user.id, email };
}
