// ─────────────────────────────────────────────────────────────────────────
// Brevo (Sendinblue) transactional email — SERVER ONLY.
//
// Never import this into client code: it reads BREVO_API_KEY. Sends a single
// transactional email (with an optional PDF attachment) from the verified
// NorthPay sender. We use Brevo because its free tier allows 300 emails/day,
// which gives the most headroom for same-day payroll spikes.
//
// Env vars (all server-side):
//   BREVO_API_KEY        — required; enables the whole email feature
//   BREVO_SENDER_EMAIL   — e.g. noreply@thenorthpay.com (must be domain-verified)
//   BREVO_SENDER_NAME    — e.g. NorthPay
// ─────────────────────────────────────────────────────────────────────────

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export function emailConfigured(): boolean {
  return !!process.env.BREVO_API_KEY;
}

function senderEmail(): string {
  return process.env.BREVO_SENDER_EMAIL || "noreply@thenorthpay.com";
}
function senderName(): string {
  return process.env.BREVO_SENDER_NAME || "NorthPay";
}

export interface BrevoSendInput {
  toEmail: string;
  toName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  /** Optional attachment, base64-encoded content. */
  attachmentBase64?: string;
  attachmentName?: string;
}

export interface BrevoSendResult {
  ok: boolean;
  /** True when Brevo rejected us for rate/quota reasons (HTTP 429). */
  rateLimited?: boolean;
  status?: number;
  messageId?: string;
  error?: string;
}

export async function sendBrevoEmail(
  input: BrevoSendInput
): Promise<BrevoSendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: false, error: "BREVO_API_KEY not configured." };

  const body: Record<string, unknown> = {
    sender: { email: senderEmail(), name: senderName() },
    to: [{ email: input.toEmail, name: input.toName || input.toEmail }],
    subject: input.subject,
    htmlContent: input.html,
  };
  if (input.replyTo) body.replyTo = { email: input.replyTo };
  if (input.attachmentBase64 && input.attachmentName) {
    body.attachment = [
      { name: input.attachmentName, content: input.attachmentBase64 },
    ];
  }

  let res: Response;
  try {
    res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  if (res.ok) {
    const json = (await res.json().catch(() => ({}))) as {
      messageId?: string;
    };
    return { ok: true, status: res.status, messageId: json.messageId };
  }

  const text = await res.text().catch(() => "");
  return {
    ok: false,
    status: res.status,
    rateLimited: res.status === 429,
    error: text || `Brevo responded ${res.status}`,
  };
}
