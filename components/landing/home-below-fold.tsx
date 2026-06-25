"use client";

import dynamic from "next/dynamic";

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
