import Link from "next/link";

/**
 * The site's 404.
 *
 * There wasn't one, so every missing URL fell back to Next's unstyled
 * built-in — and, more importantly, a `notFound()` call with no boundary to
 * render into was answering HTTP 200. A 200 on a missing page is a soft 404:
 * search engines treat it as a quality signal and will sometimes index the
 * empty page. Having this boundary is what makes the status honest.
 */
export const metadata = {
  title: "Page not found — NorthPay",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-x-clip px-5 py-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-rose-200/30 via-sky-200/20 to-emerald-200/30 blur-3xl dark:from-rose-500/10 dark:via-sky-500/10 dark:to-emerald-500/10" />
      </div>

      <div className="w-full max-w-md text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-tightest sm:text-[40px]">
          That page isn&rsquo;t here.
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-[14.5px] leading-relaxed text-muted-foreground">
          It may have moved, or the address may have a typo in it.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-foreground px-6 text-[14px] font-semibold text-background transition-opacity hover:opacity-90 sm:w-auto"
          >
            Back to NorthPay
          </Link>
          <Link
            href="/blog"
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-border px-6 text-[14px] font-medium transition-colors hover:bg-muted sm:w-auto"
          >
            Payroll notes
          </Link>
        </div>
      </div>
    </main>
  );
}
