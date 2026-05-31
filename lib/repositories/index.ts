import type { Repositories } from "./types";
import { createLocalStorageRepositories } from "./local-storage";
// import { createSupabaseRepositories } from "./supabase";

/**
 * Single switch point for the storage backend.
 *
 * To go to production:
 *   return createSupabaseRepositories();
 *
 * The rest of the application does not know which backend is wired in.
 */
let _instance: Repositories | null = null;

export function getRepositories(): Repositories {
  if (_instance) return _instance;
  _instance = createLocalStorageRepositories();
  return _instance;
}

/** Test-only override. Do not call from product code. */
export function __setRepositoriesForTest(repos: Repositories) {
  _instance = repos;
}
