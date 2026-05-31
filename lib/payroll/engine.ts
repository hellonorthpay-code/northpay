import { round2 } from "@/lib/utils";
import {
  DEFAULT_STANDARD_WEEKLY_HOURS,
  FEDERAL_TAX,
  OVERTIME_MULTIPLIER,
  OVERTIME_WEEKLY_HOURS,
} from "./constants";
import { calculateCPP, calculateCPP2 } from "./cpp";
import { calculateEI, calculateEIEmployer } from "./ei";
import { calculateFederalTax } from "./federal-tax";
import { calculateProvincialTax } from "./provincial-tax";
import {
  PERIODS_PER_YEAR,
  type Employee,
  type PayrollLineInput,
  type PayrollLineResult,
  type PayrollRun,
  type PayrollRunStatus,
} from "./types";
import { hashContent } from "@/lib/services/hash";
import { emptyYTD, type YTDState } from "@/lib/services/ytd";

interface PeriodHours {
  regular: number;
  overtime: number;
}

/**
 * Compute hourly equivalent for OT pay on a salaried employee.
 *   hourly = annual_salary / (standard_weekly_hours × 52)
 *
 * Standard convention in Canadian payroll software (per the user's spec):
 *   37.5 hrs/week → annual / 1,950
 *   40   hrs/week → annual / 2,080
 */
export function hourlyEquivalent(employee: Employee): number {
  if (employee.employmentType === "hourly") return employee.hourlyRate ?? 0;
  const hours =
    employee.standardWeeklyHours || DEFAULT_STANDARD_WEEKLY_HOURS;
  const annual = employee.annualSalary ?? 0;
  return annual / (hours * 52);
}

function defaultHoursForPeriod(
  employee: Employee,
  hours?: number,
  overtimeHours?: number
): PeriodHours {
  if (employee.employmentType === "salary") {
    // Salaried — no "regular hours" tracked, OT only if explicitly logged.
    return { regular: 0, overtime: overtimeHours ?? 0 };
  }
  const weeklyThreshold = OVERTIME_WEEKLY_HOURS[employee.province];
  const weeksPerPeriod =
    employee.payFrequency === "weekly"
      ? 1
      : employee.payFrequency === "biweekly"
      ? 2
      : employee.payFrequency === "semimonthly"
      ? 2.1667
      : 4.3333;
  const regular = hours ?? Math.min(weeklyThreshold, 40) * weeksPerPeriod;
  return { regular, overtime: overtimeHours ?? 0 };
}

/**
 * Calculate one payroll line.
 *
 * YTD is the cumulative state across all prior FINALIZED runs in the
 * tax year — it lets us cap CPP/EI accurately and avoid the silent
 * over-deduction that happens when each period is treated as standalone.
 */
export function calculatePayrollLine(
  employee: Employee,
  input: PayrollLineInput,
  periodStart: string,
  periodEnd: string,
  ytd: YTDState
): PayrollLineResult {
  const payPeriods = PERIODS_PER_YEAR[employee.payFrequency];
  const { regular, overtime } = defaultHoursForPeriod(
    employee,
    input.hoursWorked,
    input.overtimeHours
  );

  let regularPay = 0;
  let overtimePay = 0;
  const hourlyRate = hourlyEquivalent(employee);

  if (employee.employmentType === "salary") {
    regularPay = round2((employee.annualSalary ?? 0) / payPeriods);
    // OT for salaried employees uses the hourly equivalent.
    overtimePay = round2(hourlyRate * OVERTIME_MULTIPLIER * overtime);
  } else {
    regularPay = round2(hourlyRate * regular);
    overtimePay = round2(hourlyRate * OVERTIME_MULTIPLIER * overtime);
  }

  const bonusAmount = round2(input.bonusAmount ?? 0);

  // Statutory holiday pay — three methods:
  //   premium = hourlyRate × 1.5 × hours  (employee worked the stat day)
  //   average = hourlyRate × 1.0 × hours  (general holiday pay; ~1 day's wages)
  //   custom  = operator-entered dollar amount, added as-is
  let statPay = 0;
  let statPayMethod: "premium" | "average" | "custom" | undefined;
  if (input.statPay) {
    if (input.statPay.method === "custom") {
      statPay = round2(input.statPay.amount ?? 0);
    } else {
      const hours = input.statPay.hours ?? 8;
      const multiplier = input.statPay.method === "premium" ? 1.5 : 1.0;
      statPay = round2(hourlyRate * multiplier * hours);
    }
    statPayMethod = input.statPay.method;
  }

  const earningsBeforeVacation =
    regularPay + overtimePay + bonusAmount + statPay;

  // Vacation: depends on mode.
  //   payout  → added to gross (taxed this period)
  //   accrue  → banked separately, NOT added to gross
  const vacationRate = employee.vacationPercent / 100;
  const vacationAmount = round2(earningsBeforeVacation * vacationRate);
  const vacationAccrual =
    employee.vacationMode === "payout" ? vacationAmount : 0;
  const vacationBanked =
    employee.vacationMode === "accrue" ? vacationAmount : 0;

  const grossPay = round2(earningsBeforeVacation + vacationAccrual);

  // ── Cap-aware CPP/EI: pass YTD into each service ──
  const cppEmployee = calculateCPP({
    pensionableEarnings: grossPay,
    payPeriods,
    ytdCpp: ytd.cppEmployee,
  });
  const cpp2Employee = calculateCPP2({
    ytdPensionableEarnings: ytd.pensionableEarnings,
    periodPensionableEarnings: grossPay,
    ytdCpp2: ytd.cpp2Employee,
  });
  const eiEmployee = calculateEI({
    insurableEarnings: grossPay,
    ytdEi: ytd.eiEmployee,
  });
  const eiEmployer = calculateEIEmployer(eiEmployee);

  // PDOC K2 credit — CPP + EI credited at the lowest federal rate.
  // 2026: lowest rate is 14% (was 15% in 2025).
  const cppEiCredit = round2(
    (cppEmployee + cpp2Employee + eiEmployee) * FEDERAL_TAX.lowestRate
  );

  let federalTax = calculateFederalTax({
    periodTaxableIncome: grossPay,
    payPeriods,
  });
  federalTax = round2(Math.max(0, federalTax - cppEiCredit));

  const provincialTax = calculateProvincialTax({
    province: employee.province,
    periodTaxableIncome: grossPay,
    payPeriods,
  });

  const totalDeductions = round2(
    cppEmployee + cpp2Employee + eiEmployee + federalTax + provincialTax
  );
  const netPay = round2(grossPay - totalDeductions);

  return {
    employeeId: employee.id,
    employee,
    periodStart,
    periodEnd,
    hoursWorked: regular,
    overtimeHours: overtime,
    regularPay,
    overtimePay,
    bonusAmount,
    statPay,
    statPayMethod,
    vacationAccrual,
    vacationBanked,
    grossPay,
    cppEmployee,
    cpp2Employee,
    eiEmployee,
    federalTax,
    provincialTax,
    totalDeductions,
    netPay,
    cppEmployer: cppEmployee,
    cpp2Employer: cpp2Employee,
    eiEmployer,
  };
}

export interface RunPayrollInput {
  employees: Employee[];
  inputs: PayrollLineInput[];
  /** YTD state per employee, AS OF the start of this run. */
  ytdByEmployee: Map<string, YTDState>;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  /** Defaults to "preview" — caller (PayrollLifecycleService) sets "finalized". */
  status?: PayrollRunStatus;
  runId: string;
  createdAt: string;
}

/**
 * Build a complete PayrollRun. Pure function — no side effects, no storage.
 * Determinism: same inputs (including ytdByEmployee) → same output (including hash).
 */
export function runPayroll(params: RunPayrollInput): PayrollRun {
  const {
    employees,
    inputs,
    ytdByEmployee,
    periodStart,
    periodEnd,
    payDate,
    status = "preview",
    runId,
    createdAt,
  } = params;

  const inputById = new Map(inputs.map((i) => [i.employeeId, i]));
  const taxYear = new Date(periodEnd).getUTCFullYear();

  const lines: PayrollLineResult[] = employees.map((emp) =>
    calculatePayrollLine(
      // Snapshot employee — must not be a mutable reference into a store.
      JSON.parse(JSON.stringify(emp)) as Employee,
      inputById.get(emp.id) ?? { employeeId: emp.id },
      periodStart,
      periodEnd,
      ytdByEmployee.get(emp.id) ?? emptyYTD(emp.id, taxYear, periodEnd)
    )
  );

  const totals = lines.reduce(
    (acc, l) => {
      acc.gross += l.grossPay;
      acc.net += l.netPay;
      acc.federalTax += l.federalTax;
      acc.provincialTax += l.provincialTax;
      acc.cpp += l.cppEmployee;
      acc.cpp2 += l.cpp2Employee;
      acc.ei += l.eiEmployee;
      acc.employerCost +=
        l.grossPay + l.cppEmployer + l.cpp2Employer + l.eiEmployer;
      return acc;
    },
    {
      gross: 0,
      net: 0,
      federalTax: 0,
      provincialTax: 0,
      cpp: 0,
      cpp2: 0,
      ei: 0,
      employerCost: 0,
    }
  );

  Object.keys(totals).forEach((k) => {
    (totals as Record<string, number>)[k] = round2(
      (totals as Record<string, number>)[k]
    );
  });

  // Hash captures the inputs that produced this run. Same inputs → same hash.
  const inputHash = hashContent({
    employees: employees.map((e) => ({ ...e })),
    inputs,
    ytd: Array.from(ytdByEmployee.entries()).sort(),
    periodStart,
    periodEnd,
    payDate,
  });

  return {
    id: runId,
    taxYear,
    periodStart,
    periodEnd,
    payDate,
    status,
    inputHash,
    createdAt,
    lines,
    totals,
  };
}
