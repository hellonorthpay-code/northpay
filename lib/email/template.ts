// ─────────────────────────────────────────────────────────────────────────
// Apple-style paystub email template. Pure + isomorphic (no browser or
// Node-only APIs) so it can be used from the browser enqueue path AND from
// server routes (e.g. the test endpoint).
//
// Table-based layout with fully inline styles for broad email-client support
// (Gmail strips <style>/<head>). Visual language mirrors the app: SF system
// font, soft #f5f5f7 canvas, a white rounded card, a hero "Net deposit"
// figure, and a clean hairline-ruled breakdown.
// ─────────────────────────────────────────────────────────────────────────

const FONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const INK = "#1d1d1f";
const MUTED = "#6e6e73";
const HAIR = "#e8e8ed";

function money(n: number): string {
  return `$${n.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Apple-style password reset email — sent from noreply@thenorthpay.com via
 * Brevo. One big button, a plain-text fallback link, and expiry note.
 */
export function buildPasswordResetEmailHtml(p: {
  firstName?: string;
  resetUrl: string;
}): string {
  const hi = p.firstName?.trim() ? `Hi ${p.firstName.trim()},` : "Hi,";
  return `
<div style="margin:0;padding:32px 16px;background:#f5f5f7;font-family:${FONT};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
    <tr><td>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:22px;border:1px solid ${HAIR};">
        <tr><td style="padding:32px 32px 0;">
          <span style="display:inline-block;font-size:16px;font-weight:600;letter-spacing:-0.01em;color:${INK};">NorthPay</span>
        </td></tr>

        <tr><td style="padding:26px 32px 0;">
          <h1 style="margin:0;font-size:24px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;color:${INK};">Reset your password</h1>
          <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">
            ${hi} we received a request to reset your NorthPay password.
            Tap the button below to choose a new one.
          </p>
        </td></tr>

        <tr><td style="padding:26px 32px 0;" align="center">
          <a href="${p.resetUrl}"
             style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:-0.01em;padding:14px 36px;border-radius:999px;">
            Reset password
          </a>
        </td></tr>

        <tr><td style="padding:22px 32px 0;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
            Button not working? Copy and paste this link into your browser:<br/>
            <a href="${p.resetUrl}" style="color:${MUTED};word-break:break-all;">${p.resetUrl}</a>
          </p>
        </td></tr>

        <tr><td style="padding:22px 32px 34px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
            This link expires in 1 hour and can be used once. If you didn't
            request this, you can safely ignore this email — your password
            won't change.
          </p>
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:20px 28px;text-align:center;">
          <p style="margin:0;font-size:11px;line-height:1.6;color:#a1a1a6;">
            Sent by NorthPay · thenorthpay.com
          </p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</div>`;
}

export interface PayrollSummaryParams {
  companyName: string;
  /** Pre-formatted pay-period range. */
  range: string;
  rows: { name: string; net: number }[];
  totalNet: number;
  /** How many paystub emails were sent to employees in this run. */
  emailedCount: number;
}

/**
 * Apple-style payroll summary email for the EMPLOYER — one per run, listing
 * every paid employee and their net. Gives the employer a record of what went
 * out without BCC-ing them on every individual paystub (which would double
 * email usage). No attachment.
 */
export function buildPayrollSummaryEmailHtml(p: PayrollSummaryParams): string {
  const co = p.companyName;

  const row = (name: string, value: string, last: boolean) => `
    <tr>
      <td style="padding:13px 0;font-size:14px;color:${INK};${last ? "" : `border-bottom:1px solid ${HAIR};`}">${name}</td>
      <td style="padding:13px 0;font-size:14px;color:${INK};text-align:right;font-variant-numeric:tabular-nums;${last ? "" : `border-bottom:1px solid ${HAIR};`}">${value}</td>
    </tr>`;

  const rowsHtml = p.rows
    .map((r, i) => row(r.name, money(r.net), i === p.rows.length - 1))
    .join("");

  return `
<div style="margin:0;padding:32px 16px;background:#f5f5f7;font-family:${FONT};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
    <tr><td>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:22px;border:1px solid ${HAIR};">
        <tr><td style="padding:32px 32px 0;">
          <span style="display:inline-block;font-size:16px;font-weight:600;letter-spacing:-0.01em;color:${INK};">NorthPay</span>
        </td></tr>

        <tr><td style="padding:26px 32px 0;">
          <h1 style="margin:0;font-size:24px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;color:${INK};">Payroll summary</h1>
          <p style="margin:6px 0 0;font-size:14px;color:${MUTED};">${p.range} · ${co}</p>
        </td></tr>

        <tr><td style="padding:26px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;border-radius:16px;">
            <tr><td style="padding:22px 24px;text-align:center;">
              <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:${MUTED};">Total net paid</p>
              <p style="margin:8px 0 0;font-size:36px;line-height:1;font-weight:600;letter-spacing:-0.02em;color:${INK};font-variant-numeric:tabular-nums;">${money(p.totalNet)}</p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:24px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${rowsHtml}
          </table>
        </td></tr>

        <tr><td style="padding:22px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;border-radius:12px;">
            <tr><td style="padding:14px 16px;font-size:13px;color:${MUTED};">
              ${p.emailedCount} paystub${p.emailedCount === 1 ? "" : "s"} emailed to employees.
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:26px 32px 34px;">
          <p style="margin:0;font-size:13px;color:${MUTED};">This is your record of the run. No action needed.</p>
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:20px 28px;text-align:center;">
          <p style="margin:0;font-size:11px;line-height:1.6;color:#a1a1a6;">
            Sent by NorthPay. Please verify all figures against your own records.
          </p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</div>`;
}

export interface PaystubEmailParams {
  firstName: string;
  companyName: string;
  /** Pre-formatted pay-period range, e.g. "Jun 13 – Jun 26, 2026". */
  range: string;
  gross: number;
  taxes: number;
  cpp: number;
  ei: number;
  net: number;
  /** When false, omit the "PDF attached" note (e.g. a preview/test send). */
  hasAttachment?: boolean;
}

export function buildPaystubEmailHtml(p: PaystubEmailParams): string {
  const co = p.companyName;
  const hasAttachment = p.hasAttachment !== false;

  const row = (label: string, value: string, last = false) => `
    <tr>
      <td style="padding:13px 0;font-size:14px;color:${MUTED};${last ? "" : `border-bottom:1px solid ${HAIR};`}">${label}</td>
      <td style="padding:13px 0;font-size:14px;color:${INK};text-align:right;font-variant-numeric:tabular-nums;${last ? "" : `border-bottom:1px solid ${HAIR};`}">${value}</td>
    </tr>`;

  const attachmentNote = hasAttachment
    ? `
        <tr><td style="padding:22px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;border-radius:12px;">
            <tr><td style="padding:14px 16px;font-size:13px;color:${MUTED};">
              Your full paystub is attached as a PDF.
            </td></tr>
          </table>
        </td></tr>`
    : "";

  return `
<div style="margin:0;padding:32px 16px;background:#f5f5f7;font-family:${FONT};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
    <tr><td>

      <!-- Card -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:22px;border:1px solid ${HAIR};">
        <tr><td style="padding:32px 32px 0;">
          <span style="display:inline-block;font-size:16px;font-weight:600;letter-spacing:-0.01em;color:${INK};">NorthPay</span>
        </td></tr>

        <tr><td style="padding:26px 32px 0;">
          <p style="margin:0;font-size:14px;color:${MUTED};">Hi ${p.firstName},</p>
          <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;color:${INK};">Your paystub is ready</h1>
          <p style="margin:6px 0 0;font-size:14px;color:${MUTED};">${p.range}</p>
        </td></tr>

        <!-- Net deposit hero -->
        <tr><td style="padding:26px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;border-radius:16px;">
            <tr><td style="padding:22px 24px;text-align:center;">
              <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:${MUTED};">Net deposit</p>
              <p style="margin:8px 0 0;font-size:36px;line-height:1;font-weight:600;letter-spacing:-0.02em;color:${INK};font-variant-numeric:tabular-nums;">${money(p.net)}</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Breakdown -->
        <tr><td style="padding:24px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${row("Gross pay", money(p.gross))}
            ${row("Income tax", "−" + money(p.taxes))}
            ${row("CPP", "−" + money(p.cpp))}
            ${row("EI", "−" + money(p.ei), true)}
          </table>
        </td></tr>
        ${attachmentNote}

        <tr><td style="padding:26px 32px 34px;">
          <p style="margin:0;font-size:14px;color:${INK};">Best regards,</p>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:${INK};">${co}</p>
        </td></tr>
      </table>

      <!-- Footer -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:20px 28px;text-align:center;">
          <p style="margin:0;font-size:11px;line-height:1.6;color:#a1a1a6;">
            Sent via NorthPay on behalf of ${co}.<br/>
            Please verify all figures against your own records.
          </p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</div>`;
}
