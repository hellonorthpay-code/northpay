// ─────────────────────────────────────────────────────────────────────────
// "Try a sample paystub" — shapes shared by the landing wizard and the API.
// Isomorphic: no browser or Node-only imports.
// ─────────────────────────────────────────────────────────────────────────

import type { PayFrequency, ProvinceCode } from "@/lib/payroll/types";

/** The four frequencies a visitor can pick. Semi-annual/annual are omitted —
 *  nobody trying the product is paid twice a year. */
export const SAMPLE_FREQUENCIES: Array<{ id: PayFrequency; label: string }> = [
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Bi-weekly" },
  { id: "semimonthly", label: "Semi-monthly" },
  { id: "monthly", label: "Monthly" },
];

export interface SamplePaystubRequest {
  firstName: string;
  lastName: string;
  businessName: string;
  province: ProvinceCode;
  payFrequency: PayFrequency;
  hourlyRate: number;
  hours: number;
  email: string;
  /** Honeypot — must be empty. Bots fill every field. */
  website?: string;
}

export interface SamplePaystubResult {
  ok: true;
  /** False when the email provider isn't configured; figures still returned. */
  emailed: boolean;
  /**
   * Coarse, non-sensitive explanation when `emailed` is false, so a failed
   * delivery can be diagnosed from the response instead of server logs:
   *   email_not_configured · queue_insert_failed · pdf_failed · queued_drain_failed
   */
  reason?: string;
  periodLabel: string;
  gross: number;
  federalTax: number;
  provincialTax: number;
  cpp: number;
  ei: number;
  net: number;
}

export interface SamplePaystubFailure {
  ok: false;
  error: string;
}

/** Client helper — never throws for a handled failure; the modal shows `error`. */
export async function requestSamplePaystub(
  body: SamplePaystubRequest
): Promise<SamplePaystubResult | SamplePaystubFailure> {
  try {
    const res = await fetch("/api/sample-paystub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as SamplePaystubResult | SamplePaystubFailure;
    if (!res.ok && !("error" in json)) {
      return { ok: false, error: "Something went wrong. Please try again." };
    }
    return json;
  } catch {
    return { ok: false, error: "Couldn't reach NorthPay. Check your connection and try again." };
  }
}
