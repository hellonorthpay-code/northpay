import { create } from "zustand";
import { supabase } from "@/lib/supabase/client";
import { resetRepositories } from "@/lib/repositories";
import type { Session } from "@supabase/supabase-js";

export type AuthProvider = "email" | "google";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  provider: AuthProvider;
}

interface AuthStore {
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (
    email: string,
    password: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  signup: (input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<{ ok: true; needsConfirmation?: boolean } | { ok: false; error: string }>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  requestPasswordReset: (
    email: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  resetPassword: (
    newPassword: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Permanently delete the account + all data, then sign out. */
  deleteAccount: () => Promise<{ ok: true } | { ok: false; error: string }>;
}

function sessionToUser(session: Session | null): AuthUser | null {
  if (!session?.user) return null;
  const u = session.user;
  const meta = u.user_metadata ?? {};
  return {
    id: u.id,
    email: u.email ?? "",
    firstName: meta.first_name ?? meta.firstName ?? "",
    lastName: meta.last_name ?? meta.lastName ?? "",
    provider:
      (u.app_metadata?.provider as AuthProvider) === "google"
        ? "google"
        : "email",
  };
}

let listenerInstalled = false;

export const useAuth = create<AuthStore>((set, get) => ({
  user: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    set({ user: sessionToUser(session), hydrated: true });

    // Listen for sign-in / sign-out / token refresh across tabs.
    // Guard against double-mounting in React StrictMode.
    if (!listenerInstalled) {
      listenerInstalled = true;
      supabase.auth.onAuthStateChange((_event, session) => {
        // Reset the repository cache so the next read is scoped to the
        // new user's session (or cleared on sign-out).
        resetRepositories();
        set({ user: sessionToUser(session) });
      });
    }
  },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { ok: false, error: error.message };
    set({ user: sessionToUser(data.session) });
    return { ok: true };
  },

  signup: async ({ firstName, lastName, email, password, phone }) => {
    if (!firstName.trim() || !lastName.trim())
      return { ok: false, error: "Please enter your name." };
    if (password.length < 6)
      return { ok: false, error: "Password must be at least 6 characters." };

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      },
    });
    if (error) return { ok: false, error: error.message };

    // Email confirmation is ON → no session yet; the user must confirm first.
    if (data.user && !data.session) {
      return { ok: true, needsConfirmation: true };
    }

    // Email confirmation is OFF → Supabase returned a live session, so the
    // user is signed in. Save their phone + full profile, then KEEP them
    // logged in (no sign-out) so we can take them straight into the app.
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: (phone ?? "").trim(),
      });
      set({ user: sessionToUser(data.session) });
    }

    return { ok: true };
  },

  loginWithGoogle: async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  },

  logout: async () => {
    await supabase.auth.signOut();
    resetRepositories();
    set({ user: null });
  },

  requestPasswordReset: async (email) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return { ok: false, error: "That doesn't look like a valid email." };

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${
          typeof window !== "undefined" ? window.location.origin : ""
        }/dashboard/reset-password`,
      }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  resetPassword: async (newPassword) => {
    if (newPassword.length < 6)
      return { ok: false, error: "Password must be at least 6 characters." };

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  deleteAccount: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: "Not signed in." };

    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error ?? "Couldn't delete account." };
    }

    await supabase.auth.signOut();
    set({ user: null });
    return { ok: true };
  },
}));
