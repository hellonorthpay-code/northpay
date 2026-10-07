/**
 * The site's canonical origin.
 *
 * One place, because getting this wrong is silent: Next resolves every
 * relative canonical, Open Graph and Twitter URL against `metadataBase`, so a
 * placeholder there doesn't throw — it just quietly publishes links to a
 * domain that isn't yours, and search engines and link previews follow them.
 *
 * `www` is the canonical host: the apex 308-redirects to it, and a canonical
 * URL that redirects is a canonical URL that wastes crawl budget.
 */
export const SITE_URL = "https://www.thenorthpay.com";

export const SITE_NAME = "NorthPay";

/** Absolute URL for a path, for canonicals, sitemaps and JSON-LD. */
export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_URL).toString();
}
