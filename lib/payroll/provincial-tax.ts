import { PROVINCIAL_TAX } from "./constants";
import { round2 } from "@/lib/utils";
import { taxOnIncome } from "./federal-tax";
import type { ProvinceCode } from "./types";

/**
 * Per-period provincial tax. Includes Ontario surtax where applicable.
 */
export function calculateProvincialTax(params: {
  province: ProvinceCode;
  periodTaxableIncome: number;
  payPeriods: number;
}) {
  const { province, periodTaxableIncome, payPeriods } = params;
  if (periodTaxableIncome <= 0) return 0;
  const cfg = PROVINCIAL_TAX[province];
  const annualized = periodTaxableIncome * payPeriods;

  const gross = taxOnIncome(annualized, cfg.brackets);
  const bpaCredit = cfg.basicPersonalAmount * cfg.brackets[0].rate;
  let provincialTax = Math.max(0, gross - bpaCredit);

  if (cfg.surtax) {
    let surtax = 0;
    for (const tier of cfg.surtax) {
      if (provincialTax > tier.over) {
        surtax += (provincialTax - tier.over) * tier.rate;
      }
    }
    provincialTax += surtax;
  }

  return round2(provincialTax / payPeriods);
}
