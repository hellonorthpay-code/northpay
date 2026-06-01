import { create } from "zustand";
import { useProfile } from "./profile";

/**
 * Client-only mock auth.
 *
 * No real backend / OAuth yet. Accounts live in localStorage:
 *   • northpay.auth.users    — every signed-up user (email is the key)
 *   • northpay.auth.session  — email of the currently logged-in user, or null
 *
 * On first run we seed an admin account so reviewers can log in immediately:
 *   email:    admin@northpay.ca
 *   password: northpay2026
 *
 * "Continue with Google" is a UI stub that creates / logs in a demo Google
 * user. Replace this whole module with a real auth provider (NextAuth,
 * Clerk, Supabase, etc.) when the backend lands.
 */
export type AuthProvider = "email" | "google";

export interface AuthUser {
  email: string;
  firstName: string;
  lastName: string;
  provider: AuthProvider;
}

/** Stored record — same shape as AuthUser plus the (plain-text) password. */
interface StoredUser extends AuthUser {
  password: string;
}

interface AuthStore {
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => void;
  login: (email: string, password: string) =>
    { ok: true } | { ok: false; error: string };
  signup: (input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => { ok: true } | { ok: false; error: string };
  loginWithGoogle: () => void;
  logout: () => void;
  /** Mock — pretends to email a reset link. Returns ok if the email is on file. */
  requestPasswordReset: (email: string) =>
    { ok: true } | { ok: false; error: string };
  /** Mock — directly updates the stored password (no token required). */
  resetPassword: (email: string, newPassword: string) =>
    { ok: true } | { ok: false; error: string };
}

const USERS_KEY = "northpay.auth.users";
const SESSION_KEY = "northpay.auth.session";

/** Sample admin account — seeded on first run. */
export const ADMIN_CREDENTIALS = {
  email: "admin@northpay.ca",
  password: "northpay2026",
} as const;

const SEED_ADMIN: StoredUser = {
  email: ADMIN_CREDENTIALS.email,
  password: ADMIN_CREDENTIALS.password,
  firstName: "Sam",
  lastName: "Admin",
  provider: "email",
};

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLS<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function loadUsers(): StoredUser[] {
  return readLS<StoredUser[]>(USERS_KEY, []);
}

function saveUsers(users: StoredUser[]) {
  writeLS(USERS_KEY, users);
}

function publicUser(u: StoredUser): AuthUser {
  return {
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    provider: u.provider,
  };
}

/** Pull name/email from the auth user into the profile on first login. */
function seedProfileFromAuth(user: AuthUser) {
  const { profile, setProfile } = useProfile.getState();
  setProfile({
    firstName: profile.firstName || user.firstName,
    lastName: profile.lastName || user.lastName,
    email: profile.email || user.email,
  });
}

export const useAuth = create<AuthStore>((set, get) => ({
  user: null,
  hydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") return;
    if (get().hydrated) return;

    // First-run seeding: drop the admin in if no users exist yet.
    let users = loadUsers();
    if (users.length === 0) {
      users = [SEED_ADMIN];
      saveUsers(users);
    }

    const sessionEmail = readLS<string | null>(SESSION_KEY, null);
    const session = sessionEmail
      ? users.find((u) => u.email === sessionEmail) ?? null
      : null;

    set({ user: session ? publicUser(session) : null, hydrated: true });
  },

  login: (emailInput, password) => {
    const email = emailInput.trim().toLowerCase();
    const users = loadUsers();
    const found = users.find((u) => u.email.toLowerCase() === email);
    if (!found) return { ok: false, error: "No account found for that email." };
    if (found.password !== password)
      return { ok: false, error: "Incorrect password." };
    writeLS(SESSION_KEY, found.email);
    const user = publicUser(found);
    set({ user });
    seedProfileFromAuth(user);
    return { ok: true };
  },

  signup: ({ firstName, lastName, email: emailInput, password }) => {
    const email = emailInput.trim().toLowerCase();
    if (!firstName.trim() || !lastName.trim())
      return { ok: false, error: "Please enter your name." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return { ok: false, error: "That doesn't look like a valid email." };
    if (password.length < 6)
      return { ok: false, error: "Password must be at least 6 characters." };

    const users = loadUsers();
    if (users.some((u) => u.email.toLowerCase() === email))
      return { ok: false, error: "An account with that email already exists." };

    const stored: StoredUser = {
      email,
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      provider: "email",
    };
    users.push(stored);
    saveUsers(users);
    writeLS(SESSION_KEY, stored.email);
    const user = publicUser(stored);
    set({ user });
    seedProfileFromAuth(user);
    return { ok: true };
  },

  loginWithGoogle: () => {
    // Mock: create / reuse a demo Google account.
    const email = "demo.user@gmail.com";
    const users = loadUsers();
    let stored = users.find((u) => u.email === email);
    if (!stored) {
      stored = {
        email,
        password: "",
        firstName: "Demo",
        lastName: "User",
        provider: "google",
      };
      users.push(stored);
      saveUsers(users);
    }
    writeLS(SESSION_KEY, stored.email);
    const user = publicUser(stored);
    set({ user });
    seedProfileFromAuth(user);
  },

  logout: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_KEY);
    }
    set({ user: null });
  },

  requestPasswordReset: (emailInput) => {
    const email = emailInput.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return { ok: false, error: "That doesn't look like a valid email." };
    const users = loadUsers();
    const found = users.find((u) => u.email.toLowerCase() === email);
    if (!found) return { ok: false, error: "No account found for that email." };
    // Mock: in real life we'd send an email. Here we just succeed.
    return { ok: true };
  },

  resetPassword: (emailInput, newPassword) => {
    const email = emailInput.trim().toLowerCase();
    if (newPassword.length < 6)
      return { ok: false, error: "Password must be at least 6 characters." };
    const users = loadUsers();
    const idx = users.findIndex((u) => u.email.toLowerCase() === email);
    if (idx === -1) return { ok: false, error: "No account found for that email." };
    if (users[idx].provider === "google")
      return {
        ok: false,
        error: "This account uses Google sign-in — there's no password to reset.",
      };
    users[idx] = { ...users[idx], password: newPassword };
    saveUsers(users);
    return { ok: true };
  },
}));
