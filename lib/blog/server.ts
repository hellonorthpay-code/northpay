import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BlogPost } from "./types";

/**
 * Server-only reads for the public blog.
 *
 * NEVER import this into client code — it reads the Supabase secret key.
 *
 * blog_posts has RLS on and no policy, so the anon key shipped to browsers
 * can see nothing at all. The service role bypasses RLS, which means the
 * `status = 'published'` filter below is the ONLY thing standing between a
 * draft and the public internet. It belongs in every query here, and the
 * functions are written so a caller cannot forget it.
 */

interface Row {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  status: string;
  published_at: string | null;
  author_name: string;
  created_at: string;
  updated_at: string;
}

export function rowToPost(r: Row): BlogPost {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt ?? "",
    body: r.body ?? "",
    status: r.status === "published" ? "published" : "draft",
    publishedAt: r.published_at,
    authorName: r.author_name || "NorthPay",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function client(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const SELECT =
  "id, slug, title, excerpt, body, status, published_at, author_name, created_at, updated_at";

/**
 * Published posts, newest first. Returns [] when Supabase isn't configured
 * so the marketing site still builds and renders on a bare environment.
 */
export async function listPublishedPosts(limit = 50): Promise<BlogPost[]> {
  const db = client();
  if (!db) return [];
  const { data, error } = await db
    .from("blog_posts")
    .select(SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[blog] listPublishedPosts failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => rowToPost(r as Row));
}

/** One published post by slug, or null — a draft is a 404 to the public. */
export async function getPublishedPost(slug: string): Promise<BlogPost | null> {
  const db = client();
  if (!db) return null;
  const { data, error } = await db
    .from("blog_posts")
    .select(SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error || !data) return null;
  return rowToPost(data as Row);
}
