"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * First-party page-view beacon.
 *
 * Fires once per public page view, including soft navigations. Deliberately
 * NOT fired for /dashboard or /login: those are people using the product,
 * and mixing them into traffic would inflate "visitors" with your own team
 * and make the audience numbers useless.
 *
 * `keepalive` lets the request survive the page being closed, so a visitor
 * who lands and immediately leaves still counts — those are exactly the
 * sessions a naive tracker loses.
 */
export function AnalyticsBeacon() {
  const pathname = usePathname();
  // A ref, not state: recording a send must never trigger a re-render.
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (/^\/(dashboard|login|auth)(\/|$)/.test(pathname)) return;
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    try {
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: pathname,
          referrer: document.referrer || undefined,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Analytics must never break a page.
    }
  }, [pathname]);

  return null;
}
