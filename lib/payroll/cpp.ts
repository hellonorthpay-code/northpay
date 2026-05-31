import { CPP, CPP_MAX_PENSIONABLE_CONTRIBUTION, CPP2_MAX_CONTRIBUTION } from "./constants";
import { round2 } from "@/lib/utils";

/**
 * Per-period CPP contribution.
 * Formula per CRA T4127:
 *   C = 0.0595 × ( pensionable_earnings − (YBE / pay_periods) )
 * Capped so YTD does not exceed annual max.
 */
export function calculateCPP(params: {
  pensionableEarnings: number;
  payPeriods: number;
  ytdCpp?: number;
}) {
  const { pensionableEarnings, payPeriods, ytdCpp = 0 } = params;
  const periodExemption = CPP.yearsBasicExemption / payPeriods;
  const taxableForCPP = Math.max(0, pensionableEarnings - periodExemption);
  let contribution = taxableForCPP * CPP.employeeRate;

  const remaining = CPP_MAX_PENSIONABLE_CONTRIBUTION - ytdCpp;
  if (contribution > remaining) contribution = Math.max(0, remaining);
  return round2(contribution);
}

/**
 * Per-period CPP2 contribution (second tier on earnings between YMPE and YAMPE).
 */
export function calculateCPP2(params: {
  ytdPensionableEarnings: number;
  periodPensionableEarnings: number;
  ytdCpp2?: number;
}) {
  const { ytdPensionableEarnings, periodPensionableEarnings, ytdCpp2 = 0 } = params;
  const yearStart = ytdPensionableEarnings;
  const yearEnd = ytdPensionableEarnings + periodPensionableEarnings;

  const tierStart = CPP.ympe;
  const tierEnd = CPP.yampe;
  const overlap =
    Math.max(0, Math.min(yearEnd, tierEnd) - Math.max(yearStart, tierStart));

  let contribution = overlap * CPP.cpp2Rate;
  const remaining = CPP2_MAX_CONTRIBUTION - ytdCpp2;
  if (contribution > remaining) contribution = Math.max(0, remaining);
  return round2(contribution);
}
