import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { listPublishedPosts } from "@/lib/blog/server";

/**
 * Every public page, for search engines.
 *
 * Only pages a signed-out visitor can actually load belong here — listing a
 * page that redirects to /login tells Google the sitemap is unreliable.
 *
 * Blog posts are pulled live so publishing in the admin panel puts the post
 * in the sitemap without a deploy.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const posts = await listPublishedPosts(500);

  return [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/blog"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/about"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    ...posts.map((p) => ({
      url: absoluteUrl(`/blog/${p.slug}`),
      lastModified: new Date(p.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
