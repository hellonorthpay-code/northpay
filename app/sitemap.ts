import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/**
 * Every public page, for search engines.
 *
 * Only pages a signed-out visitor can actually load belong here — listing a
 * page that redirects to /login tells Google the sitemap is unreliable.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/about"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
