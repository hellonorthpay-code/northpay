import type { ProvinceCode, ProvincialTaxConfig } from "./types";

/**
 * 2026 Canadian payroll constants — CONFIRMED with official CRA / provincial sources.
 *
 * Verified Dec 2025 - Jan 2026 from:
 *   • CRA T4127 payroll formulas
 *   • CPB Canada announcement (CPP YMPE/YAMPE 2026)
 *   • Canada.ca EI premium notice 2026
 *   • TaxTips.ca per-province 2026 tables
 *
 * Notable 2026 changes vs 2025:
 *   • Federal lowest bracket: 15% → 14% (Tax Cut for the Middle Class, full year)
 *   • Federal BPA phase-out at high income (16,452 → 14,829 between 181,440 and 258,482)
 *   • CPP YMPE: 71,300 → 74,600
 *   • CPP YAMPE: 81,200 → 85,000
 *   • EI MIE: 65,700 → 68,900
 *   • EI employee rate: 1.64% → 1.63%
 *   • Alberta: added a NEW 8% bottom bracket up to $61,200
 *   • BC: lowest rate increased 5.06% → 5.60% (Feb 17, 2026 budget)
 *   • Manitoba: indexation paused for 2026 (brackets unchanged)
 *   • NL: BPA jumped to $15,000
 *   • SK: BPA $20,381 (+$500 Affordability Act + 2% indexation)
 */

export const TAX_YEAR = 2026;

// ───────────────────────── CPP (2026 confirmed) ─────────────────────────
export const CPP = {
  yearsBasicExemption: 3500,
  ympe: 74600,
  yampe: 85000,
  employeeRate: 0.0595,
  employerRate: 0.0595,
  cpp2Rate: 0.04,
};
export const CPP_MAX_PENSIONABLE_CONTRIBUTION =
  (CPP.ympe - CPP.yearsBasicExemption) * CPP.employeeRate; // $4,230.45
export const CPP2_MAX_CONTRIBUTION =
  (CPP.yampe - CPP.ympe) * CPP.cpp2Rate; // $416.00

// ───────────────────────── EI (2026 confirmed) ─────────────────────────
export const EI = {
  maxInsurableEarnings: 68900,
  employeeRate: 0.0163,
  employerMultiplier: 1.4,
};
export const EI_MAX_EMPLOYEE_PREMIUM = EI.maxInsurableEarnings * EI.employeeRate; // $1,123.07

// ───────────── Federal tax (2026 confirmed) ─────────────
//
// IMPORTANT: lowest bracket rate dropped from 15% → 14% for 2026 full year.
// This affects every paystub, the BPA credit, and the K2 (CPP+EI) credit.
//
export const FEDERAL_TAX = {
  brackets: [
    { upTo: 58523, rate: 0.14 },
    { upTo: 117045, rate: 0.205 },
    { upTo: 181440, rate: 0.26 },
    { upTo: 258482, rate: 0.29 },
    { upTo: Infinity, rate: 0.33 },
  ],
  /** Lowest bracket rate — used for BPA credit and K2 (CPP/EI) credit. */
  lowestRate: 0.14,
  /**
   * Basic Personal Amount with phase-out for high incomes.
   *
   *   income ≤ 181,440      → 16,452 (full enhanced BPA)
   *   181,440 < income < 258,482 → linear from 16,452 down to 14,829
   *   income ≥ 258,482      → 14,829 (old indexed BPA only)
   */
  bpaHigh: 16452,
  bpaLow: 14829,
  bpaPhaseoutStart: 181440,
  bpaPhaseoutEnd: 258482,
};

/** Effective Basic Personal Amount given annual income (with phase-out). */
export function federalBPA(annualIncome: number): number {
  const { bpaHigh, bpaLow, bpaPhaseoutStart, bpaPhaseoutEnd } = FEDERAL_TAX;
  if (annualIncome <= bpaPhaseoutStart) return bpaHigh;
  if (annualIncome >= bpaPhaseoutEnd) return bpaLow;
  const t = (annualIncome - bpaPhaseoutStart) / (bpaPhaseoutEnd - bpaPhaseoutStart);
  return bpaHigh - (bpaHigh - bpaLow) * t;
}

// ───────────── Provincial tax tables (2026 confirmed per source) ─────────────

export const PROVINCIAL_TAX: Record<ProvinceCode, ProvincialTaxConfig> = {
  // Ontario — indexation 1.9 %, surtax thresholds confirmed 2026
  ON: {
    brackets: [
      { upTo: 53891, rate: 0.0505 },
      { upTo: 107785, rate: 0.0915 },
      { upTo: 150000, rate: 0.1116 },
      { upTo: 220000, rate: 0.1216 },
      { upTo: Infinity, rate: 0.1316 },
    ],
    basicPersonalAmount: 12989, // 12747 × 1.019 indexation
    surtax: [
      { over: 5818, rate: 0.2 },
      { over: 7446, rate: 0.36 },
    ],
  },

  // Alberta — NEW 6-bracket structure for 2026 (added 8% bottom bracket)
  AB: {
    brackets: [
      { upTo: 61200, rate: 0.08 },     // ← NEW for 2026
      { upTo: 154259, rate: 0.10 },
      { upTo: 185111, rate: 0.12 },
      { upTo: 246813, rate: 0.13 },
      { upTo: 370220, rate: 0.14 },
      { upTo: Infinity, rate: 0.15 },
    ],
    basicPersonalAmount: 22769,
  },

  // British Columbia — lowest rate raised to 5.60% (Feb 17, 2026 budget)
  BC: {
    brackets: [
      { upTo: 50363, rate: 0.056 },    // ← was 5.06% pre-Budget
      { upTo: 100728, rate: 0.077 },
      { upTo: 115648, rate: 0.105 },
      { upTo: 140430, rate: 0.1229 },
      { upTo: 190405, rate: 0.147 },
      { upTo: 265545, rate: 0.168 },
      { upTo: Infinity, rate: 0.205 },
    ],
    basicPersonalAmount: 13216,
  },

  // Manitoba — indexation paused for 2026; same thresholds as 2025
  MB: {
    brackets: [
      { upTo: 47564, rate: 0.108 },
      { upTo: 101200, rate: 0.1275 },
      { upTo: Infinity, rate: 0.174 },
    ],
    basicPersonalAmount: 15780,
  },

  // Saskatchewan — 2 % indexation + $500 Affordability Act increase to BPA
  SK: {
    brackets: [
      { upTo: 54532, rate: 0.105 },
      { upTo: 155805, rate: 0.125 },
      { upTo: Infinity, rate: 0.145 },
    ],
    basicPersonalAmount: 20381,
  },

  // Nova Scotia — 1.6 % indexation, BPA now max-for-all (no income test)
  NS: {
    brackets: [
      { upTo: 30995, rate: 0.0879 },
      { upTo: 61991, rate: 0.1495 },
      { upTo: 97418, rate: 0.1667 },
      { upTo: 157124, rate: 0.175 },
      { upTo: Infinity, rate: 0.21 },
    ],
    basicPersonalAmount: 11932,
  },

  // New Brunswick — 2 % indexation
  NB: {
    brackets: [
      { upTo: 52332, rate: 0.094 },
      { upTo: 104666, rate: 0.14 },
      { upTo: 193861, rate: 0.16 },
      { upTo: Infinity, rate: 0.195 },
    ],
    basicPersonalAmount: 13664,
  },

  // Prince Edward Island — confirmed 3-bracket 2026 structure
  PE: {
    brackets: [
      { upTo: 32656, rate: 0.098 },
      { upTo: 81310, rate: 0.138 },
      { upTo: Infinity, rate: 0.167 },
    ],
    basicPersonalAmount: 14525, // 14250 × 1.019 indexation (per PEI 2026 budget)
  },

  // Newfoundland & Labrador — 1.1% indexation, BPA hugely up to $15,000
  NL: {
    brackets: [
      { upTo: 44678, rate: 0.087 },
      { upTo: 89355, rate: 0.145 },
      { upTo: 159529, rate: 0.158 },
      { upTo: 223340, rate: 0.178 },
      { upTo: 285318, rate: 0.198 },
      { upTo: 570635, rate: 0.208 },
      { upTo: 1141272, rate: 0.213 },
      { upTo: Infinity, rate: 0.218 },
    ],
    basicPersonalAmount: 15000,
  },
};

// ──────────── Overtime thresholds (weekly hours) per Employment Standards Acts ────────────
export const OVERTIME_WEEKLY_HOURS: Record<ProvinceCode, number> = {
  ON: 44,
  AB: 44,
  BC: 40,
  MB: 40,
  SK: 40,
  NS: 48,
  NB: 44,
  PE: 48,
  NL: 40,
};

export const OVERTIME_MULTIPLIER = 1.5;

// ──────────── Default vacation percentage (CRA min 4 % under 5 yrs tenure) ────────────
export const DEFAULT_VACATION_PERCENT = 4;

/** Default standard weekly hours for hourly-equivalent calc on salaried employees. */
export const DEFAULT_STANDARD_WEEKLY_HOURS = 40;
