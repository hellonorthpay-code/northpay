import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { billingConfigured, ensureLaunchOffer, getLaunchOffer } from "@/lib/billing/stripe";
import { LAUNCH_OFFER } from "@/lib/billing/offer";

// GET  → current state of NORTHPAY60 in Stripe (never creates anything).
// POST → create it if missing, with the terms fixed in lib/billing/offer.ts.
// Admin-only. Both are idempotent and both report drift rather than hide it.

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!billingConfigured()) return NextResponse.json({ configured: false });
  try {
    return NextResponse.json({ configured: true, ...(await getLaunchOffer(LAUNCH_OFFER)) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!billingConfigured()) return NextResponse.json({ configured: false }, { status: 503 });
  try {
    return NextResponse.json({ configured: true, ...(await ensureLaunchOffer(LAUNCH_OFFER)) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
