import {
  CPP,
  CPP_MAX_PENSIONABLE_CONTRIBUTION,
  CPP2_MAX_CONTRIBUTION,
  EI_MAX_EMPLOYEE_PREMIUM,
} from "@/lib/payroll/constants";
import {
  SUPPORTED_PROVINCES,
  type Employee,
  type PayrollLineInput,
  type PayrollRun,
} from "@/lib/payroll/types";
import type { YTDState } from "./ytd";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  /** Optional — employee scope if the issue is per-line. */
  employeeId?: string;
  message: string;
  /** Optional structured details for UI rendering. */
  detail?: Record<string, unknown>;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidateRunInput {
  employees: Employee[];
  inputs: PayrollLineInput[];
  ytdByEmployee: Map<string, YTDState>;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  existingRuns: PayrollRun[];
}

/**
 * PayrollValidationService — runs BEFORE finalization.
 *
 * Returns a structured result. If `ok` is false, the lifecycle service
 * MUST refuse to finalize the run. Warnings are informational and do not
 * block finalization.
 */
export class PayrollValidationService {
  validate(input: ValidateRunInput): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    this.checkPeriod(input, errors);
    this.checkDuplicate(input, errors);
    this.checkEmployees(input, errors, warnings);
    this.checkCaps(input, warnings);

    return {
      ok: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ───────── Period sanity ─────────
  private checkPeriod(input: ValidateRunInput, errors: ValidationIssue[]) {
    const start = Date.parse(input.periodStart);
    const end = Date.parse(input.periodEnd);
    const pay = Date.parse(input.payDate);

    if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(pay)) {
      errors.push({
        code: "PERIOD_INVALID_DATES",
        severity: "error",
        message: "Period dates are not valid ISO dates.",
      });
      return;
    }
    if (end < start) {
      errors.push({
        code: "PERIOD_END_BEFORE_START",
        severity: "error",
        message: "Period end is before period start.",
      });
    }
    if (pay < end) {
      errors.push({
        code: "PAY_DATE_BEFORE_PERIOD_END",
        severity: "error",
        message: "Pay date is before the end of the pay period.",
      });
    }
  }

  // ───────── Duplicate (same employee + same period) ─────────
  private checkDuplicate(
    input: ValidateRunInput,
    errors: ValidationIssue[]
  ) {
    for (const run of input.existingRuns) {
      if (run.status !== "finalized") continue;
      if (run.periodStart !== input.periodStart) continue;
      if (run.periodEnd !== input.periodEnd) continue;

      const overlap = run.lines
        .map((l) => l.employeeId)
        .filter((id) => input.employees.some((e) => e.id === id));

      if (overlap.length > 0) {
        errors.push({
          code: "DUPLICATE_PAYROLL",
          severity: "error",
          message: `A finalized payroll for ${input.periodStart} → ${input.periodEnd} already exists for ${overlap.length} of these employees.`,
          detail: { runId: run.id, employees: overlap },
        });
      }
    }
  }

  // ───────── Per-employee field + value checks ─────────
  private checkEmployees(
    input: ValidateRunInput,
    errors: ValidationIssue[],
    warnings: ValidationIssue[]
  ) {
    for (const emp of input.employees) {
      const id = emp.id;

      if (!emp.firstName?.trim() || !emp.lastName?.trim()) {
        errors.push({
          code: "EMPLOYEE_NAME_MISSING",
          severity: "error",
          employeeId: id,
          message: `Employee ${id} is missing first or last name.`,
        });
      }

      if (!SUPPORTED_PROVINCES.includes(emp.province)) {
        errors.push({
          code: "EMPLOYEE_PROVINCE_UNSUPPORTED",
          severity: "error",
          employeeId: id,
          message: `Province ${emp.province} is not supported (Quebec is intentionally excluded).`,
        });
      }

      if (emp.employmentType === "salary") {
        if (!emp.annualSalary || emp.annualSalary <= 0) {
          errors.push({
            code: "EMPLOYEE_SALARY_INVALID",
            severity: "error",
            employeeId: id,
            message: `Salaried employee ${emp.firstName} ${emp.lastName} has no annual salary.`,
          });
        }
      } else {
        if (!emp.hourlyRate || emp.hourlyRate <= 0) {
          errors.push({
            code: "EMPLOYEE_HOURLY_INVALID",
            severity: "error",
            employeeId: id,
            message: `Hourly employee ${emp.firstName} ${emp.lastName} has no hourly rate.`,
          });
        }
      }

      if (emp.vacationPercent < 0 || emp.vacationPercent > 20) {
        warnings.push({
          code: "EMPLOYEE_VACATION_UNUSUAL",
          severity: "warning",
          employeeId: id,
          message: `Vacation % of ${emp.vacationPercent} is outside the typical 4–10% range.`,
        });
      }
    }
  }

  // ───────── CPP/EI caps already reached ─────────
  private checkCaps(input: ValidateRunInput, warnings: ValidationIssue[]) {
    for (const emp of input.employees) {
      const ytd = input.ytdByEmployee.get(emp.id);
      if (!ytd) continue;

      if (ytd.cppEmployee >= CPP_MAX_PENSIONABLE_CONTRIBUTION - 0.005) {
        warnings.push({
          code: "CPP_CAP_REACHED",
          severity: "warning",
          employeeId: emp.id,
          message: `${emp.firstName} ${emp.lastName} has reached the annual CPP max — no further CPP1 will be deducted.`,
        });
      }
      if (ytd.cpp2Employee >= CPP2_MAX_CONTRIBUTION - 0.005) {
        warnings.push({
          code: "CPP2_CAP_REACHED",
          severity: "warning",
          employeeId: emp.id,
          message: `${emp.firstName} ${emp.lastName} has reached the annual CPP2 max.`,
        });
      }
      if (ytd.eiEmployee >= EI_MAX_EMPLOYEE_PREMIUM - 0.005) {
        warnings.push({
          code: "EI_CAP_REACHED",
          severity: "warning",
          employeeId: emp.id,
          message: `${emp.firstName} ${emp.lastName} has reached the annual EI max — no further EI will be deducted.`,
        });
      }
      if (ytd.pensionableEarnings >= CPP.yampe) {
        warnings.push({
          code: "CPP2_TIER_EXHAUSTED",
          severity: "warning",
          employeeId: emp.id,
          message: `${emp.firstName} ${emp.lastName} has exceeded YAMPE — CPP2 tier no longer applies.`,
        });
      }
    }
  }
}
