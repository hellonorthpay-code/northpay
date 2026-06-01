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
 *
 * Order matters:
 *  1. Auth hydrates first (resolves the Supabase session from cookies).
 *  2. Data stores hydrate next, keyed on `user?.id` so they re-fetch
 *     automatically whenever the signed-in user changes.
 *  3. On logout (`user === null`) we reset all data stores so stale data
 *     from the previous session never leaks to the next user.
 */
export function useHydrateStores() {
  const hydrateAuth = useAuth((s) => s.hydrate);
  const user = useAuth((s) => s.user);
  const authHydrated = useAuth((s) => s.hydrated);

  const hydrateEmployees = useEmployees((s) => s.hydrate);
  const resetEmployees = useEmployees((s) => s.reset);

  const hydratePayroll = usePayrollRuns((s) => s.hydrate);
  const resetPayroll = usePayrollRuns((s) => s.reset);

  const hydrateSettings = useSettings((s) => s.hydrate);
  const hydrateRemittance = useRemittance((s) => s.hydrate);
  const hydrateProfile = useProfile((s) => s.hydrate);
  const resetProfile = useProfile((s) => s.reset);

  // Step 1 — resolve auth session on first mount.
  useEffect(() => {
    void hydrateAuth();
  }, [hydrateAuth]);

  // Step 2 — once auth is known, hydrate or clear data stores.
  useEffect(() => {
    if (!authHydrated) return; // wait until auth has resolved

    if (user) {
      // Signed in — load this user's data
      void hydrateEmployees();
      void hydratePayroll();
      void hydrateSettings();
      hydrateRemittance();
      void hydrateProfile();
    } else {
      // Signed out — wipe everything so no data leaks
      resetEmployees();
      resetPayroll();
      resetProfile();
    }
  }, [
    authHydrated,
    user?.id, // re-run if the actual user switches
    hydrateEmployees,
    hydratePayroll,
    hydrateSettings,
    hydrateRemittance,
    hydrateProfile,
    resetEmployees,
    resetPayroll,
    resetProfile,
  ]);
}
