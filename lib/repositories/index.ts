import type { Repositories } from "./types";
import { createSupabaseRepositories } from "./supabase";

/**
 * Single switch point for the storage backend.
 * Now wired to Supabase — data is per-user via RLS.
 */
let _instance: Repositories | null = null;

export function getRepositories(): Repositories {
  if (_instance) return _instance;
  _instance = createSupabaseRepositories();
  return _instance;
}

// Reset the singleton when the auth user changes so the next call
// gets a fresh repository scoped to the new user's session.
export function resetRepositories() {
  _instance = null;
}

/** Test-only override. Do not call from product code. */
export function __setRepositoriesForTest(repos: Repositories) {
  _instance = repos;
}
