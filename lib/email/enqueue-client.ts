"use client";

import { supabase } from "@/lib/supabase/client";
import { paystubPDFBase64 } from "@/lib/pdf/paystub";
import { formatDate } from "@/lib/utils";
import { buildPaystubEmailHtml, buildPayrollSummaryEmailHtml } from "./template";
import type { CompanySettings, PayrollRun } from "@/lib/payroll/types";

export interface EnqueueOutcome {
  /** False when Brevo isn't configured yet → caller should fall back. */
  configured: boolean;
  queued: number;
}

interface QueueItem {
  toEmail: string;
  toName: string;
  replyTo?: string;
  subject: string;
  html: string;
  pdfBase64?: string;
  pdfFilename?: string;
}

/** Apple-style HTML email for a single paystub (shared template). */
function buildHtml(
  firstName: string,
  company: { operatingName: string },
  line: PayrollRun["lines"][number]
): string {
  return buildPaystubEmailHtml({
    firstName,
    companyName: company.operatingName,
    range: `${formatDate(line.periodStart)} – ${formatDate(line.periodEnd)}`,
    gross: line.grossPay,
    taxes: line.federalTax + line.provincialTax,
    cpp: line.cppEmployee + line.cpp2Employee,
    ei: line.eiEmployee,
    net: line.netPay,
    hasAttachment: true,
  });
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

  // The employer's account email — used as Reply-To on paystubs and as the
  // recipient of the per-run summary.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  const employerEmail = session?.user?.email || undefined;

  const items: QueueItem[] = run.lines
    .filter((l) => l.employee.email && l.netPay > 0)
    .map((line) => {
      const { base64, filename } = paystubPDFBase64(line, company, allRuns);
      return {
        toEmail: line.employee.email,
        toName: `${line.employee.firstName} ${line.employee.lastName}`.trim(),
        replyTo: replyTo ?? employerEmail,
        subject: `Your paystub — ${formatDate(line.periodStart)} to ${formatDate(line.periodEnd)}`,
        html: buildHtml(line.employee.firstName, company, line),
        pdfBase64: base64,
        pdfFilename: filename,
      };
    });

  // Number of actual employee paystubs — what the UI reports ("N on the way").
  const employeeCount = items.length;

  // One summary email to the employer listing every paid employee. Costs a
  // single email per run (vs BCC-ing every paystub, which would double usage).
  if (employerEmail) {
    const paid = run.lines.filter((l) => l.netPay > 0);
    if (paid.length > 0) {
      const range = `${formatDate(run.periodStart)} – ${formatDate(run.periodEnd)}`;
      items.push({
        toEmail: employerEmail,
        toName: company.operatingName,
        replyTo: undefined,
        subject: `Payroll summary — ${range}`,
        html: buildPayrollSummaryEmailHtml({
          companyName: company.operatingName,
          range,
          rows: paid.map((l) => ({
            name: `${l.employee.firstName} ${l.employee.lastName}`.trim(),
            net: l.netPay,
          })),
          totalNet: paid.reduce((sum, l) => sum + l.netPay, 0),
          emailedCount: employeeCount,
        }),
        pdfBase64: undefined,
        pdfFilename: undefined,
      });
    }
  }

  if (items.length === 0) return { configured: true, queued: 0 };

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
  // Report employee paystubs to the UI (exclude the employer summary email).
  return { configured: true, queued: employeeCount };
}
