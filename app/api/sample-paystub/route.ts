import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { runPayroll } from "@/lib/payroll/engine";
import { OVERTIME_WEEKLY_HOURS } from "@/lib/payroll/constants";
import {
  PROVINCE_NAMES,
  SUPPORTED_PROVINCES,
  type CompanySettings,
  type Employee,
  type PayFrequency,
  type ProvinceCode,
} from "@/lib/payroll/types";
import { paystubPDFBase64 } from "@/lib/pdf/paystub";
import { emailConfigured } from "@/lib/email/brevo";
import { drainQueue } from "@/lib/email/drain-core";
import { buildSamplePaystubEmailHtml } from "@/lib/email/template";
import { formatDate } from "@/lib/utils";
import {
  SAMPLE_FREQUENCIES,
  type SamplePaystubFailure,
  type SamplePaystubRequest,
  type SamplePaystubResult,
} from "@/lib/sample-paystub";

// ─────────────────────────────────────────────────────────────────────────
// "Try a sample paystub" — public by necessity: it's the landing page's
// lead funnel, so there is no session to check. That makes abuse control
// the design centre of this route, because every successful request sends
// an email that counts against the Brevo daily cap that real customers'
// paystubs depend on.
//
//   • Honeypot field — bots fill it, humans never see it.
//   • Per-email and per-IP caps over 24h, backed by sample_requests.
//   • Strict input bounds, so the engine only ever sees plausible numbers.
//
// The paystub itself is computed by the production payroll engine and the
// production PDF renderer. Nothing here is a mock: what lands in the inbox
// is exactly what an employee of that business would receive.
// ─────────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const MAX_PER_EMAIL_24H = 2;
const MAX_PER_IP_24H = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Days a period spans, for building a realistic recent pay period. */
const PERIOD_DAYS: Record<PayFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  semimonthly: 15,
  monthly: 30,
  semiannually: 182,
  annually: 365,
};

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error } satisfies SamplePaystubFailure, {
    status,
  });
}

function cleanName(s: unknown, max = 40): string {
  // Strip control characters and angle brackets (these strings are rendered
  // into an email and a PDF); keep everything else, digits included.
  return String(s ?? "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .trim()
    .slice(0, max);
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return fail("Server not configured.", 500);

  let body: Partial<SamplePaystubRequest>;
  try {
    body = (await request.json()) as Partial<SamplePaystubRequest>;
  } catch {
    return fail("Invalid request.");
  }

  // ── Honeypot: a filled "website" field means a bot. Answer as if it
  //    worked so the bot learns nothing, and send nothing. ──
  if (body.website) {
    return NextResponse.json({ ok: true, emailed: true, periodLabel: "", gross: 0, federalTax: 0, provincialTax: 0, cpp: 0, ei: 0, net: 0 });
  }

  // ── Validate, with bounds that keep the engine in plausible territory ──
  const firstName = cleanName(body.firstName);
  const lastName = cleanName(body.lastName);
  const businessName = cleanName(body.businessName, 60);
  const province = String(body.province ?? "").toUpperCase() as ProvinceCode;
  const payFrequency = String(body.payFrequency ?? "biweekly") as PayFrequency;
  const hourlyRate = Number(body.hourlyRate);
  const hours = Number(body.hours);
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!firstName || !lastName) return fail("Please enter a first and last name.");
  if (!businessName) return fail("Please enter a business name.");
  if (!SUPPORTED_PROVINCES.includes(province))
    return fail("Please choose a supported province.");
  if (!SAMPLE_FREQUENCIES.some((f) => f.id === payFrequency))
    return fail("Please choose a pay frequency.");
  if (!Number.isFinite(hourlyRate) || hourlyRate < 1 || hourlyRate > 500)
    return fail("Hourly rate should be between $1 and $500.");
  if (!Number.isFinite(hours) || hours <= 0 || hours > 400)
    return fail("Hours should be between 1 and 400 for the period.");
  if (!EMAIL_RE.test(email) || email.length > 254)
    return fail("That email address doesn't look right.");

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Rate limits. The IP is hashed with a server secret before it is
  //    compared or stored; the raw address is never written. ──
  const ip =
    (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "0.0.0.0";
  const ipHash = crypto
    .createHash("sha256")
    .update(`${ip}|${process.env.CRON_SECRET ?? secretKey}`)
    .digest("hex")
    .slice(0, 32);
  const since = new Date(Date.now() - DAY_MS).toISOString();

  const [{ count: byEmail }, { count: byIp }] = await Promise.all([
    admin
      .from("sample_requests")
      .select("*", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since),
    admin
      .from("sample_requests")
      .select("*", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since),
  ]);
  if ((byEmail ?? 0) >= MAX_PER_EMAIL_24H || (byIp ?? 0) >= MAX_PER_IP_24H) {
    return fail(
      "You've requested a few samples already today. Check your inbox — or sign up to run payroll for real.",
      429
    );
  }

  // ── Build a real employee and company, then let the real engine run ──
  const today = new Date();
  const periodEnd = today.toISOString().slice(0, 10);
  const periodStart = new Date(
    today.getTime() - (PERIOD_DAYS[payFrequency] - 1) * DAY_MS
  )
    .toISOString()
    .slice(0, 10);
  const nowIso = today.toISOString();

  const employee: Employee = {
    id: "SAMPLE-0001",
    firstName,
    lastName,
    email,
    sin: "*** *** ***",
    province,
    employmentType: "hourly",
    hourlyRate,
    payFrequency,
    vacationPercent: 4,
    vacationMode: "payout",
    standardWeeklyHours: 40,
    overtimeThresholdHours: OVERTIME_WEEKLY_HOURS[province],
    startDate: periodStart,
    createdAt: nowIso,
  };

  const company: CompanySettings = {
    legalName: businessName,
    operatingName: businessName,
    businessNumber: "SAMPLE",
    defaultProvince: province,
    defaultPayFrequency: payFrequency,
    address: "Sample paystub",
    city: PROVINCE_NAMES[province],
    postalCode: "",
  };

  const run = runPayroll({
    employees: [employee],
    // payOvertime: hours past the provincial threshold are paid at 1.5×,
    // exactly as they would be in a real run.
    inputs: [{ employeeId: employee.id, hoursWorked: hours, payOvertime: true }],
    ytdByEmployee: new Map(),
    periodStart,
    periodEnd,
    payDate: periodEnd,
    // Finalized so the PDF's year-to-date column reflects this period —
    // what a first paystub of the year looks like.
    status: "finalized",
    runId: `sample-${Date.now()}`,
    createdAt: nowIso,
  });
  const line = run.lines[0];

  const periodLabel = `${formatDate(periodStart)} – ${formatDate(periodEnd)}`;
  const result: SamplePaystubResult = {
    ok: true,
    emailed: false,
    periodLabel,
    gross: line.grossPay,
    federalTax: line.federalTax,
    provincialTax: line.provincialTax,
    cpp: line.cppEmployee + line.cpp2Employee,
    ei: line.eiEmployee,
    net: line.netPay,
  };

  // ── Deliver: the production paystub PDF, through the production queue ──
  // The figures above are already computed; nothing past this point may fail
  // the request. A PDF or queue error degrades to `emailed: false` and the
  // visitor still sees their numbers.
  if (emailConfigured()) {
    try {
    const { base64, filename } = paystubPDFBase64(line, company, [run]);
    const origin = (() => {
      try {
        return new URL(request.url).origin;
      } catch {
        return "https://www.thenorthpay.com";
      }
    })();

    const { error } = await admin.from("email_queue").insert({
      owner_id: null,
      to_email: email,
      to_name: `${firstName} ${lastName}`,
      reply_to: null,
      subject: `Your sample paystub from NorthPay — ${periodLabel}`,
      html: buildSamplePaystubEmailHtml({
        firstName,
        businessName,
        range: periodLabel,
        provinceName: PROVINCE_NAMES[province],
        gross: line.grossPay,
        federalTax: line.federalTax,
        provincialTax: line.provincialTax,
        cpp: line.cppEmployee + line.cpp2Employee,
        ei: line.eiEmployee,
        net: line.netPay,
        appUrl: `${origin}/dashboard`,
      }),
      pdf_base64: base64,
      pdf_filename: filename.replace(/^paystub-/, "sample-paystub-"),
      status: "pending",
    });

    if (!error) {
      result.emailed = true;
      // Best-effort immediate send; the cron backstop covers a miss.
      try {
        await drainQueue(admin);
      } catch (e) {
        console.warn("[sample-paystub] immediate drain failed (non-fatal):", e);
      }
    } else {
      console.warn("[sample-paystub] queue insert failed:", error.message);
    }
    } catch (e) {
      console.warn("[sample-paystub] delivery failed (figures still returned):", e);
    }
  }

  // ── Record the request (lead + rate-limit ledger) ──
  await admin.from("sample_requests").insert({
    email,
    ip_hash: ipHash,
    first_name: firstName,
    business_name: businessName,
    province,
    pay_frequency: payFrequency,
    hourly_rate: hourlyRate,
    hours,
    net_pay: line.netPay,
  });

  return NextResponse.json(result);
}
