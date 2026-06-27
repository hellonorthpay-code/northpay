"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/**
 * Everything below the hero, loaded lazily (client-only, ssr:false) so it does
 * NOT block the homepage's initial hydration. The hero + the fixed nav become
 * interactive immediately; these heavy cinematic / scroll-linked sections mount
 * just after. Previously they were part of the initial hydration tree, which on
 * mobile kept the main thread busy long enough that taps on the bottom-nav
 * (e.g. Profile) were dropped until hydration finally caught up.
 *
 * NOTE: next/dynamic requires the options to be an inline object literal —
 * a shared `opts` variable fails the build ("options must be an object literal").
 */
const About = dynamic(() => import("./about").then((m) => m.About), {
  ssr: false,
});
const EmployeesScene = dynamic(
  () => import("./cinematic-sections").then((m) => m.EmployeesScene),
  { ssr: false }
);
const ProvinceSection = dynamic(
  () => import("./province").then((m) => m.ProvinceSection),
  { ssr: false }
);
const PaystubSection = dynamic(
  () => import("./paystub").then((m) => m.PaystubSection),
  { ssr: false }
);
const Automation = dynamic(
  () => import("./automation").then((m) => m.Automation),
  { ssr: false }
);
const AutomationScene = dynamic(
  () => import("./cinematic-sections").then((m) => m.AutomationScene),
  { ssr: false }
);
const SuccessScene = dynamic(
  () => import("./cinematic-sections").then((m) => m.SuccessScene),
  { ssr: false }
);
const Footer = dynamic(() => import("./footer").then((m) => m.Footer), {
  ssr: false,
});

export function HomeBelowFold() {
  // Defer everything until the page is settled (first scroll, or a short idle
  // gap) so the hero + nav are interactive immediately.
  const [ready, setReady] = useState(false);
  // The cinematic scroll scenes (framer useScroll loops) run continuous
  // main-thread work that made taps laggy on phones — those stay DESKTOP ONLY.
  // The light, static sections (About, Paystub, Automation, Footer) are safe
  // and DO render on mobile so the homepage isn't bare.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.matchMedia("(max-width: 767px)").matches);
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      setReady(true);
      window.removeEventListener("scroll", go);
      window.clearTimeout(timer);
    };
    window.addEventListener("scroll", go, { passive: true });
    const timer = window.setTimeout(go, 1200);
    return () => {
      window.removeEventListener("scroll", go);
      window.clearTimeout(timer);
    };
  }, []);

  if (!ready) return null;

  return (
    <>
      <About />
      {!isMobile && <EmployeesScene />}
      {!isMobile && <ProvinceSection />}
      <PaystubSection />
      <Automation />
      {!isMobile && <AutomationScene />}
      {!isMobile && <SuccessScene />}
      <Footer />
    </>
  );
}
