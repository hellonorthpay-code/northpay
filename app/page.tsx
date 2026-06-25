import { Hero } from "@/components/landing/hero";
import { HomeBelowFold } from "@/components/landing/home-below-fold";

export default function HomePage() {
  return (
    // `overflow-x-clip` clips any stray horizontal overflow WITHOUT promoting
    // <main> to a sticky scroll container (the way `overflow-x-hidden` does).
    // The ProvinceSection + cinematic sections all rely on `position: sticky`
    // against the document, so this is the right value.
    //
    // Only the Hero renders eagerly; everything below it is lazy-loaded
    // (HomeBelowFold) so the page — and the fixed bottom nav — become
    // interactive immediately on mobile instead of waiting for the heavy
    // cinematic sections to hydrate.
    <main className="relative min-h-screen overflow-x-clip">
      <Hero />
      <HomeBelowFold />
    </main>
  );
}
