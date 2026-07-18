import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook } from "@/lib/billing/stripe";

// Stripe needs the RAW body to verify the signature — never parse it first.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Verifies the signature, then upserts the subscription row
 * on checkout / renewal / cancel so /api/billing/status reflects reality.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const event = verifyWebhook(rawBody, request.headers.get("stripe-signature"));
  if (!event) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }
  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const type = event.type as string;
  const obj = (event.data as { object?: Record<string, unknown> })?.object ?? {};

  async function upsertByCustomer(customerId: string, patch: Record<string, unknown>) {
    // Find the owner row by customer id (created at checkout time).
    const { data: row } = await admin
      .from("subscriptions")
      .select("owner_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (!row?.owner_id) return;
    await admin
      .from("subscriptions")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("owner_id", row.owner_id);
  }

  try {
    if (type === "checkout.session.completed") {
      const customer = obj.customer as string;
      const subscription = obj.subscription as string;
      const userId = obj.client_reference_id as string | undefined;
      if (userId) {
        // Prefer matching by the user id we passed through checkout.
        await admin
          .from("subscriptions")
          .upsert(
            {
              owner_id: userId,
              stripe_customer_id: customer,
              stripe_subscription_id: subscription,
              status: "active",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "owner_id" }
          );
      } else if (customer) {
        await upsertByCustomer(customer, {
          stripe_subscription_id: subscription,
          status: "active",
        });
      }
    } else if (
      type === "customer.subscription.updated" ||
      type === "customer.subscription.deleted" ||
      type === "customer.subscription.created"
    ) {
      const customer = obj.customer as string;
      const status = obj.status as string;
      const periodEnd = obj.current_period_end as number | undefined;
      if (customer) {
        await upsertByCustomer(customer, {
          stripe_subscription_id: obj.id as string,
          status,
          current_period_end: periodEnd
            ? new Date(periodEnd * 1000).toISOString()
            : null,
        });
      }
    } else if (type === "invoice.payment_failed") {
      const customer = obj.customer as string;
      if (customer) await upsertByCustomer(customer, { status: "past_due" });
    }
  } catch (e) {
    // Log but 200 so Stripe doesn't hammer retries on a transient DB blip.
    console.warn("[stripe webhook] handler error:", e);
  }

  return NextResponse.json({ received: true });
}
