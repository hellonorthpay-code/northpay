"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { useHydrateStores } from "@/lib/store/hydrate";
import { useAuth } from "@/lib/store/auth";

const ease = [0.22, 1, 0.36, 1] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  useHydrateStores();
  const { user, hydrated: authHydrated } = useAuth();

  // Route guard: only the unauthenticated-friendly routes (profile +
  // reset-password) are accessible without a session. Everything else
  // bounces to /dashboard/profile (which renders the login card).
  const isPublicAuthRoute =
    pathname.startsWith("/dashboard/profile") ||
    pathname.startsWith("/dashboard/reset-password");

  // Welcome/onboarding is authed but should render chrome-free (no sidebar,
  // no topbar) so it feels like a dedicated moment.
  const isWelcome = pathname.startsWith("/dashboard/welcome");

  // Sidebar (Employees/Payroll/CRA/Settings) is the payroll workflow nav —
  // it doesn't belong on personal-account pages. Hide it on profile,
  // reset-password, and welcome regardless of auth state.
  const hideSidebar = isPublicAuthRoute || isWelcome;
  // Topbar is hidden only on full-canvas moments (welcome, and the login
  // card shown to signed-out users). The signed-in profile keeps its title.
  const hideTopbar = isWelcome || (isPublicAuthRoute && !user);

  // The signed-out login card should materialise with a calm opacity-only
  // fade. The richer scale/slide entrance below is tuned for the authenticated
  // dashboard reveal; on the login card it stacks under the route crossfade
  // and reads as a heavy, late "swoop" — i.e. not smooth.
  const isLoginCard = (isPublicAuthRoute || isWelcome) && !user;

  useEffect(() => {
    if (!authHydrated) return;
    if (user) return;
    if (isPublicAuthRoute) return;
    router.replace("/dashboard/profile");
  }, [authHydrated, user, isPublicAuthRoute, router]);

  return (
    <motion.div
      // Login card: no wrapper entrance (initial={false}) so the page chrome
      // is painted instantly and the card itself owns the single, smooth
      // entrance — no stacked fades to flicker against. Authenticated
      // dashboard keeps its richer scale/slide reveal.
      initial={isLoginCard ? false : { opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, ease }}
      className="relative min-h-screen"
    >
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
          {/* Page transition — kept short (180ms in / 120ms out) so it
              runs in parallel with the sidebar pill morph instead of
              outlasting it. The previous 350ms × 2 made tab switches
              feel like two staggered fades, which read as flicker. */}
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              // No inner-page fade on the login card — the card owns the entrance.
              initial={isLoginCard ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 0.18, ease },
                y: { duration: 0.22, ease },
                exit: { duration: 0.12 },
              }}
              className="min-h-0 flex-1"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

    </motion.div>
  );
}
