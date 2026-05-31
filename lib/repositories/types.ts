import type {
  CompanySettings,
  Employee,
  PayrollRun,
} from "@/lib/payroll/types";
import type { AuditEntry } from "@/lib/services/audit";

/**
 * Repository contracts.
 *
 * All persistence flows through these. UI code MUST NOT touch storage
 * directly. The payroll engine MUST NOT know which repository is wired.
 *
 * All methods are async to keep parity with remote backends. The
 * LocalStorageRepository resolves synchronously-ish via Promise.resolve;
 * the SupabaseRepository (stub) will issue real I/O.
 */

export type NewEmployee = Omit<Employee, "id" | "createdAt">;

export interface IEmployeeRepository {
  getAll(): Promise<Employee[]>;
  getById(id: string): Promise<Employee | null>;
  create(input: NewEmployee): Promise<Employee>;
  update(id: string, patch: Partial<Employee>): Promise<Employee>;
  remove(id: string): Promise<void>;
}

export interface IPayrollRepository {
  getAll(): Promise<PayrollRun[]>;
  getById(id: string): Promise<PayrollRun | null>;
  /** Save a draft / preview / finalized run. Idempotent on inputHash. */
  save(run: PayrollRun): Promise<PayrollRun>;
  /**
   * Mark a finalized run as voided AND store its reversal entry.
   * The reversal is a new run with negated line totals so YTD remains a
   * pure fold over runs (no special-case logic needed in YTD service).
   */
  void(runId: string, reversal: PayrollRun, reason: string): Promise<void>;
}

export interface ISettingsRepository {
  get(): Promise<CompanySettings>;
  update(patch: Partial<CompanySettings>): Promise<CompanySettings>;
}

export interface IAuditRepository {
  list(limit?: number): Promise<AuditEntry[]>;
  append(entry: AuditEntry): Promise<void>;
}

export interface Repositories {
  employees: IEmployeeRepository;
  payroll: IPayrollRepository;
  settings: ISettingsRepository;
  audit: IAuditRepository;
}
