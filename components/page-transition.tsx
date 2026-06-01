"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Crossfade-+-tiny-y for every top-LEVEL route change.
 *
 * We key on the first path segment ("/", "/dashboard", "/about") rather
 * than the full pathname so navigating inside a section — Employees →
 * Payroll, for example — does NOT remount the entire layout and lose
 * sidebar/pill state. The dashboard already has its own inner
 * AnimatePresence for those intra-section swaps; this outer one only
 * fires when crossing top-level boundaries.
 *
 * Pairs with <RouteProgressBar> below for perceived load smoothness.
 */
function topSegment(pathname: string | null): string {
  if (!pathname || pathname === "/") return "/";
  const parts = pathname.split("/").filter(Boolean);
  return "/" + (parts[0] ?? "");
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const segment = topSegment(pathname);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={segment}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{
          opacity: { duration: 0.22, ease },
          y: { duration: 0.32, ease },
          exit: { duration: 0.14 },
        }}
        className="will-change-[opacity,transform]"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Subtle top progress bar that blinks on every navigation. Pages are
 * pre-rendered so navigation is effectively instant — the bar is purely
 * a perceptual cue ("something happened") and disappears within ~600ms.
 */
export function RouteProgressBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    // Skip the very first render — the initial paint isn't a navigation.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setVisible(true);
    const hide = window.setTimeout(() => setVisible(false), 520);
    return () => window.clearTimeout(hide);
  }, [pathname]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="route-progress"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] overflow-hidden"
        >
          <motion.div
            initial={{ width: "5%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 0.5, ease }}
            className="h-full bg-gradient-to-r from-rose-300/0 via-foreground to-sky-300/0 dark:via-white"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
