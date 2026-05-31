import { create } from "zustand";
import type { CompanySettings } from "@/lib/payroll/types";
import { getRepositories } from "@/lib/repositories";
import { AuditLogService } from "@/lib/services/audit";

interface SettingsStore {
  company: CompanySettings;
  theme: "light" | "dark" | "system";
  notifications: {
    payrollReminders: boolean;
    paystubReady: boolean;
    productUpdates: boolean;
  };
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setCompany: (patch: Partial<CompanySettings>) => Promise<void>;
  setTheme: (theme: "light" | "dark" | "system") => void;
  toggleNotification: (key: keyof SettingsStore["notifications"]) => void;
}

const DEFAULT_COMPANY: CompanySettings = {
  legalName: "Northwind Coffee Roasters Inc.",
  operatingName: "Northwind Coffee",
  businessNumber: "123456789 RP0001",
  craPayrollAccount: "RP0001",
  defaultProvince: "ON",
  defaultPayFrequency: "biweekly",
  address: "240 Queen St W",
  city: "Toronto",
  postalCode: "M5V 2A1",
};

// Theme + notifications stay in localStorage directly (cosmetic, not
// payroll data). Only `company` is persisted through the repository so
// it can later live in the same multi-tenant DB row.
const THEME_KEY = "northpay.ui.theme";
const NOTIF_KEY = "northpay.ui.notifications";

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

// Applies the resolved theme to the <html> class. Without this the store
// flips state but nothing repaints until the next full page load.
function applyThemeToDom(theme: "light" | "dark" | "system") {
  if (typeof window === "undefined") return;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
}

// One global listener that keeps "system" mode tracking the OS preference
// live. Installed lazily the first time someone uses the store.
let systemListenerInstalled = false;
function installSystemThemeListener(getTheme: () => "light" | "dark" | "system") {
  if (systemListenerInstalled || typeof window === "undefined") return;
  systemListenerInstalled = true;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", () => {
    if (getTheme() === "system") applyThemeToDom("system");
  });
}

export const useSettings = create<SettingsStore>((set, get) => ({
  company: DEFAULT_COMPANY,
  theme: "system",
  notifications: {
    payrollReminders: true,
    paystubReady: true,
    productUpdates: false,
  },
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const company = await getRepositories().settings.get();
    const theme = readLS<SettingsStore["theme"]>(THEME_KEY, "system");
    const notifications = readLS<SettingsStore["notifications"]>(
      NOTIF_KEY,
      get().notifications
    );
    set({ company, theme, notifications, hydrated: true });
    applyThemeToDom(theme);
    installSystemThemeListener(() => get().theme);
  },

  setCompany: async (patch) => {
    const repos = getRepositories();
    const audit = new AuditLogService(repos.audit);
    const updated = await repos.settings.update(patch);
    set({ company: updated });
    await audit.log("settings.updated", {
      fields: Object.keys(patch).join(","),
    });
  },

  setTheme: (theme) => {
    writeLS(THEME_KEY, theme);
    set({ theme });
    applyThemeToDom(theme);
    installSystemThemeListener(() => get().theme);
  },

  toggleNotification: (key) => {
    set((s) => {
      const next = { ...s.notifications, [key]: !s.notifications[key] };
      writeLS(NOTIF_KEY, next);
      return { notifications: next };
    });
  },
}));
