import { supabase } from "@/lib/supabase/client";
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

// ─────────────────────────────────────────────────────────────────────────
// Helpers — convert between DB snake_case rows and app camelCase types
// ─────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEmployee(row: any): Employee {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    sin: row.sin ?? "",
    province: row.province,
    employmentType: row.employment_type,
    annualSalary: row.annual_salary ?? undefined,
    hourlyRate: row.hourly_rate ?? undefined,
    payFrequency: row.pay_frequency,
    vacationPercent: Number(row.vacation_percent),
    vacationMode: row.vacation_mode,
    standardWeeklyHours: Number(row.standard_weekly_hours),
    overtimeThresholdHours: Number(row.overtime_threshold_hours),
    startDate: row.start_date,
    bankInstitution: row.bank_institution ?? undefined,
    bankTransit: row.bank_transit ?? undefined,
    bankAccount: row.bank_account ?? undefined,
    createdAt: row.created_at,
  };
}

function employeeToRow(e: NewEmployee | Partial<Employee>) {
  return {
    first_name: (e as NewEmployee).firstName,
    last_name: (e as NewEmployee).lastName,
    email: e.email,
    phone: e.phone,
    sin: e.sin,
    province: e.province,
    employment_type: e.employmentType,
    annual_salary: e.annualSalary ?? null,
    hourly_rate: e.hourlyRate ?? null,
    pay_frequency: e.payFrequency,
    vacation_percent: e.vacationPercent,
    vacation_mode: e.vacationMode,
    standard_weekly_hours: e.standardWeeklyHours,
    overtime_threshold_hours: e.overtimeThresholdHours,
    start_date: e.startDate,
    bank_institution: (e as Employee).bankInstitution ?? null,
    bank_transit: (e as Employee).bankTransit ?? null,
    bank_account: (e as Employee).bankAccount ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPayrollRun(row: any): PayrollRun {
  return {
    id: row.id,
    taxYear: row.tax_year,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    payDate: row.pay_date,
    status: row.status,
    inputHash: row.input_hash,
    lines: row.lines ?? [],
    totals: row.totals ?? {},
    createdAt: row.created_at,
    finalizedAt: row.finalized_at ?? undefined,
    voidedBy: row.voided_by ?? undefined,
    reverses: row.reverses ?? undefined,
    voidReason: row.void_reason ?? undefined,
  };
}

function payrollRunToRow(run: PayrollRun) {
  return {
    id: run.id,
    tax_year: run.taxYear,
    period_start: run.periodStart,
    period_end: run.periodEnd,
    pay_date: run.payDate,
    status: run.status,
    input_hash: run.inputHash,
    lines: run.lines,
    totals: run.totals,
    finalized_at: run.finalizedAt ?? null,
    voided_by: run.voidedBy ?? null,
    reverses: run.reverses ?? null,
    void_reason: run.voidReason ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSettings(row: any): CompanySettings {
  return {
    legalName: row.legal_name ?? "",
    operatingName: row.operating_name ?? "",
    businessNumber: row.business_number ?? "",
    craPayrollAccount: row.cra_payroll_account ?? undefined,
    defaultProvince: row.default_province ?? "ON",
    defaultPayFrequency: row.default_pay_frequency ?? "biweekly",
    address: row.address ?? "",
    city: row.city ?? "",
    postalCode: row.postal_code ?? "",
  };
}

const DEFAULT_SETTINGS: CompanySettings = {
  legalName: "",
  operatingName: "",
  businessNumber: "",
  defaultProvince: "ON",
  defaultPayFrequency: "biweekly",
  address: "",
  city: "",
  postalCode: "",
};

// ─────────────────────────────────────────────────────────────────────────
// Employee repository
// ─────────────────────────────────────────────────────────────────────────
class SupabaseEmployeeRepository implements IEmployeeRepository {
  async getAll(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToEmployee);
  }

  async getById(id: string): Promise<Employee | null> {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    return rowToEmployee(data);
  }

  async create(input: NewEmployee): Promise<Employee> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("employees")
      .insert({ ...employeeToRow(input), owner_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return rowToEmployee(data);
  }

  async update(id: string, patch: Partial<Employee>): Promise<Employee> {
    const row: Record<string, unknown> = {};
    if (patch.firstName !== undefined) row.first_name = patch.firstName;
    if (patch.lastName !== undefined) row.last_name = patch.lastName;
    if (patch.email !== undefined) row.email = patch.email;
    if (patch.phone !== undefined) row.phone = patch.phone;
    if (patch.sin !== undefined) row.sin = patch.sin;
    if (patch.province !== undefined) row.province = patch.province;
    if (patch.employmentType !== undefined) row.employment_type = patch.employmentType;
    if (patch.annualSalary !== undefined) row.annual_salary = patch.annualSalary;
    if (patch.hourlyRate !== undefined) row.hourly_rate = patch.hourlyRate;
    if (patch.payFrequency !== undefined) row.pay_frequency = patch.payFrequency;
    if (patch.vacationPercent !== undefined) row.vacation_percent = patch.vacationPercent;
    if (patch.vacationMode !== undefined) row.vacation_mode = patch.vacationMode;
    if (patch.standardWeeklyHours !== undefined) row.standard_weekly_hours = patch.standardWeeklyHours;
    if (patch.overtimeThresholdHours !== undefined) row.overtime_threshold_hours = patch.overtimeThresholdHours;
    if (patch.startDate !== undefined) row.start_date = patch.startDate;
    if (patch.bankInstitution !== undefined) row.bank_institution = patch.bankInstitution;
    if (patch.bankTransit !== undefined) row.bank_transit = patch.bankTransit;
    if (patch.bankAccount !== undefined) row.bank_account = patch.bankAccount;

    const { data, error } = await supabase
      .from("employees")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return rowToEmployee(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Payroll repository
// ─────────────────────────────────────────────────────────────────────────
class SupabasePayrollRepository implements IPayrollRepository {
  async getAll(): Promise<PayrollRun[]> {
    const { data, error } = await supabase
      .from("payroll_runs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToPayrollRun);
  }

  async getById(id: string): Promise<PayrollRun | null> {
    const { data, error } = await supabase
      .from("payroll_runs")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    return rowToPayrollRun(data);
  }

  async save(run: PayrollRun): Promise<PayrollRun> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const row = { ...payrollRunToRow(run), owner_id: user.id };
    const { data, error } = await supabase
      .from("payroll_runs")
      .upsert(row)
      .select()
      .single();
    if (error) {
      // Surface the actual Postgres message — Supabase returns a
      // PostgrestError (not Error), so we must wrap it ourselves or the
      // caller sees a useless generic "Failed to save payroll run".
      console.error("[supabase] payroll_runs.upsert failed", { error, row });
      throw new Error(
        `payroll_runs.upsert: ${error.message}` +
          (error.code ? ` (code ${error.code})` : "") +
          (error.hint ? ` — hint: ${error.hint}` : "") +
          (error.details ? ` — ${error.details}` : ""),
      );
    }
    return rowToPayrollRun(data);
  }

  async void(runId: string, reversal: PayrollRun, reason: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    await supabase
      .from("payroll_runs")
      .update({ status: "voided", void_reason: reason, voided_by: reversal.id })
      .eq("id", runId);

    await supabase
      .from("payroll_runs")
      .insert({ ...payrollRunToRow(reversal), owner_id: user.id });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Settings repository
// ─────────────────────────────────────────────────────────────────────────
class SupabaseSettingsRepository implements ISettingsRepository {
  async get(): Promise<CompanySettings> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return DEFAULT_SETTINGS;

    const { data, error } = await supabase
      .from("company_settings")
      .select("*")
      .eq("id", user.id)
      .single();
    if (error || !data) return DEFAULT_SETTINGS;
    return rowToSettings(data);
  }

  async update(patch: Partial<CompanySettings>): Promise<CompanySettings> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const row: Record<string, unknown> = {};
    if (patch.legalName !== undefined) row.legal_name = patch.legalName;
    if (patch.operatingName !== undefined) row.operating_name = patch.operatingName;
    if (patch.businessNumber !== undefined) row.business_number = patch.businessNumber;
    if (patch.craPayrollAccount !== undefined) row.cra_payroll_account = patch.craPayrollAccount;
    if (patch.defaultProvince !== undefined) row.default_province = patch.defaultProvince;
    if (patch.defaultPayFrequency !== undefined) row.default_pay_frequency = patch.defaultPayFrequency;
    if (patch.address !== undefined) row.address = patch.address;
    if (patch.city !== undefined) row.city = patch.city;
    if (patch.postalCode !== undefined) row.postal_code = patch.postalCode;

    const { data, error } = await supabase
      .from("company_settings")
      .upsert({ id: user.id, ...row })
      .select()
      .single();
    if (error) throw error;
    return rowToSettings(data);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Audit repository (append-only log — stored locally, not critical)
// ─────────────────────────────────────────────────────────────────────────
class SupabaseAuditRepository implements IAuditRepository {
  async list(_limit?: number): Promise<AuditEntry[]> { return []; }
  async append(_entry: AuditEntry): Promise<void> { /* no-op for now */ }
}

// ─────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────
export function createSupabaseRepositories(): Repositories {
  return {
    employees: new SupabaseEmployeeRepository(),
    payroll: new SupabasePayrollRepository(),
    settings: new SupabaseSettingsRepository(),
    audit: new SupabaseAuditRepository(),
  };
}
