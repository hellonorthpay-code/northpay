"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { WelcomeOverlay } from "@/components/dashboard/welcome-overlay";
import { useHydrateStores } from "@/lib/store/hydrate";
import { useAuth } from "@/lib/store/auth";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  useHydrateStores();
  const { user, hydrated: authHydrated } = useAuth();

  // Login now lives at the standalone /login route (outside this layout) so it
  // opens instantly. The only dashboard route reachable without a session is
  // reset-password (opened from an email link). Everything else — including the
  // profile settings page — bounces signed-out visitors to /login.
  const isResetPassword = pathname.startsWith("/dashboard/reset-password");
  const isProfile = pathname.startsWith("/dashboard/profile");
  const isWelcome = pathname.startsWith("/dashboard/welcome");

  // Sidebar (Employees/Payroll/CRA/Settings) is the payroll workflow nav — it
  // doesn't belong on personal-account / full-canvas pages.
  const hideSidebar = isProfile || isResetPassword || isWelcome;
  // Reset-password always hides the topbar — the recovery session is a real
  // session, so any nav link there would drop the visitor into the app
  // without a new password ever being set.
  const hideTopbar = isWelcome || isResetPassword;
  const isLoginCard = (isResetPassword || isWelcome) && !user;

  useEffect(() => {
    if (!authHydrated) return;
    if (user) return;
    if (isResetPassword) return;
    router.replace("/login");
  }, [authHydrated, user, isResetPassword, router]);

  return (
    <div
      // Pure CSS entrance (no framer) so the login route stays framer-free and
      // opens fast. The login card paints instantly; the authed dashboard gets
      // a light fade-in.
      className={cn(
        "relative min-h-screen",
        !isLoginCard && "duration-500 animate-in fade-in"
      )}
    >
      {/* Post-auth welcome — rendered here (not in the login view) so it
          survives the route change from /profile to /employees. */}
      <WelcomeOverlay />

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-32 top-10 h-[420px] w-[420px] rounded-full bg-rose-200/25 blur-3xl dark:bg-rose-500/10" />
        <div className="absolute -right-32 top-40 h-[480px] w-[480px] rounded-full bg-sky-200/25 blur-3xl dark:bg-sky-500/10" />
      </div>

      <div className="mx-auto flex max-w-[1280px] gap-6 px-4 pb-24 pt-6 md:px-5 md:pb-5 md:pt-24 lg:px-8">
        {/* Profile + reset-password are personal-settings flows, not part
            of the payroll workflow, so we hide the dashboard sidebar on
            those for a calmer single-column layout. */}
        {!hideSidebar && <Sidebar />}
        <div className="flex min-w-0 flex-1 flex-col gap-4 md:gap-5">
          {/* Hide topbar on login/welcome — those are full-canvas moments
              where the title label would be noise. */}
          {!hideTopbar && <Topbar />}
          <div className="min-h-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
