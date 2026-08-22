import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { billingConfigured, findPromotionCode } from "@/lib/billing/stripe";

// ─────────────────────────────────────────────────────────────────────────
// Validate a promo code before checkout.
//
//   POST { code: "LAUNCH20" } → { valid, label?, code? }
//
// Requires a signed-in user so codes can't be brute-forced by anyone who
// finds the endpoint, and the response never distinguishes "wrong code" from
// "expired" / "inactive" — every failure reads the same.
// ─────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  if (!billingConfigured()) {
    return NextResponse.json({ valid: false }, { status: 503 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  const token = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token)
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const anon = createClient(url, anonKey);
  const {
    data: { user },
    error,
  } = await anon.auth.getUser(token);
  if (error || !user)
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  let body: { code?: string };
  try {
    body = (await request.json()) as { code?: string };
  } catch {
    return NextResponse.json({ valid: false });
  }

  const code = (body.code ?? "").trim();
  if (!code || code.length > 64) return NextResponse.json({ valid: false });

  try {
    const promo = await findPromotionCode(code);
    if (!promo) return NextResponse.json({ valid: false });

    const forever = promo.duration === "forever";
    const months = promo.durationInMonths;
    const detail = forever
      ? "applies to every renewal"
      : months && months > 1
        ? `for your first ${months} months`
        : "on your first month";

    return NextResponse.json({
      valid: true,
      code: promo.code,
      label: promo.label,
      detail,
    });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
