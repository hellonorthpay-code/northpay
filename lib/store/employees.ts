import { create } from "zustand";
import type { Employee } from "@/lib/payroll/types";
import { getRepositories } from "@/lib/repositories";
import { AuditLogService } from "@/lib/services/audit";

/**
 * Employee store — thin view over IEmployeeRepository.
 *
 * UI keeps the same selector + action API it had before, so no UI
 * component needs to change. Persistence is fully delegated.
 */
interface EmployeeStore {
  employees: Employee[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Clear local state — called on logout/user-switch so next hydrate re-fetches. */
  reset: () => void;
  addEmployee: (employee: Omit<Employee, "id" | "createdAt">) => Promise<void>;
  updateEmployee: (id: string, patch: Partial<Employee>) => Promise<void>;
  removeEmployee: (id: string) => Promise<void>;
}

export const useEmployees = create<EmployeeStore>((set, get) => ({
  employees: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const repos = getRepositories();
    const employees = await repos.employees.getAll();
    set({ employees, hydrated: true });
  },

  reset: () => set({ employees: [], hydrated: false }),

  addEmployee: async (input) => {
    const repos = getRepositories();
    const audit = new AuditLogService(repos.audit);
    const emp = await repos.employees.create(input);
    set((s) => ({ employees: [...s.employees, emp] }));
    await audit.log("employee.created", {
      employeeId: emp.id,
      province: emp.province,
      employmentType: emp.employmentType,
    });
  },

  updateEmployee: async (id, patch) => {
    const repos = getRepositories();
    const audit = new AuditLogService(repos.audit);
    const updated = await repos.employees.update(id, patch);
    set((s) => ({
      employees: s.employees.map((e) => (e.id === id ? updated : e)),
    }));
    await audit.log("employee.updated", {
      employeeId: id,
      fields: Object.keys(patch).join(","),
    });
  },

  removeEmployee: async (id) => {
    const repos = getRepositories();
    const audit = new AuditLogService(repos.audit);
    await repos.employees.remove(id);
    set((s) => ({ employees: s.employees.filter((e) => e.id !== id) }));
    await audit.log("employee.removed", { employeeId: id });
  },
}));
