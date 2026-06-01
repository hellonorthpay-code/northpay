import { create } from "zustand";
import type { PayrollRun } from "@/lib/payroll/types";
import { getRepositories } from "@/lib/repositories";

interface PayrollStore {
  runs: PayrollRun[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  reset: () => void;
  /**
   * Append a finalized/preview run to the local view. Persistence happens
   * in PayrollLifecycleService.finalize() — this is the local refresh.
   */
  upsertRun: (run: PayrollRun) => void;
  /** Mark a run voided locally after lifecycle service has persisted it. */
  applyVoid: (originalId: string, reversal: PayrollRun) => void;
  /** Pull a fresh snapshot from the repo (after finalize/void). */
  refresh: () => Promise<void>;
}

export const usePayrollRuns = create<PayrollStore>((set, get) => ({
  runs: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const runs = await getRepositories().payroll.getAll();
    set({ runs, hydrated: true });
  },

  reset: () => set({ runs: [], hydrated: false }),

  upsertRun: (run) => {
    set((s) => {
      const idx = s.runs.findIndex((r) => r.id === run.id);
      if (idx >= 0) {
        const next = [...s.runs];
        next[idx] = run;
        return { runs: next };
      }
      return { runs: [run, ...s.runs] };
    });
  },

  applyVoid: (originalId, reversal) => {
    set((s) => {
      const next = s.runs.map((r) =>
        r.id === originalId
          ? { ...r, status: "voided" as const, voidedBy: reversal.id }
          : r
      );
      return { runs: [reversal, ...next] };
    });
  },

  refresh: async () => {
    const runs = await getRepositories().payroll.getAll();
    set({ runs });
  },
}));
