import { uid, round2 } from "@/lib/utils";
import { runPayroll, type RunPayrollInput } from "@/lib/payroll/engine";
import type {
  Employee,
  PayrollLineInput,
  PayrollRun,
} from "@/lib/payroll/types";
import type { Repositories } from "@/lib/repositories/types";
import { PayrollYTDService } from "./ytd";
import {
  PayrollValidationService,
  type ValidationResult,
} from "./validation";
import { AuditLogService } from "./audit";

/**
 * PayrollLifecycleService — owns the state-machine for a payroll run.
 *
 *   ┌────────┐     ┌─────────┐     ┌────────────┐     ┌────────┐
 *   │ draft  │ ──▶ │ preview │ ──▶ │ finalized  │ ──▶ │ voided │
 *   └────────┘     └─────────┘     └────────────┘     └────────┘
 *      ▲              ▲                   │                 │
 *      └──── revise ──┘                   └─── reversal ───▶│
 *
 * Rules enforced here:
 *  - validate() runs before finalize(); errors block finalization.
 *  - preview() never persists state-changing data (no audit, no save).
 *  - finalize() writes ONE finalized run; idempotent on input hash.
 *  - void() never deletes; it stamps the original as voided and writes a
 *    reversal run with negated totals so the YTD service nets to zero.
 */
export class PayrollLifecycleService {
  private readonly ytd: PayrollYTDService;
  private readonly validator = new PayrollValidationService();
  private readonly audit: AuditLogService;

  constructor(
    private readonly repos: Repositories,
    runsSnapshot: PayrollRun[]
  ) {
    this.ytd = new PayrollYTDService(runsSnapshot);
    this.audit = new AuditLogService(repos.audit);
  }

  // ───────── Preview (pure, no side effects) ─────────
  preview(input: {
    employees: Employee[];
    inputs?: PayrollLineInput[];
    periodStart: string;
    periodEnd: string;
    payDate: string;
  }): PayrollRun {
    const taxYear = new Date(input.periodEnd).getUTCFullYear();
    const ytdMap = this.ytd.getYTDMap(input.employees, taxYear, input.payDate);
    return runPayroll({
      employees: input.employees,
      inputs: input.inputs ?? [],
      ytdByEmployee: ytdMap,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      payDate: input.payDate,
      status: "preview",
      runId: uid(),
      createdAt: new Date().toISOString(),
    });
  }

  // ───────── Validate ─────────
  async validate(input: {
    employees: Employee[];
    inputs?: PayrollLineInput[];
    periodStart: string;
    periodEnd: string;
    payDate: string;
  }): Promise<ValidationResult> {
    const taxYear = new Date(input.periodEnd).getUTCFullYear();
    const ytdMap = this.ytd.getYTDMap(input.employees, taxYear, input.payDate);
    const existingRuns = await this.repos.payroll.getAll();
    return this.validator.validate({
      employees: input.employees,
      inputs: input.inputs ?? [],
      ytdByEmployee: ytdMap,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      payDate: input.payDate,
      existingRuns,
    });
  }

  // ───────── Finalize (persists + audits) ─────────
  async finalize(input: {
    employees: Employee[];
    inputs?: PayrollLineInput[];
    periodStart: string;
    periodEnd: string;
    payDate: string;
  }): Promise<
    | { ok: true; run: PayrollRun; warnings: ValidationResult["warnings"] }
    | { ok: false; result: ValidationResult }
  > {
    const result = await this.validate(input);
    if (!result.ok) return { ok: false, result };

    const taxYear = new Date(input.periodEnd).getUTCFullYear();
    const ytdMap = this.ytd.getYTDMap(input.employees, taxYear, input.payDate);

    const now = new Date().toISOString();
    const draft = runPayroll({
      employees: input.employees,
      inputs: input.inputs ?? [],
      ytdByEmployee: ytdMap,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      payDate: input.payDate,
      status: "finalized",
      runId: uid(),
      createdAt: now,
    });
    const final: PayrollRun = { ...draft, finalizedAt: now };

    const saved = await this.repos.payroll.save(final);
    await this.audit.log("payroll.finalized", {
      runId: saved.id,
      inputHash: saved.inputHash,
      taxYear: saved.taxYear,
      periodStart: saved.periodStart,
      periodEnd: saved.periodEnd,
      employeeCount: saved.lines.length,
      gross: saved.totals.gross,
      net: saved.totals.net,
    });

    return { ok: true, run: saved, warnings: result.warnings };
  }

  // ───────── Void (creates reversal, never deletes) ─────────
  async void(runId: string, reason: string): Promise<PayrollRun> {
    const original = await this.repos.payroll.getById(runId);
    if (!original) throw new Error(`Run ${runId} not found`);
    if (original.status !== "finalized") {
      throw new Error(`Only finalized runs can be voided`);
    }

    const reversal: PayrollRun = {
      ...original,
      id: uid(),
      status: "finalized",
      reverses: original.id,
      createdAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
      inputHash: `reversal:${original.inputHash}`,
      lines: original.lines.map((l) => ({
        ...l,
        regularPay: -l.regularPay,
        overtimePay: -l.overtimePay,
        bonusAmount: -l.bonusAmount,
        vacationAccrual: -l.vacationAccrual,
        grossPay: -l.grossPay,
        cppEmployee: -l.cppEmployee,
        cpp2Employee: -l.cpp2Employee,
        eiEmployee: -l.eiEmployee,
        federalTax: -l.federalTax,
        provincialTax: -l.provincialTax,
        totalDeductions: -l.totalDeductions,
        netPay: -l.netPay,
        cppEmployer: -l.cppEmployer,
        cpp2Employer: -l.cpp2Employer,
        eiEmployer: -l.eiEmployer,
      })),
      totals: {
        gross: -original.totals.gross,
        net: -original.totals.net,
        federalTax: -original.totals.federalTax,
        provincialTax: -original.totals.provincialTax,
        cpp: -original.totals.cpp,
        cpp2: -original.totals.cpp2,
        ei: -original.totals.ei,
        employerCost: -original.totals.employerCost,
      },
    };
    // sanity: rounding cleanup
    reversal.totals = Object.fromEntries(
      Object.entries(reversal.totals).map(([k, v]) => [k, round2(v as number)])
    ) as PayrollRun["totals"];

    await this.repos.payroll.void(runId, reversal, reason);
    await this.audit.log("payroll.voided", {
      runId: original.id,
      reversalId: reversal.id,
      reason,
    });
    return reversal;
  }
}
