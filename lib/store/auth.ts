import { create } from "zustand";
import { supabase } from "@/lib/supabase/client";
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
  }) => Promise<{ ok: true; needsConfirmation?: boolean } | { ok: false; error: string }>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  requestPasswordReset: (
    email: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  resetPassword: (
    newPassword: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
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

  signup: async ({ firstName, lastName, email, password }) => {
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

    // Supabase may require email confirmation (depends on project settings).
    // If session is null but user exists, confirmation email was sent.
    if (data.user && !data.session) {
      return { ok: true, needsConfirmation: true };
    }
    set({ user: sessionToUser(data.session) });
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
}));
