import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/**
 * The site had no robots.txt at all, which meant no sitemap pointer either.
 *
 * Everything under /dashboard is behind auth — a crawler can't read it, but
 * it will happily spend crawl budget trying and then index the login
 * redirect. Naming them keeps the crawl on the pages that can actually rank.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/api/", "/auth/", "/login"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
