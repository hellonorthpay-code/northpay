"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store/auth";

// Profile settings are heavy and only relevant once signed in — lazy-load.
const ProfileView = dynamic(
  () =>
    import("@/components/dashboard/profile/profile-view").then(
      (m) => m.ProfileView
    ),
  { ssr: false, loading: () => null }
);

export default function ProfilePage() {
  const router = useRouter();
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);
  const hydrate = useAuth((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Signed-out visitors belong on the standalone /login route, not here.
  useEffect(() => {
    if (hydrated && !user) router.replace("/login");
  }, [hydrated, user, router]);

  if (!hydrated || !user) return null;
  return <ProfileView />;
}
