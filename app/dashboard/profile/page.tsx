"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/store/auth";
import { LoginScreen } from "@/components/dashboard/profile/login-screen";

// The logged-in profile UI (settings, delete-account flow, desktop video) is
// heavy and only needed once authenticated. Lazy-load it so a first-time
// visitor's login page downloads a small bundle and switches in fast on mobile.
const ProfileView = dynamic(
  () =>
    import("@/components/dashboard/profile/profile-view").then(
      (m) => m.ProfileView
    ),
  { ssr: false, loading: () => null }
);

export default function ProfilePage() {
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);
  const hydrate = useAuth((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Until the session resolves, render nothing — the dashboard loading.tsx
  // covers the cold-load case with the NorthPay spinner.
  if (!hydrated) return null;
  return user ? <ProfileView /> : <LoginScreen />;
}
