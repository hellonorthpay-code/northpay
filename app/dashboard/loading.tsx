/**
 * Dashboard-segment Suspense fallback. Shows instantly when a dashboard route
 * (e.g. the login/profile page) is still downloading on a cold first visit, so
 * the user gets immediate feedback instead of a frozen screen. When the route
 * is already prefetched, navigation is instant and this never paints.
 */
export default function DashboardLoading() {
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
