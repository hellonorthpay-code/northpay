import type {
  IAuditRepository,
  IEmployeeRepository,
  IPayrollRepository,
  ISettingsRepository,
  NewEmployee,
  Repositories,
} from "./types";
import type {
  CompanySettings,
  Employee,
  PayrollRun,
} from "@/lib/payroll/types";
import type { AuditEntry } from "@/lib/services/audit";

/**
 * Supabase repository — STUB ONLY.
 *
 * Activation plan:
 *  1. `npm install @supabase/supabase-js`
 *  2. Tables: employees, payroll_runs, settings, audit_log (+ RLS policies)
 *  3. Replace each `notImplemented()` with a real query
 *  4. In repositories/index.ts, switch the factory from
 *     `createLocalStorageRepositories()` to `createSupabaseRepositories()`
 *
 * Notes:
 *  - payroll_runs.input_hash must be UNIQUE on (org_id, input_hash, status='finalized')
 *  - audit_log is append-only via Postgres trigger / RLS
 *  - All tables include org_id for multi-tenant isolation
 */

function notImplemented(name: string): never {
  throw new Error(`SupabaseRepository.${name} not yet implemented`);
}

class SupabaseEmployeeRepository implements IEmployeeRepository {
  async getAll(): Promise<Employee[]> { return notImplemented("employees.getAll"); }
  async getById(_id: string): Promise<Employee | null> { return notImplemented("employees.getById"); }
  async create(_input: NewEmployee): Promise<Employee> { return notImplemented("employees.create"); }
  async update(_id: string, _patch: Partial<Employee>): Promise<Employee> { return notImplemented("employees.update"); }
  async remove(_id: string): Promise<void> { return notImplemented("employees.remove"); }
}

class SupabasePayrollRepository implements IPayrollRepository {
  async getAll(): Promise<PayrollRun[]> { return notImplemented("payroll.getAll"); }
  async getById(_id: string): Promise<PayrollRun | null> { return notImplemented("payroll.getById"); }
  async save(_run: PayrollRun): Promise<PayrollRun> { return notImplemented("payroll.save"); }
  async void(_runId: string, _reversal: PayrollRun, _reason: string): Promise<void> { return notImplemented("payroll.void"); }
}

class SupabaseSettingsRepository implements ISettingsRepository {
  async get(): Promise<CompanySettings> { return notImplemented("settings.get"); }
  async update(_patch: Partial<CompanySettings>): Promise<CompanySettings> { return notImplemented("settings.update"); }
}

class SupabaseAuditRepository implements IAuditRepository {
  async list(_limit?: number): Promise<AuditEntry[]> { return notImplemented("audit.list"); }
  async append(_entry: AuditEntry): Promise<void> { return notImplemented("audit.append"); }
}

export function createSupabaseRepositories(): Repositories {
  return {
    employees: new SupabaseEmployeeRepository(),
    payroll: new SupabasePayrollRepository(),
    settings: new SupabaseSettingsRepository(),
    audit: new SupabaseAuditRepository(),
  };
}
