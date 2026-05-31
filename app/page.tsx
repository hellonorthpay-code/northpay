import { Hero } from "@/components/landing/hero";
import { About } from "@/components/landing/about";
import { Automation } from "@/components/landing/automation";
import { ProvinceSection } from "@/components/landing/province";
import { PaystubSection } from "@/components/landing/paystub";
import {
  EmployeesScene,
  AutomationScene,
  SuccessScene,
} from "@/components/landing/cinematic-sections";
import { Footer } from "@/components/landing/footer";

export default function HomePage() {
  return (
    // `overflow-x-clip` clips any stray horizontal overflow WITHOUT promoting
    // <main> to a sticky scroll container (the way `overflow-x-hidden` does).
    // The new ProvinceSection + the cinematic sections all rely on
    // `position: sticky` against the document, so this is the right value.
    <main className="relative min-h-screen overflow-x-clip">
      <Hero />
      <About />
      {/* Cinematic "owner → employees → paystubs" flow, right after the
          About section's "Built for Canadian payroll, top to bottom." */}
      <EmployeesScene />
      {/* "Every province, calculated correctly." sits directly after the
          cinematic so the per-employee → per-province story flows. */}
      <ProvinceSection />
      <PaystubSection />
      <Automation />
      <AutomationScene />
      <SuccessScene />
      <Footer />
    </main>
  );
}
