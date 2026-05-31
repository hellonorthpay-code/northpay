"use client";

import { create } from "zustand";

/**
 * Tracks which monthly remittances the operator has marked as "Remitted to CRA".
 * Map shape: { "2026-04": "2026-05-10T14:23:00.000Z", ... }
 *
 * Persisted directly to localStorage (lightweight — no full repository layer).
 */
interface RemittanceStore {
  remitted: Record<string, string>;
  hydrated: boolean;
  hydrate: () => void;
  markRemitted: (monthKey: string) => void;
  unmark: (monthKey: string) => void;
}

const STORAGE_KEY = "northpay.cra.remittance";

function read(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function write(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export const useRemittance = create<RemittanceStore>((set, get) => ({
  remitted: {},
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({ remitted: read(), hydrated: true });
  },

  markRemitted: (monthKey) => {
    set((s) => {
      const next = { ...s.remitted, [monthKey]: new Date().toISOString() };
      write(next);
      return { remitted: next };
    });
  },

  unmark: (monthKey) => {
    set((s) => {
      const next = { ...s.remitted };
      delete next[monthKey];
      write(next);
      return { remitted: next };
    });
  },
}));
