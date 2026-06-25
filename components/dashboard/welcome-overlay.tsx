"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useWelcome } from "@/lib/store/welcome";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Full-screen "Welcome to NorthPay" green-check overlay shown right after
 * sign-up. Rendered by the dashboard layout so it stays up while the app routes
 * from the login screen to Employees, then fades itself out. Portaled to
 * <body> so an animated/transformed layout ancestor can't break its fixed
 * positioning. See lib/store/welcome.ts for the why.
 */
export function WelcomeOverlay() {
  const show = useWelcome((s) => s.show);
  const hide = useWelcome((s) => s.hide);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(hide, 1900);
    return () => window.clearTimeout(t);
  }, [show, hide]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          key="welcome-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease }}
          className="fixed inset-0 z-[120] grid place-items-center bg-background px-6"
        >
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.1 }}
              className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-success/15"
            >
              <CheckCircle2 className="h-10 w-10 text-success" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease, delay: 0.2 }}
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Welcome to
              </p>
              <p className="mt-1 text-[30px] font-semibold leading-none tracking-tightest">
                NorthPay
              </p>
              <p className="mt-3 text-[13.5px] text-muted-foreground">
                Setting up your workspace…
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
