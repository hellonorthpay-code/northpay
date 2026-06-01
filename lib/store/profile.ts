import { create } from "zustand";
import { supabase } from "@/lib/supabase/client";

/**
 * Operator profile — the human running payroll.
 * Persisted in Supabase `profiles` table (one row per auth user).
 */
export interface Profile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  timezone: string;
  joinedAt: string;
}

interface ProfileStore {
  profile: Profile;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  reset: () => void;
  setProfile: (patch: Partial<Profile>) => Promise<void>;
}

const DEFAULT_PROFILE: Profile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  timezone: "America/Toronto",
  joinedAt: new Date().toISOString().slice(0, 10),
};

export const useProfile = create<ProfileStore>((set, get) => ({
  profile: DEFAULT_PROFILE,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ hydrated: true });
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    set({
      profile: {
        firstName: data?.first_name || user.user_metadata?.first_name || "",
        lastName: data?.last_name || user.user_metadata?.last_name || "",
        email: data?.email || user.email || "",
        phone: data?.phone || "",
        timezone: data?.timezone || "America/Toronto",
        joinedAt: data?.joined_at || new Date().toISOString().slice(0, 10),
      },
      hydrated: true,
    });
  },

  reset: () => set({ profile: DEFAULT_PROFILE, hydrated: false }),

  setProfile: async (patch) => {
    // Optimistic update — UI feels instant
    set((s) => ({ profile: { ...s.profile, ...patch } }));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const row: Record<string, unknown> = { id: user.id };
    if (patch.firstName !== undefined) row.first_name = patch.firstName;
    if (patch.lastName !== undefined) row.last_name = patch.lastName;
    if (patch.email !== undefined) row.email = patch.email;
    if (patch.phone !== undefined) row.phone = patch.phone;
    if (patch.timezone !== undefined) row.timezone = patch.timezone;
    if (patch.joinedAt !== undefined) row.joined_at = patch.joinedAt;

    await supabase.from("profiles").upsert(row);
  },
}));
