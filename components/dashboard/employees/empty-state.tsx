"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

interface Props {
  /** Viewport-space centre of the tapped element so the AddEmployee modal
      can swell out of the exact pixel. */
  onAdd: (origin: { x: number; y: number }) => void;
}

/**
 * First-run hero — intentionally minimal.
 *
 * One focal element (a softly breathing "+" tile) does the work of three.
 * Title, one line of copy, one CTA. No steps, no avatar trio, no badge.
 * The card itself is the same rounded-3xl glass surface used everywhere
 * else so it feels like part of the system, not a special interstitial.
 */
export function EmployeesEmpty({ onAdd }: Props) {
  const tileRef = useRef<HTMLButtonElement>(null);

  function fire(ref: React.RefObject<HTMLElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onAdd({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 px-6 py-16 text-center shadow-soft backdrop-blur-xl md:py-24"
    >
      {/* Soft background orbs — keep them quiet */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-rose-200/25 blur-3xl dark:bg-rose-500/10" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-sky-200/25 blur-3xl dark:bg-sky-500/10" />

      <div className="relative mx-auto max-w-[380px]">
        {/* The single focal element — a breathing tile that IS the CTA. */}
        <motion.button
          ref={tileRef}
          type="button"
          onClick={() => fire(tileRef)}
          aria-label="Add your first employee"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="mx-auto grid h-24 w-24 place-items-center rounded-[26px] bg-foreground text-background shadow-pop transition-shadow hover:shadow-[0_22px_60px_-12px_rgba(0,0,0,0.45)] dark:bg-white dark:text-black"
        >
          <Plus className="h-8 w-8" strokeWidth={2.2} />
        </motion.button>

        <h2 className="mt-7 text-[22px] font-semibold tracking-tightest md:text-[26px]">
          Add your first employee
        </h2>
        <p className="mx-auto mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          Tap the tile above. Takes about a minute.
        </p>
      </div>
    </motion.section>
  );
}
