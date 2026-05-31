export type ProvinceCode =
  | "ON"
  | "AB"
  | "BC"
  | "MB"
  | "SK"
  | "NS"
  | "NB"
  | "PE"
  | "NL";

export const SUPPORTED_PROVINCES: ProvinceCode[] = [
  "ON",
  "AB",
  "BC",
  "MB",
  "SK",
  "NS",
  "NB",
  "PE",
  "NL",
];

export const PROVINCE_NAMES: Record<ProvinceCode, string> = {
  ON: "Ontario",
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  SK: "Saskatchewan",
  NS: "Nova Scotia",
  NB: "New Brunswick",
  PE: "Prince Edward Island",
  NL: "Newfoundland and Labrador",
};

export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";

export const PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

export type EmploymentType = "salary" | "hourly";

/**
 * How vacation pay is handled each pay period.
 *  "payout" — Vacation % is added on top of every paycheque (typical hourly).
 *  "accrue" — Vacation is banked, NOT added to gross. Paid out later.
 */
export type VacationMode = "payout" | "accrue";

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  sin: string;
  province: ProvinceCode;
  employmentType: EmploymentType;
  annualSalary?: number;
  hourlyRate?: number;
  payFrequency: PayFrequency;
  vacationPercent: number;
  /** Required: how vacation pay is treated each pay period. */
  vacationMode: VacationMode;
  /**
   * Standard weekly hours — used to derive hourly equivalent for salaried
   * employees (annual_salary / (standardWeeklyHours × 52)). Default 40.
   */
  standardWeeklyHours: number;
  /**
   * Per-employee OT threshold. Defaults to provincial floor on creation.
   * Hours above this in a week are paid at 1.5× the hourly rate (or
   * hourly equivalent for salaried).
   */
  overtimeThresholdHours: number;
  startDate: string;
  /** Optional phone number for WhatsApp deep-links. International format preferred. */
  phone?: string;
  bankInstitution?: string;
  bankTransit?: string;
  bankAccount?: string;
  createdAt: string;
}

export interface TaxBracket {
  upTo: number;
  rate: number;
}

export interface ProvincialTaxConfig {
  brackets: TaxBracket[];
  basicPersonalAmount: number;
  surtax?: Array<{ over: number; rate: number }>;
}

/**
 * Statutory holiday pay method.
 *
 *  • "premium"  → Employee worked the holiday. Pay 1.5× their rate for the
 *                 holiday hours (Employment Standards Acts vary, but 1.5×
 *                 is the federal + most-provinces premium for hours worked
 *                 on a stat holiday). Default = 8 hrs × rate × 1.5.
 *  • "average"  → Employee did NOT work the holiday. Pay "general holiday
 *                 pay" — approximated as one regular day's wage (Canada
 *                 Labour Code: average daily wage from prior 4 weeks ÷ 20).
 *                 Default = 8 hrs × rate × 1.0.
 *  • "custom"   → Operator-entered dollar amount, added straight to gross.
 *                 Useful for one-off bonuses dressed as stat-pay, or to
 *                 honour an employee-specific calculation the engine
 *                 doesn't know about.
 */
export type StatPayMethod = "premium" | "average" | "custom";

export interface PayrollLineInput {
  employeeId: string;
  hoursWorked?: number;
  overtimeHours?: number;
  bonusAmount?: number;
  /** When set, stat-pay is added to gross using the chosen method. */
  statPay?: {
    method: StatPayMethod;
    /** Defaults to 8 hours. Ignored when method = "custom". */
    hours?: number;
    /** Required when method = "custom" — the exact $ amount to add to gross. */
    amount?: number;
  };
}

export interface PayrollLineResult {
  employeeId: string;
  employee: Employee;
  periodStart: string;
  periodEnd: string;
  hoursWorked: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  bonusAmount: number;
  /** Statutory holiday pay added to gross this period. */
  statPay: number;
  /** Which method was used to compute statPay (undefined when 0). */
  statPayMethod?: StatPayMethod;
  /** Vacation amount paid out this period (when mode = "payout"). */
  vacationAccrual: number;
  /** Vacation amount banked this period (when mode = "accrue"). NOT in gross. */
  vacationBanked: number;
  grossPay: number;
  cppEmployee: number;
  cpp2Employee: number;
  eiEmployee: number;
  federalTax: number;
  provincialTax: number;
  totalDeductions: number;
  netPay: number;
  cppEmployer: number;
  cpp2Employer: number;
  eiEmployer: number;
}

export type PayrollRunStatus = "draft" | "preview" | "finalized" | "voided";

export interface PayrollRun {
  id: string;
  /** Tax year the run belongs to; derived from periodEnd at create time. */
  taxYear: number;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayrollRunStatus;
  /** SHA-256 / FNV hash of the canonical input that produced this run. */
  inputHash: string;
  createdAt: string;
  finalizedAt?: string;
  /** If status === "voided", the run that voided it (reversal). */
  voidedBy?: string;
  /** If this run is itself a reversal, the run it reverses. */
  reverses?: string;
  /** Free-text reason captured when voiding. */
  voidReason?: string;
  lines: PayrollLineResult[];
  totals: {
    gross: number;
    net: number;
    federalTax: number;
    provincialTax: number;
    cpp: number;
    cpp2: number;
    ei: number;
    employerCost: number;
  };
}

export interface CompanySettings {
  legalName: string;
  operatingName: string;
  businessNumber: string;
  craPayrollAccount?: string;
  defaultProvince: ProvinceCode;
  defaultPayFrequency: PayFrequency;
  address: string;
  city: string;
  postalCode: string;
}
