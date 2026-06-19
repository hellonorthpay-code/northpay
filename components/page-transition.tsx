"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Opacity-only crossfade for every top-LEVEL route change.
 *
 * We key on the first path segment ("/", "/dashboard", "/about") rather
 * than the full pathname so navigating inside a section — Employees →
 * Payroll, for example — does NOT remount the entire layout and lose
 * sidebar/pill state.
 *
 * IMPORTANT: this animates ONLY opacity. Any `transform` (even a settled
 * translateY(0)) — or `will-change: transform` — turns this wrapper into a
 * containing block, which breaks `position: sticky` (the homepage is built
 * from sticky scroll scenes → it would render blank) and `position: fixed`
 * descendants (modals, the login video). Keep it transform-free.
 *
 * Pairs with <RouteProgressBar> below for perceived load smoothness.
 */
function topSegment(pathname: string | null): string {
  if (!pathname || pathname === "/") return "/";
  const parts = pathname.split("/").filter(Boolean);
  return "/" + (parts[0] ?? "");
}

// Tracks the mobile breakpoint (<768px). Initialised false; corrected in an
// effect before any navigation happens, so the transition timing is right by
// the time the user taps.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return isMobile;
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const segment = topSegment(pathname);
  const isMobile = useIsMobile();

  // On mobile the homepage is heavy (cinematic, blur-heavy scroll scenes).
  // Compositing it as a slow fade-out tanks the GPU and makes the next page
  // feel like it "takes time" to arrive. So on mobile the exit is near-instant
  // (the heavy page clears in a frame or two) and the enter is quick. Desktop
  // keeps the calmer 200ms crossfade. Opacity-ONLY on both — a transform here
  // would create a containing block and break the homepage's sticky scenes.
  const variants = {
    initial: { opacity: 0 },
    enter: {
      opacity: 1,
      transition: { duration: isMobile ? 0.16 : 0.2, ease },
    },
    exit: {
      opacity: 0,
      transition: { duration: isMobile ? 0.07 : 0.2, ease },
    },
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={segment}
        variants={variants}
        initial="initial"
        animate="enter"
        exit="exit"
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
