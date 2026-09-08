import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import type { AdminLead, AdminLeads } from "@/lib/admin/types";

// ─────────────────────────────────────────────────────────────────────────
// Sample-paystub leads: everyone who asked for a paystub by email.
//
// Reads the sample_requests ledger written by /api/sample-paystub. The
// ip_hash column is deliberately NOT selected — it exists for rate limiting,
// not for looking at people.
// ─────────────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const MAX_ROWS = 2000;

interface Row {
  id: string;
  created_at: string;
  email: string;
  first_name: string | null;
  business_name: string | null;
  province: string | null;
  pay_frequency: string | null;
  hourly_rate: number | null;
  hours: number | null;
  net_pay: number | null;
}

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { admin } = gate;

  const rows: Row[] = [];
  for (let from = 0; from < MAX_ROWS; from += 1000) {
    const { data, error } = await admin
      .from("sample_requests")
      .select(
        "id, created_at, email, first_name, business_name, province, pay_frequency, hourly_rate, hours, net_pay"
      )
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) {
      // Table missing = migration not run. Say so rather than failing the page.
      return NextResponse.json({
        ready: false,
        message: error.message,
      } satisfies Partial<AdminLeads>);
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as Row[]));
    if (data.length < 1000) break;
  }

  const now = Date.now();
  const leads: AdminLead[] = rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    email: r.email,
    name: r.first_name ?? "",
    businessName: r.business_name ?? "",
    province: r.province ?? "",
    payFrequency: r.pay_frequency ?? "",
    hourlyRate: Number(r.hourly_rate ?? 0),
    hours: Number(r.hours ?? 0),
    netPay: Number(r.net_pay ?? 0),
  }));

  const payload: AdminLeads = {
    ready: true,
    total: leads.length,
    // Someone who tries twice is one lead, not two.
    uniqueEmails: new Set(leads.map((l) => l.email.toLowerCase())).size,
    last7: leads.filter((l) => now - new Date(l.createdAt).getTime() <= 7 * DAY)
      .length,
    leads,
  };
  return NextResponse.json(payload);
}
