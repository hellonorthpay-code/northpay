import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";

// Long ban ≈ 100 years — Supabase has no "permanent", so this is the idiom.
const SUSPEND_DURATION = "876000h";

type Action = "suspend" | "unsuspend" | "grant_lifetime" | "revoke_lifetime";

/**
 * Admin actions on one user. Body: { action }.
 *   suspend / unsuspend           — ban or restore sign-in
 *   grant_lifetime / revoke_lifetime — free access forever, no billing
 *
 * Lifetime access lives in app_metadata: only the service role can write
 * it, so a user can't grant it to themselves from the browser.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const gate = await requireAdmin(request);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const body = (await request.json().catch(() => ({}))) as {
    action?: Action;
  };

  if (body.action === "grant_lifetime" || body.action === "revoke_lifetime") {
    const { data: found, error: getErr } =
      await gate.admin.auth.admin.getUserById(params.id);
    if (getErr || !found?.user) {
      return NextResponse.json(
        { error: getErr?.message ?? "User not found." },
        { status: 404 }
      );
    }
    const grant = body.action === "grant_lifetime";
    const { error } = await gate.admin.auth.admin.updateUserById(params.id, {
      app_metadata: {
        ...(found.user.app_metadata ?? {}),
        lifetime_free: grant,
        lifetime_free_at: grant ? new Date().toISOString() : null,
      },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (params.id === gate.userId) {
    return NextResponse.json(
      { error: "You can't suspend your own admin account." },
      { status: 400 }
    );
  }
  const ban_duration = body.action === "unsuspend" ? "none" : SUSPEND_DURATION;

  const { error } = await gate.admin.auth.admin.updateUserById(params.id, {
    ban_duration,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Permanently delete a user. Cascades to all their data via FK ON DELETE. */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const gate = await requireAdmin(request);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (params.id === gate.userId) {
    return NextResponse.json(
      { error: "You can't delete your own admin account here." },
      { status: 400 }
    );
  }

  const { error } = await gate.admin.auth.admin.deleteUser(params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
