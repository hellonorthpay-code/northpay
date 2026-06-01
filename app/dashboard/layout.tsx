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

  useEffect(() => {
    if (!authHydrated) return;
    if (user) return;
    if (isPublicAuthRoute) return;
    router.replace("/dashboard/profile");
  }, [authHydrated, user, isPublicAuthRoute, router]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
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
        {!isPublicAuthRoute && <Sidebar />}
        <div className="flex min-w-0 flex-1 flex-col gap-4 md:gap-5">
          {/* Hide topbar on login/reset pages — the video fullscreen canvas
              replaces the whole UI so the title label is irrelevant. */}
          {!(isPublicAuthRoute && !user) && <Topbar />}
          {/* Page transition — kept short (180ms in / 120ms out) so it
              runs in parallel with the sidebar pill morph instead of
              outlasting it. The previous 350ms × 2 made tab switches
              feel like two staggered fades, which read as flicker. */}
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 4 }}
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
