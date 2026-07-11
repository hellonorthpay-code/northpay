"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Landmark, Play, Settings, ShieldCheck, Users } from "lucide-react";
import { useIsAdmin } from "@/lib/admin/client";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard/employees", label: "Employees", icon: Users },
  { href: "/dashboard/payroll", label: "Payroll", icon: Play },
  // CRA now also holds year-end reports (T4/T4A/ROE).
  { href: "/dashboard/cra", label: "CRA", icon: Landmark },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const IOS_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function Sidebar() {
  const pathname = usePathname();
  const isAdmin = useIsAdmin();
  // Admin tab only renders for allowlisted accounts; the server enforces this
  // independently, so hiding it here is purely cosmetic.
  const navTabs = isAdmin
    ? [...tabs, { href: "/dashboard/admin", label: "Admin", icon: ShieldCheck }]
    : tabs;

  const activeHref =
    navTabs.find(
      (t) => pathname === t.href || pathname.startsWith(t.href + "/"),
    )?.href ?? null;

  // ── Sliding highlight (framer-free, same as the landing nav) ──
  // One absolutely-positioned pill measures the active tab and glides
  // vertically between tabs with a CSS transition. Keeps the dashboard
  // layout — and the login route it wraps — off framer's eager path.
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [pill, setPill] = useState({
    top: 0,
    height: 0,
    visible: false,
  });
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    function measure() {
      const nav = navRef.current;
      const el = activeHref ? itemRefs.current[activeHref] : null;
      if (!nav || !el) {
        setPill((p) => ({ ...p, visible: false }));
        return;
      }
      const navBox = nav.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      setPill({
        top: box.top - navBox.top,
        height: box.height,
        visible: true,
      });
      requestAnimationFrame(() => setReady(true));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // isAdmin changes the tab list (Admin appears), shifting positions.
  }, [activeHref, isAdmin]);

  return (
    <aside className="sticky top-5 hidden h-[calc(100vh-40px)] w-[232px] shrink-0 md:block">
      <div className="glass-strong flex h-full flex-col rounded-3xl p-3 shadow-soft">
        <Link
          href="/"
          className="group flex items-center gap-2 px-3 py-3 text-[15px] font-semibold tracking-tight"
        >
          <span className="grid h-7 w-7 place-items-center rounded-xl bg-foreground text-background transition-transform duration-300 ease-out group-hover:scale-105 group-active:scale-95">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 13V3l10 10V3"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          NorthPay
        </Link>

        <nav ref={navRef} className="relative mt-4 flex flex-col gap-1">
          {/* The one gliding highlight — slides vertically between tabs. */}
          <span
            aria-hidden
            className="absolute inset-x-0 rounded-2xl bg-muted/80 dark:bg-white/[0.08]"
            style={{
              top: pill.top,
              height: pill.height,
              opacity: pill.visible ? 1 : 0,
              transition: ready
                ? `top 420ms ${IOS_EASE}, height 420ms ${IOS_EASE}, opacity 220ms ease`
                : "none",
            }}
          />
          {navTabs.map((tab) => {
            const active = tab.href === activeHref;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                ref={(el) => {
                  itemRefs.current[tab.href] = el;
                }}
                className={cn(
                  "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-medium",
                  "transition-[color,background-color,transform] duration-300 ease-out active:scale-[0.97]",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground dark:hover:bg-white/[0.04]",
                )}
              >
                <tab.icon
                  className={cn(
                    "relative z-10 h-[18px] w-[18px] transition-transform duration-300 ease-out",
                    active ? "scale-110" : "group-hover:scale-110 group-hover:-rotate-3",
                  )}
                />
                <span className="relative z-10">{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-border/60 bg-background/40 p-4">
          <p className="text-[12px] font-medium tracking-tight">
            2026 CRA tables loaded
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Federal · CPP · EI · 9 provinces. Updated as values are finalized.
          </p>
        </div>
      </div>
    </aside>
  );
}
