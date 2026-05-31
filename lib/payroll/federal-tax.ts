import { FEDERAL_TAX, federalBPA } from "./constants";
import { round2 } from "@/lib/utils";
import type { TaxBracket } from "./types";

export function taxOnIncome(annualIncome: number, brackets: TaxBracket[]) {
  let tax = 0;
  let lastCap = 0;
  for (const bracket of brackets) {
    if (annualIncome > bracket.upTo) {
      tax += (bracket.upTo - lastCap) * bracket.rate;
      lastCap = bracket.upTo;
    } else {
      tax += (annualIncome - lastCap) * bracket.rate;
      return tax;
    }
  }
  return tax;
}

/**
 * Per-period federal tax for 2026.
 *
 * Formula (CRA T4127 simplified):
 *   annualized       = period_taxable × periods
 *   annual_gross_tax = sum(bracket × rate)
 *   bpa_credit       = federalBPA(annualized) × 14%   ← lowest rate
 *   annual_net       = max(0, annual_gross_tax − bpa_credit)
 *   period_fed       = annual_net / periods
 *
 * BPA phase-out is built into federalBPA() so high-income employees
 * automatically get the reduced credit.
 */
export function calculateFederalTax(params: {
  periodTaxableIncome: number;
  payPeriods: number;
}) {
  const { periodTaxableIncome, payPeriods } = params;
  if (periodTaxableIncome <= 0) return 0;
  const annualized = periodTaxableIncome * payPeriods;
  const gross = taxOnIncome(annualized, FEDERAL_TAX.brackets);
  const bpaCredit = federalBPA(annualized) * FEDERAL_TAX.lowestRate;
  const annualTax = Math.max(0, gross - bpaCredit);
  return round2(annualTax / payPeriods);
}
