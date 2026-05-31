"use client";

import { useEffect } from "react";
import { useEmployees } from "./employees";
import { usePayrollRuns } from "./payroll";
import { useSettings } from "./settings";
import { useRemittance } from "./remittance";
import { useProfile } from "./profile";
import { useAuth } from "./auth";

/**
 * Single client-side hook to hydrate every store from the repository.
 * Mount once at the dashboard root.
 */
export function useHydrateStores() {
  const hydrateEmployees = useEmployees((s) => s.hydrate);
  const hydratePayroll = usePayrollRuns((s) => s.hydrate);
  const hydrateSettings = useSettings((s) => s.hydrate);
  const hydrateRemittance = useRemittance((s) => s.hydrate);
  const hydrateProfile = useProfile((s) => s.hydrate);
  const hydrateAuth = useAuth((s) => s.hydrate);

  useEffect(() => {
    // Auth first so any auth-dependent UI sees the user on the first render.
    hydrateAuth();
    void hydrateEmployees();
    void hydratePayroll();
    void hydrateSettings();
    hydrateRemittance();
    hydrateProfile();
  }, [
    hydrateAuth,
    hydrateEmployees,
    hydratePayroll,
    hydrateSettings,
    hydrateRemittance,
    hydrateProfile,
  ]);
}
