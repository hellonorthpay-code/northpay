"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { useWelcome } from "@/lib/store/welcome";

/**
 * Full-screen "Welcome to NorthPay" green-check overlay shown right after
 * sign-up. Rendered by the dashboard layout so it survives the route change to
 * Employees, then fades itself out. Pure CSS (tailwindcss-animate) — no
 * framer-motion, so the login route stays framer-free and opens fast.
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

  if (!mounted || !show) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] grid place-items-center bg-background px-6 duration-300 animate-in fade-in">
      <div className="text-center">
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-success/15 duration-500 animate-in zoom-in-50">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Welcome to
        </p>
        <p className="mt-1 text-[30px] font-semibold leading-none tracking-tightest">
          NorthPay
        </p>
        <p className="mt-3 text-[13.5px] text-muted-foreground">
          Setting up your workspace…
        </p>
      </div>
    </div>,
    document.body
  );
}
