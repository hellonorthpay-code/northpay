"use client";

import dynamic from "next/dynamic";

/**
 * Everything below the hero, loaded lazily (client-only, ssr:false) so it does
 * NOT block the homepage's initial hydration. The hero + the fixed nav become
 * interactive immediately; these heavy cinematic / scroll-linked sections mount
 * just after. Previously they were part of the initial hydration tree, which on
 * mobile kept the main thread busy long enough that taps on the bottom-nav
 * (e.g. Profile) were dropped until hydration finally caught up.
 */
const opts = { ssr: false } as const;

const About = dynamic(() => import("./about").then((m) => m.About), opts);
const EmployeesScene = dynamic(
  () => import("./cinematic-sections").then((m) => m.EmployeesScene),
  opts
);
const ProvinceSection = dynamic(
  () => import("./province").then((m) => m.ProvinceSection),
  opts
);
const PaystubSection = dynamic(
  () => import("./paystub").then((m) => m.PaystubSection),
  opts
);
const Automation = dynamic(
  () => import("./automation").then((m) => m.Automation),
  opts
);
const AutomationScene = dynamic(
  () => import("./cinematic-sections").then((m) => m.AutomationScene),
  opts
);
const SuccessScene = dynamic(
  () => import("./cinematic-sections").then((m) => m.SuccessScene),
  opts
);
const Footer = dynamic(() => import("./footer").then((m) => m.Footer), opts);

export function HomeBelowFold() {
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
