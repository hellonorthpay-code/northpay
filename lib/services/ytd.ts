import type { Employee, PayrollRun } from "@/lib/payroll/types";

/**
 * Year-to-date state for a single employee, as of a given moment.
 *
 * This is the single source of truth for CRA correctness during a payroll
 * run — CPP/EI caps and federal/provincial running totals all flow from
 * here. Derived FROM the payroll-run history, never stored on the
 * employee.
 */
export interface YTDState {
  employeeId: string;
  year: number;
  asOf: string;
  /** Gross earnings paid this year so far. */
  gross: number;
  /** CPP-pensionable earnings counted so far. */
  pensionableEarnings: number;
  /** EI-insurable earnings counted so far. */
  insurableEarnings: number;
  cppEmployee: number;
  cpp2Employee: number;
  cppEmployer: number;
  cpp2Employer: number;
  eiEmployee: number;
  eiEmployer: number;
  federalTax: number;
  provincialTax: number;
  net: number;
}

export function emptyYTD(employeeId: string, year: number, asOf: string): YTDState {
  return {
    employeeId,
    year,
    asOf,
    gross: 0,
    pensionableEarnings: 0,
    insurableEarnings: 0,
    cppEmployee: 0,
    cpp2Employee: 0,
    cppEmployer: 0,
    cpp2Employer: 0,
    eiEmployee: 0,
    eiEmployer: 0,
    federalTax: 0,
    provincialTax: 0,
    net: 0,
  };
}

/**
 * PayrollYTDService — derives YTD state from immutable payroll-run history.
 *
 * The service does not cache or mutate. Every query is a fresh fold over
 * the runs collection, which keeps it deterministic and audit-safe.
 *
 * Run inclusion rules:
 *  - Only FINALIZED runs contribute.
 *  - VOIDED runs and their REVERSAL entries net to zero (both included).
 *  - PREVIEW and DRAFT runs are ignored.
 */
export class PayrollYTDService {
  constructor(private readonly runs: PayrollRun[]) {}

  /** YTD for one employee, including all runs with payDate <= asOf. */
  getEmployeeYTD(employeeId: string, year: number, asOf: string): YTDState {
    const cutoff = new Date(asOf).getTime();
    const ytd = emptyYTD(employeeId, year, asOf);

    for (const run of this.runs) {
      if (run.taxYear !== year) continue;
      if (run.status !== "finalized" && run.status !== "voided") continue;
      if (new Date(run.payDate).getTime() > cutoff) continue;

      for (const line of run.lines) {
        if (line.employeeId !== employeeId) continue;
        ytd.gross += line.grossPay;
        ytd.pensionableEarnings += line.grossPay;
        ytd.insurableEarnings += line.grossPay;
        ytd.cppEmployee += line.cppEmployee;
        ytd.cpp2Employee += line.cpp2Employee;
        ytd.cppEmployer += line.cppEmployer;
        ytd.cpp2Employer += line.cpp2Employer;
        ytd.eiEmployee += line.eiEmployee;
        ytd.eiEmployer += line.eiEmployer;
        ytd.federalTax += line.federalTax;
        ytd.provincialTax += line.provincialTax;
        ytd.net += line.netPay;
      }
    }

    return ytd;
  }

  /** Bulk lookup — used by the engine right before running a new payroll. */
  getYTDMap(
    employees: Employee[],
    year: number,
    asOf: string
  ): Map<string, YTDState> {
    const map = new Map<string, YTDState>();
    for (const emp of employees) {
      map.set(emp.id, this.getEmployeeYTD(emp.id, year, asOf));
    }
    return map;
  }
}
