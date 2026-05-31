import { uid } from "@/lib/utils";
import type {
  CompanySettings,
  Employee,
  PayrollRun,
} from "@/lib/payroll/types";
import type {
  IAuditRepository,
  IEmployeeRepository,
  IPayrollRepository,
  ISettingsRepository,
  NewEmployee,
  Repositories,
} from "./types";
import type { AuditEntry } from "@/lib/services/audit";
import { runPayroll } from "@/lib/payroll/engine";
import { emptyYTD, type YTDState } from "@/lib/services/ytd";

/** Module-shared seed employees used by BOTH the employee and payroll seeds. */
const SEED_EMPLOYEES: Employee[] = [
  {
    id: "seed-jordan-bell",
    firstName: "Jordan",
    lastName: "Bell",
    email: "jordan@northpay.example",
    phone: "+14165551234",
    sin: "*** *** 482",
    province: "ON",
    employmentType: "salary",
    annualSalary: 92000,
    payFrequency: "biweekly",
    vacationPercent: 4,
    vacationMode: "payout",
    standardWeeklyHours: 40,
    overtimeThresholdHours: 44,
    startDate: "2024-03-12",
    createdAt: "2024-03-12T00:00:00.000Z",
  },
  {
    id: "seed-priya-sharma",
    firstName: "Priya",
    lastName: "Sharma",
    email: "priya@northpay.example",
    phone: "+16045552081",
    sin: "*** *** 117",
    province: "BC",
    employmentType: "hourly",
    hourlyRate: 38,
    payFrequency: "biweekly",
    vacationPercent: 6,
    vacationMode: "accrue",
    standardWeeklyHours: 40,
    overtimeThresholdHours: 40,
    startDate: "2023-08-01",
    createdAt: "2023-08-01T00:00:00.000Z",
  },
  {
    id: "seed-liam-tremblay",
    firstName: "Liam",
    lastName: "Tremblay",
    email: "liam@northpay.example",
    phone: "+14035554729",
    sin: "*** *** 956",
    province: "AB",
    employmentType: "salary",
    annualSalary: 124000,
    payFrequency: "semimonthly",
    vacationPercent: 4,
    vacationMode: "payout",
    standardWeeklyHours: 37.5,
    overtimeThresholdHours: 44,
    startDate: "2022-11-22",
    createdAt: "2022-11-22T00:00:00.000Z",
  },
  {
    id: "seed-sage-mackenzie",
    firstName: "Sage",
    lastName: "MacKenzie",
    email: "sage@northpay.example",
    phone: "+19025551192",
    sin: "*** *** 233",
    province: "NS",
    employmentType: "hourly",
    hourlyRate: 28,
    payFrequency: "weekly",
    vacationPercent: 4,
    vacationMode: "payout",
    standardWeeklyHours: 40,
    overtimeThresholdHours: 48,
    startDate: "2025-01-15",
    createdAt: "2025-01-15T00:00:00.000Z",
  },
];

/**
 * Thin localStorage adapter. SSR-safe: when window is undefined every
 * method returns an empty default. The stores rehydrate on the client.
 */
class LSDriver {
  isAvailable() {
    return typeof window !== "undefined" && !!window.localStorage;
  }
  read<T>(key: string, fallback: T): T {
    if (!this.isAvailable()) return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  write<T>(key: string, value: T) {
    if (!this.isAvailable()) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

const driver = new LSDriver();

const KEYS = {
  employees: "northpay.repo.employees",
  payroll: "northpay.repo.payroll",
  settings: "northpay.repo.settings",
  audit: "northpay.repo.audit",
};

// ────────────── Employees ──────────────
class LocalStorageEmployeeRepository implements IEmployeeRepository {
  private seed(): Employee[] {
    return SEED_EMPLOYEES;
  }

  private load(): Employee[] {
    const raw = driver.read<Employee[] | null>(KEYS.employees, null);
    if (raw === null) {
      const seed = this.seed();
      driver.write(KEYS.employees, seed);
      return seed;
    }
    return raw;
  }

  async getAll() {
    return this.load();
  }

  async getById(id: string) {
    return this.load().find((e) => e.id === id) ?? null;
  }

  async create(input: NewEmployee) {
    const all = this.load();
    const employee: Employee = {
      ...input,
      id: uid(),
      createdAt: new Date().toISOString(),
    };
    driver.write(KEYS.employees, [...all, employee]);
    return employee;
  }

  async update(id: string, patch: Partial<Employee>) {
    const all = this.load();
    const next = all.map((e) => (e.id === id ? { ...e, ...patch } : e));
    driver.write(KEYS.employees, next);
    const found = next.find((e) => e.id === id);
    if (!found) throw new Error(`Employee ${id} not found`);
    return found;
  }

  async remove(id: string) {
    const all = this.load();
    driver.write(
      KEYS.employees,
      all.filter((e) => e.id !== id)
    );
  }
}

// ────────────── Payroll runs ──────────────
class LocalStoragePayrollRepository implements IPayrollRepository {
  /**
   * Seed 3 past finalized payroll runs by running the engine over the
   * shared SEED_EMPLOYEES with cumulative YTD chaining. Numbers match
   * what the live engine produces, so paystub downloads work end-to-end.
   */
  private seed(): PayrollRun[] {
    const employees = SEED_EMPLOYEES;
    if (employees.length === 0) return [];

    // Three biweekly periods ending in mid-May 2026 (all in the past).
    const periods: Array<{
      periodStart: string;
      periodEnd: string;
      payDate: string;
    }> = [
      { periodStart: "2026-03-30", periodEnd: "2026-04-12", payDate: "2026-04-16" },
      { periodStart: "2026-04-13", periodEnd: "2026-04-26", payDate: "2026-04-30" },
      { periodStart: "2026-04-27", periodEnd: "2026-05-10", payDate: "2026-05-14" },
    ];

    // Initialize empty YTD for each employee; advance after each run.
    const ytdMap = new Map<string, YTDState>();
    for (const emp of employees) {
      ytdMap.set(emp.id, emptyYTD(emp.id, 2026, "2026-01-01"));
    }

    const runs: PayrollRun[] = [];
    for (const period of periods) {
      const run = runPayroll({
        employees,
        inputs: [],
        ytdByEmployee: new Map(ytdMap),
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        payDate: period.payDate,
        status: "finalized",
        runId: `seed-run-${period.periodEnd}`,
        createdAt: `${period.payDate}T12:00:00.000Z`,
      });
      runs.push({
        ...run,
        finalizedAt: `${period.payDate}T12:00:00.000Z`,
      });

      // Bump YTD for the next iteration so caps + cumulative totals chain.
      for (const line of run.lines) {
        const ytd = ytdMap.get(line.employeeId)!;
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

    // Newest first — matches how the UI sorts.
    return runs.reverse();
  }

  private load(): PayrollRun[] {
    const raw = driver.read<PayrollRun[] | null>(KEYS.payroll, null);
    // Seed on first install OR when the store is empty (re-seeds the demo
    // data after localStorage is cleared — useful for the prototype).
    if (raw === null || (Array.isArray(raw) && raw.length === 0)) {
      const seed = this.seed();
      driver.write(KEYS.payroll, seed);
      return seed;
    }
    // Backfill: existing users with real runs but no seeded ones get the
    // demo history prepended once so the History UI has data to show.
    const hasSeed = raw.some((r) => r.id.startsWith("seed-run-"));
    if (!hasSeed) {
      const merged = [...raw, ...this.seed()].sort((a, b) =>
        a.payDate < b.payDate ? 1 : -1
      );
      driver.write(KEYS.payroll, merged);
      return merged;
    }
    return raw;
  }

  async getAll() {
    return this.load();
  }

  async getById(id: string) {
    return this.load().find((r) => r.id === id) ?? null;
  }

  async save(run: PayrollRun) {
    const all = this.load();
    // Idempotency: if a run with the same inputHash exists and is finalized,
    // reject saving a duplicate finalized run. Preview/draft can re-save.
    if (run.status === "finalized") {
      const dup = all.find(
        (r) => r.inputHash === run.inputHash && r.status === "finalized"
      );
      if (dup) throw new Error(`Duplicate finalized run (hash ${run.inputHash})`);
    }

    const idx = all.findIndex((r) => r.id === run.id);
    let next: PayrollRun[];
    if (idx >= 0) {
      // Block edits to finalized runs.
      const existing = all[idx];
      if (existing.status === "finalized") {
        throw new Error(`Cannot overwrite finalized run ${run.id}`);
      }
      next = [...all];
      next[idx] = run;
    } else {
      next = [run, ...all];
    }
    driver.write(KEYS.payroll, next);
    return run;
  }

  async void(runId: string, reversal: PayrollRun, reason: string) {
    const all = this.load();
    const target = all.find((r) => r.id === runId);
    if (!target) throw new Error(`Run ${runId} not found`);
    if (target.status !== "finalized") {
      throw new Error(`Only finalized runs can be voided (run ${runId} is ${target.status})`);
    }

    const updated = all.map((r) =>
      r.id === runId
        ? {
            ...r,
            status: "voided" as const,
            voidedBy: reversal.id,
            voidReason: reason,
          }
        : r
    );
    driver.write(KEYS.payroll, [reversal, ...updated]);
  }
}

// ────────────── Settings ──────────────
class LocalStorageSettingsRepository implements ISettingsRepository {
  private default(): CompanySettings {
    return {
      legalName: "Northwind Coffee Roasters Inc.",
      operatingName: "Northwind Coffee",
      businessNumber: "123456789 RP0001",
      craPayrollAccount: "RP0001",
      defaultProvince: "ON",
      defaultPayFrequency: "biweekly",
      address: "240 Queen St W",
      city: "Toronto",
      postalCode: "M5V 2A1",
    };
  }

  async get() {
    const raw = driver.read<CompanySettings | null>(KEYS.settings, null);
    if (raw === null) {
      const def = this.default();
      driver.write(KEYS.settings, def);
      return def;
    }
    return raw;
  }

  async update(patch: Partial<CompanySettings>) {
    const cur = await this.get();
    const next = { ...cur, ...patch };
    driver.write(KEYS.settings, next);
    return next;
  }
}

// ────────────── Audit log (append-only) ──────────────
class LocalStorageAuditRepository implements IAuditRepository {
  private load(): AuditEntry[] {
    return driver.read<AuditEntry[]>(KEYS.audit, []);
  }

  async list(limit = 200) {
    const all = this.load();
    return all.slice(0, limit);
  }

  async append(entry: AuditEntry) {
    const all = this.load();
    // Most-recent first; cap at 1000 to keep storage bounded.
    const next = [entry, ...all].slice(0, 1000);
    driver.write(KEYS.audit, next);
  }
}

export function createLocalStorageRepositories(): Repositories {
  return {
    employees: new LocalStorageEmployeeRepository(),
    payroll: new LocalStoragePayrollRepository(),
    settings: new LocalStorageSettingsRepository(),
    audit: new LocalStorageAuditRepository(),
  };
}
