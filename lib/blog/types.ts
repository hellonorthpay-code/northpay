export type BlogStatus = "draft" | "published";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  status: BlogStatus;
  publishedAt: string | null;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

/** What the admin editor sends. `id` absent means "create". */
export interface BlogPostDraft {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  status: BlogStatus;
  authorName?: string;
}

/**
 * Turn a title into a URL slug.
 *
 * A slug is a permanent address: once Google has indexed /blog/cpp-rates-2026
 * changing it costs the ranking that post earned. The editor seeds it from
 * the title and then leaves it alone.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Roughly how long the post takes to read, for the dateline. */
export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
