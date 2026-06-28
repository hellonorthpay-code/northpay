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
