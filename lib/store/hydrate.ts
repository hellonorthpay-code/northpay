"use client";

import { useEffect } from "react";
import { useEmployees } from "./employees";
import { usePayrollRuns } from "./payroll";
import { useSettings } from "./settings";
import { useRemittance } from "./remittance";

/**
 * Single client-side hook to hydrate every store from the repository.
 * Mount once at the dashboard root.
 */
export function useHydrateStores() {
  const hydrateEmployees = useEmployees((s) => s.hydrate);
  const hydratePayroll = usePayrollRuns((s) => s.hydrate);
  const hydrateSettings = useSettings((s) => s.hydrate);
  const hydrateRemittance = useRemittance((s) => s.hydrate);

  useEffect(() => {
    void hydrateEmployees();
    void hydratePayroll();
    void hydrateSettings();
    hydrateRemittance();
  }, [
    hydrateEmployees,
    hydratePayroll,
    hydrateSettings,
    hydrateRemittance,
  ]);
}
