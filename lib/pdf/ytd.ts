import type { PayrollLineResult, PayrollRun } from "@/lib/payroll/types";

export interface YTDTotals {
  regular: number;
  overtime: number;
  bonus: number;
  vacation: number;
  gross: number;
  federalTax: number;
  provincialTax: number;
  cpp: number;
  cpp2: number;
  ei: number;
  totalDeductions: number;
  net: number;
  cppPensionable: number;
  eiInsurable: number;
  cppEmployer: number;
  eiEmployer: number;
}

const ZERO: YTDTotals = {
  regular: 0,
  overtime: 0,
  bonus: 0,
  vacation: 0,
  gross: 0,
  federalTax: 0,
  provincialTax: 0,
  cpp: 0,
  cpp2: 0,
  ei: 0,
  totalDeductions: 0,
  net: 0,
  cppPensionable: 0,
  eiInsurable: 0,
  cppEmployer: 0,
  eiEmployer: 0,
};

function addLine(into: YTDTotals, line: PayrollLineResult) {
  into.regular += line.regularPay;
  into.overtime += line.overtimePay;
  into.bonus += line.bonusAmount;
  into.vacation += line.vacationAccrual;
  into.gross += line.grossPay;
  into.federalTax += line.federalTax;
  into.provincialTax += line.provincialTax;
  into.cpp += line.cppEmployee;
  into.cpp2 += line.cpp2Employee;
  into.ei += line.eiEmployee;
  into.totalDeductions += line.totalDeductions;
  into.net += line.netPay;
  into.cppPensionable += line.grossPay;
  into.eiInsurable += line.grossPay;
  into.cppEmployer += line.cppEmployer;
  into.eiEmployer += line.eiEmployer;
}

/**
 * YTD totals for a single employee up to and including the given pay-period end.
 */
export function computeYTD(
  employeeId: string,
  runs: PayrollRun[],
  asOfPeriodEnd: string
): YTDTotals {
  const cutoff = new Date(asOfPeriodEnd).getTime();
  const year = new Date(asOfPeriodEnd).getUTCFullYear();
  const result = { ...ZERO };

  for (const run of runs) {
    // Only finalized runs (and their reversals, also stored as finalized)
    // contribute to YTD. Preview and draft runs are excluded.
    if (run.status !== "finalized" && run.status !== "voided") continue;
    const runEnd = new Date(run.periodEnd);
    if (runEnd.getUTCFullYear() !== year) continue;
    if (runEnd.getTime() > cutoff) continue;
    for (const line of run.lines) {
      if (line.employeeId !== employeeId) continue;
      addLine(result, line);
    }
  }
  return result;
}

/**
 * YTD totals for a single employee for an entire tax year (used for T4 slips).
 */
export function computeAnnualTotals(
  employeeId: string,
  runs: PayrollRun[],
  year: number
): YTDTotals {
  const result = { ...ZERO };
  for (const run of runs) {
    if (run.status !== "finalized" && run.status !== "voided") continue;
    if (new Date(run.periodEnd).getUTCFullYear() !== year) continue;
    for (const line of run.lines) {
      if (line.employeeId !== employeeId) continue;
      addLine(result, line);
    }
  }
  return result;
}
