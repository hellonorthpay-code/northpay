import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────
// Traffic beacon. Public by necessity — every visitor posts here once per
// page view. Stores no personal data (see 0004_page_views.sql).
// ─────────────────────────────────────────────────────────────────────────

/** Obvious crawlers. Counting them as audience makes every number a lie. */
const BOT = /bot|crawler|spider|crawling|slurp|bingpreview|headless|lighthouse|pingdom|curl|wget|python-requests|axios|monitor|preview|facebookexternalhit|whatsapp|telegram|semrush|ahrefs|dataprovider|scrapy/i;

function deviceOf(ua: string): string {
  if (/ipad|tablet|playbook|silk/i.test(ua)) return "Tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return "Mobile";
  return "Desktop";
}

function browserOf(ua: string): string {
  // Order matters — Edge and Chrome both claim "Chrome", Chrome claims "Safari".
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/chrome\/|crios/i.test(ua)) return "Chrome";
  if (/safari\//i.test(ua)) return "Safari";
  return "Other";
}

function osOf(ua: string): string {
  if (/iphone|ipad|ipod|ios/i.test(ua)) return "iOS";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/android/i.test(ua)) return "Android";
  if (/windows/i.test(ua)) return "Windows";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}

/** Host only — a full referrer URL can carry search terms and personal data. */
function referrerHost(ref: string | undefined, selfHost: string): string | null {
  if (!ref) return null;
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "");
    if (!h || h === selfHost.replace(/^www\./, "")) return null; // internal nav
    return h;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  // Silent no-op rather than an error: a failed beacon must never surface to
  // a visitor or block a page.
  if (!url || !secretKey) return NextResponse.json({ ok: true });

  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return NextResponse.json({ ok: true });

  // Honour Do Not Track. Costs a few data points; keeps the promise.
  if (request.headers.get("dnt") === "1") return NextResponse.json({ ok: true });

  let body: { path?: string; referrer?: string };
  try {
    body = (await request.json()) as { path?: string; referrer?: string };
  } catch {
    return NextResponse.json({ ok: true });
  }

  const path = (body.path ?? "").slice(0, 512);
  if (!path.startsWith("/")) return NextResponse.json({ ok: true });

  const h = request.headers;
  const ip =
    (h.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "0.0.0.0";

  // Daily-rotating, non-reversible visitor id. The date in the input means a
  // hash cannot be correlated across days; the secret means it cannot be
  // brute-forced from an IP range. The raw IP is never written anywhere.
  const salt = process.env.CRON_SECRET ?? process.env.SUPABASE_SECRET_KEY ?? "np";
  const visitorHash = crypto
    .createHash("sha256")
    .update(`${ip}|${ua}|${new Date().toISOString().slice(0, 10)}|${salt}`)
    .digest("hex")
    .slice(0, 32);

  const selfHost = (() => {
    try {
      return new URL(request.url).hostname;
    } catch {
      return "thenorthpay.com";
    }
  })();

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await admin.from("page_views").insert({
    path,
    referrer_host: referrerHost(body.referrer, selfHost),
    country: h.get("x-vercel-ip-country") ?? null,
    city: (() => {
      const c = h.get("x-vercel-ip-city");
      // Vercel percent-encodes city names ("New%20York").
      return c ? decodeURIComponent(c) : null;
    })(),
    device: deviceOf(ua),
    browser: browserOf(ua),
    os: osOf(ua),
    visitor_hash: visitorHash,
  });

  return NextResponse.json({ ok: true });
}
