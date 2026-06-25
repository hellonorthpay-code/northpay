"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Subtle top progress bar that blinks on every navigation. Pages are
 * pre-rendered so navigation is effectively instant — the bar is purely a
 * perceptual cue ("something happened") and disappears within ~600ms.
 *
 * Pure CSS (tailwindcss-animate + a keyframe in globals.css) — no framer-motion,
 * so this root-layout component doesn't pull framer onto the homepage's eager
 * path.
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

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] overflow-hidden duration-150 animate-in fade-in">
      <div className="route-progress-bar h-full w-full bg-gradient-to-r from-rose-300/0 via-foreground to-sky-300/0 dark:via-white" />
    </div>
  );
}
