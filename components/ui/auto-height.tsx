"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Eases a container between the heights of whatever it contains, instead of
 * letting it snap when a child is swapped or grows.
 *
 * Animates `height` — deliberately NOT a layout/transform animation. A
 * transform left on an ancestor of an <input> makes mobile browsers draw the
 * caret in the wrong place; height carries no such risk.
 *
 * A ResizeObserver tracks the content, so it follows a child that grows in
 * place (a validation line, a revealed field), not just wholesale swaps.
 * The first measurement is applied without animation so the container opens
 * at its natural size rather than growing into it.
 */
export function AutoHeight({
  children,
  className,
  duration = 0.42,
}: {
  children: React.ReactNode;
  className?: string;
  duration?: number;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  const first = useRef(true);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    first.current = false;
  }, []);

  return (
    <motion.div
      animate={{ height }}
      initial={false}
      transition={first.current ? { duration: 0 } : { duration, ease: EASE }}
      style={{ overflow: "hidden" }}
      className={className}
    >
      {/* `relative` so an exiting child that AnimatePresence pops out of
          flow (mode="popLayout") is positioned against this box. */}
      <div ref={inner} className="relative">
        {children}
      </div>
    </motion.div>
  );
}
