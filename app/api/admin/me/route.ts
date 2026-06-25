import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";

/** Lightweight check the client uses to decide whether to show the Admin tab.
 *  Returns { isAdmin } — never leaks data, just a boolean. */
export async function GET(request: Request) {
  const res = await requireAdmin(request);
  return NextResponse.json({ isAdmin: res.ok });
}
