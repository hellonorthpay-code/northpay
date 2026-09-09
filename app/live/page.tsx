import type { Metadata } from "next";
import { LivePaystub } from "@/components/landing/live-paystub";

// A real page rather than a homepage anchor. The calculator lives inside the
// lazily-mounted HomeBelowFold, so "/#try-it" often pointed at an element
// that did not exist yet when the browser tried to scroll to it — the
// visitor landed at the top of the homepage instead. A dedicated route also
// gives it a shareable URL.

export const metadata: Metadata = {
  title: "Live paystub calculator — NorthPay",
  description:
    "Enter an hourly rate and hours and watch a Canadian paystub build itself, with 2026 CRA tables — federal and provincial tax, CPP, EI, vacation pay and overtime.",
};

export default function LivePage() {
  // pt-24 clears the fixed nav; the section brings its own bottom spacing.
  return (
    <main className="relative min-h-screen overflow-x-clip pt-24 md:pt-16">
      <LivePaystub />
    </main>
  );
}
