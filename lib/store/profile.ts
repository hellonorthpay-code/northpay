import { create } from "zustand";

/**
 * Operator profile — the human running payroll, not the employees being
 * paid. Single-user for now (no auth yet); stored in localStorage so it
 * survives reloads without a server round-trip.
 */
export interface Profile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  timezone: string;
  /** ISO date string — when the account was created. */
  joinedAt: string;
}

interface ProfileStore {
  profile: Profile;
  hydrated: boolean;
  hydrate: () => void;
  setProfile: (patch: Partial<Profile>) => void;
}

const PROFILE_KEY = "northpay.profile";

const DEFAULT_PROFILE: Profile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  timezone:
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto"
      : "America/Toronto",
  joinedAt: new Date().toISOString().slice(0, 10),
};

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) } as T;
  } catch {
    return fallback;
  }
}

function writeLS<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const useProfile = create<ProfileStore>((set, get) => ({
  profile: DEFAULT_PROFILE,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const profile = readLS<Profile>(PROFILE_KEY, DEFAULT_PROFILE);
    set({ profile, hydrated: true });
  },

  setProfile: (patch) => {
    set((s) => {
      const next = { ...s.profile, ...patch };
      writeLS(PROFILE_KEY, next);
      return { profile: next };
    });
  },
}));
