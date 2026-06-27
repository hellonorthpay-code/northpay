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
  // All sections render on mobile now — but they only MOUNT once the user
  // scrolls. While you're at the top (where the Log in button lives), nothing
  // heavy is mounted, so the main thread is free and Log in stays instant. The
  // moment you scroll down to look at the content, the sections come in.
  //
  // Desktop additionally mounts after a brief idle even without scrolling, so
  // the full experience is ready immediately on larger screens.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      setReady(true);
      window.removeEventListener("scroll", go);
      if (timer) window.clearTimeout(timer);
    };
    window.addEventListener("scroll", go, { passive: true });
    const timer = isMobile ? undefined : window.setTimeout(go, 1200);
    return () => {
      window.removeEventListener("scroll", go);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!ready) return null;

  return (
    <>
      <About />
      <EmployeesScene />
      <ProvinceSection />
      <PaystubSection />
      <Automation />
      <AutomationScene />
      <SuccessScene />
      <Footer />
    </>
  );
}
