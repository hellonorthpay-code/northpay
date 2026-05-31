"use client";

/**
 * ProvinceSection — real Canadian map, Apple/Wealthsimple precision.
 *
 * Install commands (run once from /northpay):
 *   npm install d3-geo
 *   npm install -D @types/d3-geo
 *
 * GeoJSON source: click_that_hood/canada.geojson
 *   https://github.com/codeforgermany/click_that_hood/blob/main/public/data/canada.geojson
 *   Saved at /lib/data/canada-provinces.json. Imported at build time
 *   (resolveJsonModule is on in tsconfig) so no runtime fetch.
 *
 * Projection: d3.geoConicConformal — the same Lambert projection StatCan
 * uses for Canada — rotation [100, 0], standard parallels [49, 77],
 * fitSize-ed to the container. This is what makes the shape actually
 * read as Canada.
 *
 * Interaction model:
 *   • Hover (desktop) or tap (mobile) → that province becomes "active";
 *     all others dim to 40%. The info card on the right cross-fades to
 *     the province's details.
 *   • Default (no active) → card shows aggregate stats.
 *   • Pointer leaves the map (and no province has been tapped) → reverts
 *     to default.
 *
 * Reduced motion: still interactive, but transitions become instant.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  geoConicConformal,
  geoPath,
  type GeoPath,
  type GeoPermissibleObjects,
} from "d3-geo";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "framer-motion";
import canadaGeoData from "@/lib/data/canada-provinces.json";

// ─── Data ────────────────────────────────────────────────────────────────
const ORDER = [
  "BC",
  "AB",
  "SK",
  "MB",
  "ON",
  "QC",
  "NB",
  "NS",
  "PE",
  "NL",
] as const;
type ProvinceCode = (typeof ORDER)[number];

// Territories are rendered as muted "coming soon" shapes — not interactive.
const TERRITORIES = ["YT", "NT", "NU"] as const;
type TerritoryCode = (typeof TERRITORIES)[number];

type Code = ProvinceCode | TerritoryCode;

const PROVINCES: Record<
  ProvinceCode,
  { name: string; tax: string; ready: boolean; copy: string }
> = {
  BC: {
    name: "British Columbia",
    tax: "5.06% – 20.5%",
    ready: true,
    copy: "Seven brackets, top-rate phase-out applied correctly.",
  },
  AB: {
    name: "Alberta",
    tax: "10% – 15%",
    ready: true,
    copy: "Flat-leaning structure, five brackets after the 2026 reform.",
  },
  SK: {
    name: "Saskatchewan",
    tax: "10.5% – 14.5%",
    ready: true,
    copy: "Three brackets, indexed to provincial CPI each year.",
  },
  MB: {
    name: "Manitoba",
    tax: "10.8% – 17.4%",
    ready: true,
    copy: "Three-bracket schedule with provincial BPA stacked.",
  },
  ON: {
    name: "Ontario",
    tax: "5.05% – 13.16%",
    ready: true,
    copy: "Surtax tiers and the Ontario Health Premium handled automatically.",
  },
  QC: {
    name: "Quebec",
    tax: "Coming soon",
    ready: false,
    copy: "Revenu Québec runs its own system. We're building it carefully — outside Quebec for now.",
  },
  NB: {
    name: "New Brunswick",
    tax: "9.4% – 19.5%",
    ready: true,
    copy: "Five brackets, updated to the 2026 schedule.",
  },
  NS: {
    name: "Nova Scotia",
    tax: "8.79% – 21%",
    ready: true,
    copy: "Five brackets, no indexation — values locked from the budget.",
  },
  PE: {
    name: "Prince Edward Island",
    tax: "9.65% – 18.75%",
    ready: true,
    copy: "Five brackets and a 10% surtax over the upper threshold.",
  },
  NL: {
    name: "Newfoundland & Labrador",
    tax: "8.7% – 21.8%",
    ready: true,
    copy: "Eight brackets — the most granular in the country, fully covered.",
  },
};

// Match GeoJSON `properties.name` → our province / territory code.
const NAME_TO_CODE: Record<string, Code> = {
  "British Columbia": "BC",
  Alberta: "AB",
  Saskatchewan: "SK",
  Manitoba: "MB",
  Ontario: "ON",
  Quebec: "QC",
  Québec: "QC",
  "New Brunswick": "NB",
  "Nova Scotia": "NS",
  "Prince Edward Island": "PE",
  "Newfoundland and Labrador": "NL",
  "Yukon Territory": "YT",
  Yukon: "YT",
  "Northwest Territories": "NT",
  Nunavut: "NU",
};

const ACCENT_DARK = "#F5F5F0"; // soft warm white — active province in dark mode
const ACCENT_LIGHT = "#1A1A1A"; // deep charcoal — active province in light mode
const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Scroll-driven draw order ────────────────────────────────────────────
// As the user scrolls through the section, each province's stroke draws in
// (pathLength 0 → 1) and its fill fades up. Territories first, then
// provinces sweep west → east — feels like the country writing itself.
const DRAW_ORDER: Code[] = [
  "YT",
  "NT",
  "NU",
  "BC",
  "AB",
  "SK",
  "MB",
  "ON",
  "QC",
  "NB",
  "NS",
  "PE",
  "NL",
];

// Section is pinned for the whole draw. Progress 0 = pin just engaged, 1 =
// pin about to release. Drawing finishes at ~0.70, leaving ~30% of the
// pinned runway for the viewer to appreciate the fully-rendered map before
// the page resumes scrolling.
const DRAW_START = 0.08;
const DRAW_STAGGER = 0.045;
const DRAW_DURATION = 0.12;

function getDrawRange(code: Code): [number, number] {
  const i = DRAW_ORDER.indexOf(code);
  const safeIndex = i < 0 ? 0 : i;
  const start = DRAW_START + safeIndex * DRAW_STAGGER;
  return [start, start + DRAW_DURATION];
}

// Tracks whether the `dark` class is present on <html>, with a
// MutationObserver so it updates live as the theme toggles.
function useIsDark() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

// ─── Public component ────────────────────────────────────────────────────
export function ProvinceSection() {
  // Lifted to the section so the headline / hover-overlay / map can all
  // read the same active province.
  const [activeCode, setActiveCode] = useState<ProvinceCode | null>(null);

  // Drives the map's progressive draw-in while the section is PINNED.
  // The outer <section> is `h-[320vh]`; the inner content sticks to `top: 0`
  // for `320vh - 100vh = 220vh` of scroll. Progress 0 = pin just engaged
  // (section.top reaches 0). Progress 1 = pin about to release
  // (section.bottom reaches viewport bottom). Drawing finishes well before
  // 1, so the user sees the completed map before the page resumes scrolling.
  //
  // Manual scroll listener (rather than framer's useScroll({target})) because
  // the latter returned a frozen 0 in our setup — likely the `overflow-x-clip`
  // on <main> interferes with its measurement.
  const sectionRef = useRef<HTMLElement>(null);
  const scrollYProgress = useMotionValue(0);
  useEffect(() => {
    const update = () => {
      const node = sectionRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight;
      const scrolled = -rect.top;
      const total = rect.height - vh;
      const p = total > 0 ? scrolled / total : 0;
      scrollYProgress.set(Math.min(1, Math.max(0, p)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [scrollYProgress]);

  return (
    <section
      ref={sectionRef}
      id="provinces"
      className="relative bg-background text-foreground dark:bg-[#0A0A0A] dark:text-white"
      style={{ height: "320vh" }}
    >
      {/* Sticky inner pins the content for the full draw, then releases. */}
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-6 py-12">
        <div className="mx-auto w-full max-w-6xl">
          <Header />
          <HoverTaxDisplay activeCode={activeCode} />
          <div className="mx-auto -mt-[6vh] w-full max-w-4xl">
            <MapPanel
              activeCode={activeCode}
              onHover={setActiveCode}
              scrollYProgress={scrollYProgress}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Big tax-range overlay between the headline and the map ──────────────
// Reserves a fixed slot of vertical space so the map never jitters when the
// text appears or disappears. The text rides in at 50% opacity per spec.
function HoverTaxDisplay({
  activeCode,
}: {
  activeCode: ProvinceCode | null;
}) {
  return (
    <div className="mt-[10vh] flex h-[clamp(48px,7vw,96px)] items-center justify-center px-6">
      <AnimatePresence mode="wait">
        {activeCode && (
          <motion.p
            key={activeCode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 0.5, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="text-balance text-center text-[clamp(2.5rem,7vw,6rem)] font-semibold leading-none tracking-tightest text-foreground dark:text-white"
            style={{
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.025em",
            }}
          >
            {PROVINCES[activeCode].tax}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function Header() {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-foreground/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.32em] text-muted-foreground dark:border-white/12 dark:bg-white/[0.03] dark:text-white/55">
        Province aware
      </span>
      <h2
        className="mt-6 text-balance text-[clamp(2.5rem,5.6vw,4.5rem)] font-semibold text-foreground dark:text-white"
        style={{ lineHeight: 1.05, letterSpacing: "-0.02em" }}
      >
        Every province, calculated correctly.
      </h2>
    </div>
  );
}

// ─── Map (d3-geo Conic Conformal) ────────────────────────────────────────
function MapPanel({
  activeCode,
  onHover,
  scrollYProgress,
}: {
  activeCode: ProvinceCode | null;
  onHover: (code: ProvinceCode | null) => void;
  scrollYProgress: MotionValue<number>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 500 });

  // Track container size for fitSize. ResizeObserver keeps the projection
  // accurate when the layout column reflows (e.g. mobile breakpoint).
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => {
      const r = node.getBoundingClientRect();
      // Match the container's 1.9:1 aspect ratio so the Lambert projection
      // fills the SVG height instead of centering Canada with empty bands.
      const w = r.width;
      const h = Math.min(r.height, w * 0.53);
      setSize({ width: w, height: h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const { features, pathGen } = useMemo(() => {
    // Lambert Conformal Conic — StatCan's projection of choice for Canada.
    const projection = geoConicConformal()
      .rotate([100, 0])
      .parallels([49, 77])
      .fitSize(
        [size.width, size.height],
        canadaGeoData as unknown as GeoPermissibleObjects,
      );
    const pg = geoPath(projection);

    type Feature = (typeof canadaGeoData.features)[number];
    const decorated = (canadaGeoData.features as Feature[])
      .map((f) => {
        const code = NAME_TO_CODE[f.properties.name as string];
        if (!code) return null;
        return {
          code,
          feature: f as unknown as GeoPermissibleObjects,
        };
      })
      .filter((x): x is { code: Code; feature: GeoPermissibleObjects } => !!x);

    return { features: decorated, pathGen: pg };
  }, [size]);

  const hasActive = activeCode !== null;

  return (
    <div
      ref={ref}
      className="relative w-full"
      style={{ aspectRatio: "1.9 / 1", maxHeight: "60vh" }}
      onPointerLeave={() => onHover(null)}
    >
      <svg
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="h-full w-full"
        role="img"
        aria-label="Map of Canadian provinces"
      >
        {/* Render territories first (z-bottom) so provinces always sit above. */}
        {features
          .filter((f) => (TERRITORIES as readonly string[]).includes(f.code))
          .map(({ code, feature }) => (
            <TerritoryPath
              key={code}
              code={code as TerritoryCode}
              d={pathGen(feature) ?? ""}
              dimmed={hasActive}
              scrollYProgress={scrollYProgress}
            />
          ))}
        {features
          .filter((f) => (ORDER as readonly string[]).includes(f.code))
          .map(({ code, feature }) => {
            const provinceCode = code as ProvinceCode;
            const isActive = activeCode === provinceCode;
            const d = pathGen(feature) ?? "";
            const [cx, cy] = pathGen.centroid(feature);
            return (
              <ProvincePath
                key={code}
                code={provinceCode}
                d={d}
                cx={cx}
                cy={cy}
                isActive={isActive}
                anyActive={hasActive}
                onHover={onHover}
                width={size.width}
                scrollYProgress={scrollYProgress}
              />
            );
          })}
      </svg>
    </div>
  );
}

// ─── Individual province <path/> + centroid label ────────────────────────
function ProvincePath({
  code,
  d,
  cx,
  cy,
  isActive,
  anyActive,
  onHover,
  width,
  scrollYProgress,
}: {
  code: ProvinceCode;
  d: string;
  cx: number;
  cy: number;
  isActive: boolean;
  anyActive: boolean;
  onHover: (code: ProvinceCode | null) => void;
  width: number;
  scrollYProgress: MotionValue<number>;
}) {
  const isDark = useIsDark();
  const accent = isDark ? ACCENT_DARK : ACCENT_LIGHT;
  // Light/dark mode-aware swatches for inactive vs active provinces.
  const inactiveFill = isDark ? "#161616" : "#F0F0F0";
  const inactiveStroke = isDark ? "#2A2A2A" : "#D5D5D5";
  const activeFill = isDark
    ? "rgba(245, 245, 240, 0.08)"
    : "rgba(26, 26, 26, 0.08)";
  const activeStroke = isDark
    ? "rgba(245, 245, 240, 0.40)"
    : "rgba(26, 26, 26, 0.45)";

  // ─── Scroll-driven draw values ────────────────────────────────────────
  // pathLength: stroke draws from 0 → 1 across this province's scroll slice.
  // fillOpacity: fill lags the stroke by ~40% of the draw window, so the
  // outline lands first and the interior settles in just after.
  // labelDrawOpacity: label fades in over the last 25% of the draw — only
  // appears once "its" province is fully drawn.
  const [start, end] = getDrawRange(code);
  const span = end - start;
  const pathLength = useTransform(scrollYProgress, [start, end], [0, 1]);
  const fillOpacity = useTransform(
    scrollYProgress,
    [start + span * 0.4, end + span * 0.15],
    [0, 1],
  );
  const labelDrawOpacity = useTransform(
    scrollYProgress,
    [end - span * 0.25, end + span * 0.1],
    [0, 1],
  );

  // Tiny provinces (PE, NS, NB) hide their label below ~640px container.
  const tinyOnSmall =
    width < 640 && (code === "PE" || code === "NS" || code === "NB");
  const showLabel = !tinyOnSmall || isActive;

  // Group opacity drops when another province is active.
  const groupOpacity = anyActive ? (isActive ? 1 : 0.4) : 1;

  return (
    <motion.g
      animate={{ opacity: groupOpacity }}
      transition={{ duration: 0.2, ease: EASE }}
      onPointerEnter={() => onHover(code)}
    >
      <motion.path
        d={d}
        initial={false}
        style={{ pathLength, fillOpacity }}
        animate={{
          fill: isActive ? activeFill : inactiveFill,
          stroke: isActive ? activeStroke : inactiveStroke,
          strokeWidth: isActive ? 1 : 0.5,
        }}
        transition={{ duration: 0.2, ease: EASE }}
        strokeLinejoin="round"
      />
      {showLabel && Number.isFinite(cx) && Number.isFinite(cy) && (
        <motion.g style={{ opacity: labelDrawOpacity }}>
          <motion.text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            initial={false}
            animate={{
              fill: isActive ? accent : isDark ? "#8A8A8A" : "#6A6A6A",
              opacity: anyActive ? (isActive ? 1 : 0.55) : 1,
            }}
            transition={{ duration: 0.2, ease: EASE }}
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.05em",
              fontFamily: "inherit",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            {code}
          </motion.text>
        </motion.g>
      )}
    </motion.g>
  );
}

// ─── Territory (muted, non-interactive) ──────────────────────────────────
function TerritoryPath({
  code,
  d,
  dimmed,
  scrollYProgress,
}: {
  code: TerritoryCode;
  d: string;
  dimmed: boolean;
  scrollYProgress: MotionValue<number>;
}) {
  const isDark = useIsDark();
  const [start, end] = getDrawRange(code);
  const span = end - start;
  const pathLength = useTransform(scrollYProgress, [start, end], [0, 1]);
  const fillOpacity = useTransform(
    scrollYProgress,
    [start + span * 0.4, end + span * 0.15],
    [0, 1],
  );
  return (
    <motion.path
      d={d}
      initial={false}
      style={{ pathLength, fillOpacity }}
      animate={{ opacity: dimmed ? 0.18 : 0.35 }}
      transition={{ duration: 0.2, ease: EASE }}
      fill={isDark ? "#101010" : "#F5F5F5"}
      stroke={isDark ? "#1A1A1A" : "#E0E0E0"}
      strokeWidth={0.5}
      strokeLinejoin="round"
      pointerEvents="none"
    />
  );
}

// (InfoCard + Stat removed — section now shows the map alone, centered.)
