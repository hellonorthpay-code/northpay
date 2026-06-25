import { create } from "zustand";

/**
 * Tiny global flag for the post-auth "Welcome to NorthPay" overlay.
 *
 * It lives in a store (not in the login view) on purpose: the moment a user
 * signs up/in, the profile route swaps away from the login screen, which would
 * unmount any overlay rendered there. The dashboard layout — which stays
 * mounted across /dashboard/* routes — renders the overlay instead, so it
 * survives the navigation from /dashboard/profile to /dashboard/employees.
 */
interface WelcomeStore {
  show: boolean;
  trigger: () => void;
  hide: () => void;
}

export const useWelcome = create<WelcomeStore>((set) => ({
  show: false,
  trigger: () => set({ show: true }),
  hide: () => set({ show: false }),
}));
