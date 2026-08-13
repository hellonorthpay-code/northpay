"use client";

// ─────────────────────────────────────────────────────────────────────────
// Recovery-mode flag.
//
// A password-reset link signs the visitor into a REAL Supabase session so
// they're allowed to call updateUser({ password }). Without a guard they can
// simply tap a nav item and land inside the app — logged in, having never
// proven they know (or set) a password.
//
// While this flag is set the app is locked to the reset screen: navs are
// hidden and RecoveryGuard bounces every other route back. Every exit path
// (password saved, cancel, invalid link) clears it — and cancel/expired also
// signs the recovery session out.
//
// localStorage (not sessionStorage) so a second tab can't slip past it.
// ─────────────────────────────────────────────────────────────────────────

const KEY = "northpay:recovery";

export function markRecovery() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {}
}

export function clearRecovery() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}

export function isRecovery(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export const RESET_PATH = "/dashboard/reset-password";
