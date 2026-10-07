import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { rowToPost } from "@/lib/blog/server";
import { slugify, type BlogPostDraft } from "@/lib/blog/types";
import { autoExcerpt } from "@/lib/blog/markdown";

// ─────────────────────────────────────────────────────────────────────────
// Blog authoring. Owner only — every method goes through requireAdmin, so
// the ADMIN_EMAILS allowlist is the whole access rule.
//
// GET    → every post, drafts included, most recently touched first.
// POST   → create or update one post.
// DELETE → remove one post by id.
// ─────────────────────────────────────────────────────────────────────────

const SELECT =
  "id, slug, title, excerpt, body, status, published_at, author_name, created_at, updated_at";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { data, error } = await gate.admin
    .from("blog_posts")
    .select(SELECT)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ posts: (data ?? []).map((r) => rowToPost(r as never)) });
}

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let draft: BlogPostDraft;
  try {
    draft = (await request.json()) as BlogPostDraft;
  } catch {
    return NextResponse.json({ error: "Bad request body." }, { status: 400 });
  }

  const title = (draft.title ?? "").trim();
  const body = (draft.body ?? "").trim();
  if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });

  const slug = slugify(draft.slug?.trim() || title);
  if (!slug) {
    return NextResponse.json(
      { error: "That title doesn't produce a usable web address — add some letters or numbers." },
      { status: 400 }
    );
  }

  const publishing = draft.status === "published";
  if (publishing && !body) {
    return NextResponse.json({ error: "A published post needs a body." }, { status: 400 });
  }

  // published_at is stamped on the FIRST publish and never moved: editing a
  // live post shouldn't reorder the index or rewrite its dateline.
  let publishedAt: string | null = null;
  if (draft.id) {
    const { data: existing } = await gate.admin
      .from("blog_posts")
      .select("published_at")
      .eq("id", draft.id)
      .maybeSingle();
    publishedAt = (existing as { published_at: string | null } | null)?.published_at ?? null;
  }
  if (publishing && !publishedAt) publishedAt = new Date().toISOString();

  const row = {
    slug,
    title,
    excerpt: (draft.excerpt ?? "").trim() || autoExcerpt(body),
    body,
    status: publishing ? "published" : "draft",
    published_at: publishedAt,
    author_name: (draft.authorName ?? "").trim() || "NorthPay",
    updated_at: new Date().toISOString(),
  };

  const query = draft.id
    ? gate.admin.from("blog_posts").update(row).eq("id", draft.id)
    : gate.admin.from("blog_posts").insert(row);

  const { data, error } = await query.select(SELECT).maybeSingle();
  if (error) {
    // 23505 is unique_violation — the only constraint on this table is the
    // slug, so the message can say exactly what to change.
    const conflict = error.code === "23505";
    return NextResponse.json(
      {
        error: conflict
          ? `Another post already uses the address /blog/${slug}. Give this one a different title or address.`
          : error.message,
      },
      { status: conflict ? 409 : 500 }
    );
  }
  return NextResponse.json({ post: rowToPost(data as never) });
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const { error } = await gate.admin.from("blog_posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
