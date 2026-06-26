"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store/auth";
import { LoginScreen } from "@/components/dashboard/profile/login-screen";

/**
 * Standalone login route — deliberately NOT under /dashboard, so it only gets
 * the (light) root layout and none of the dashboard machinery (stores, sidebar,
 * topbar, hydration). That's what makes it open on the first tap with no delay.
 *
 * The form is shown immediately (no waiting on auth hydration). If it turns out
 * the visitor is already signed in, we send them into the app.
 */
export default function LoginPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const hydrate = useAuth((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && user) router.replace("/dashboard/employees");
  }, [hydrated, user, router]);

  if (hydrated && user) return null;
  return <LoginScreen />;
}
