"use client";

import { supabase } from "@/lib/supabase/client";
import { paystubPDFBase64 } from "@/lib/pdf/paystub";
import { formatDate } from "@/lib/utils";
import type { CompanySettings, PayrollRun } from "@/lib/payroll/types";

export interface EnqueueOutcome {
  /** False when Brevo isn't configured yet → caller should fall back. */
  configured: boolean;
  queued: number;
}

/** Plain-text-ish HTML body for a single paystub email. */
function buildHtml(
  firstName: string,
  company: { operatingName: string },
  line: PayrollRun["lines"][number]
): string {
  const range = `${formatDate(line.periodStart)} – ${formatDate(line.periodEnd)}`;
  const money = (n: number) =>
    `$${n.toLocaleString("en-CA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  const taxes = line.federalTax + line.provincialTax;
  const cpp = line.cppEmployee + line.cpp2Employee;

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#16161a;">
    <p style="font-size:15px;">Hi ${firstName},</p>
    <p style="font-size:14px;line-height:1.6;color:#3a3a40;">
      Your paystub for <strong>${range}</strong> is attached as a PDF.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:18px 0;">
      <tr><td style="padding:6px 0;color:#6e6e76;">Gross pay</td><td style="padding:6px 0;text-align:right;">${money(line.grossPay)}</td></tr>
      <tr><td style="padding:6px 0;color:#6e6e76;">Income tax</td><td style="padding:6px 0;text-align:right;">${money(taxes)}</td></tr>
      <tr><td style="padding:6px 0;color:#6e6e76;">CPP</td><td style="padding:6px 0;text-align:right;">${money(cpp)}</td></tr>
      <tr><td style="padding:6px 0;color:#6e6e76;">EI</td><td style="padding:6px 0;text-align:right;">${money(line.eiEmployee)}</td></tr>
      <tr><td style="padding:10px 0 0;border-top:1px solid #e6e6ea;font-weight:600;">Net deposit</td><td style="padding:10px 0 0;border-top:1px solid #e6e6ea;text-align:right;font-weight:600;">${money(line.netPay)}</td></tr>
    </table>
    <p style="font-size:13px;color:#3a3a40;">Best regards,<br/>${company.operatingName}</p>
    <p style="font-size:11px;color:#9a9aa2;margin-top:24px;">
      Sent via NorthPay on behalf of ${company.operatingName}. Please verify all
      figures against your own records.
    </p>
  </div>`;
}

/**
 * Generate a paystub PDF per emailable employee, then hand the batch to the
 * server queue. Returns { configured:false } when Brevo isn't set up yet so
 * the caller can fall back to the old mailto behaviour.
 */
export async function enqueuePaystubEmails(
  run: PayrollRun,
  company: CompanySettings,
  allRuns: PayrollRun[]
): Promise<EnqueueOutcome> {
  // Employer email (if recorded) becomes the Reply-To so employees reply to
  // their employer, not to NorthPay.
  const replyTo =
    (company as { payrollEmail?: string; email?: string }).payrollEmail ||
    (company as { payrollEmail?: string; email?: string }).email ||
    undefined;

  const items = run.lines
    .filter((l) => l.employee.email && l.netPay > 0)
    .map((line) => {
      const { base64, filename } = paystubPDFBase64(line, company, allRuns);
      return {
        toEmail: line.employee.email,
        toName: `${line.employee.firstName} ${line.employee.lastName}`.trim(),
        replyTo,
        subject: `Your paystub — ${formatDate(line.periodStart)} to ${formatDate(line.periodEnd)}`,
        html: buildHtml(line.employee.firstName, company, line),
        pdfBase64: base64,
        pdfFilename: filename,
      };
    });

  if (items.length === 0) return { configured: true, queued: 0 };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";

  const res = await fetch("/api/email/enqueue", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ items }),
  });

  if (!res.ok) {
    throw new Error(`Could not queue paystub emails (${res.status}).`);
  }
  const json = (await res.json()) as { configured?: boolean; queued?: number };
  if (json.configured === false) return { configured: false, queued: 0 };
  return { configured: true, queued: json.queued ?? items.length };
}
