import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";

// Long ban ≈ 100 years — Supabase has no "permanent", so this is the idiom.
const SUSPEND_DURATION = "876000h";

/** Suspend / un-suspend a user. Body: { action: "suspend" | "unsuspend" }. */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const gate = await requireAdmin(request);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (params.id === gate.userId) {
    return NextResponse.json(
      { error: "You can't suspend your own admin account." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: "suspend" | "unsuspend";
  };
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
