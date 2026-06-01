/**
 * Root-segment Suspense fallback used by the Next App Router whenever
 * a route's data is still streaming. Pages here are mostly static so this
 * almost never paints, but when it does the user gets the same NorthPay
 * mark + a gentle ring pulse instead of a flash of blank background.
 */
export default function RootLoading() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="relative">
        <span
          aria-hidden
          className="absolute inset-0 -m-3 rounded-full bg-foreground/10 motion-safe:animate-ping dark:bg-white/15"
        />
        <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-foreground text-background shadow-soft dark:bg-white dark:text-black">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M3 13V3l10 10V3"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </div>
  );
}
