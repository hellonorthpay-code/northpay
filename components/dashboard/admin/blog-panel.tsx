"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteBlogPost,
  fetchBlogPosts,
  saveBlogPost,
  type BlogPost,
} from "@/lib/admin/client";
import { renderMarkdown } from "@/lib/blog/markdown";
import { readingMinutes, slugify } from "@/lib/blog/types";
import { cn, formatDate } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

/*
 * ─── Blog ────────────────────────────────────────────────────────────────
 *
 * Write a post, see it as it will read, publish it. Publishing writes
 * straight to the database, and the public pages revalidate on a short
 * interval — so a post goes live without a deploy.
 *
 * Two states, never both: a list, or the editor. A split view would mean a
 * cramped textarea on every screen size that matters.
 * ─────────────────────────────────────────────────────────────────────────
 */

interface Draft {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  published: boolean;
  /** Whether the slug has been typed by hand — once it has, stop guessing. */
  slugTouched: boolean;
}

const EMPTY: Draft = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  published: false,
  slugTouched: false,
};

export function BlogPanel() {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPosts(await fetchBlogPosts());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load posts.");
      setPosts([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (draft) {
    return (
      <Editor
        draft={draft}
        setDraft={setDraft}
        onDone={async () => {
          setDraft(null);
          await load();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold tracking-tight">Posts</p>
          <p className="text-[12.5px] text-muted-foreground">
            Published posts appear at{" "}
            <a
              href="/blog"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              /blog
            </a>{" "}
            and in the sitemap.
          </p>
        </div>
        <Button onClick={() => setDraft({ ...EMPTY })} className="shrink-0 rounded-full">
          <Plus className="h-4 w-4" />
          Write
        </Button>
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12.5px] font-medium text-destructive">
          {error}
        </p>
      )}

      {posts === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-3xl border border-border/60 bg-muted/20 px-4 py-12 text-center">
          <FileText className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-[13.5px] font-medium tracking-tight">No posts yet</p>
          <p className="mx-auto mt-1 max-w-xs text-[12px] text-muted-foreground">
            Search traffic compounds slowly. The sooner the first one is up, the sooner it
            starts.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-background/60">
          {posts.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3.5 py-3">
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    id: p.id,
                    title: p.title,
                    slug: p.slug,
                    excerpt: p.excerpt,
                    body: p.body,
                    published: p.status === "published",
                    slugTouched: true,
                  })
                }
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-[13.5px] font-medium tracking-tight">{p.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  /blog/{p.slug} · {readingMinutes(p.body)} min ·{" "}
                  {p.publishedAt ? formatDate(p.publishedAt.slice(0, 10)) : "not published"}
                </p>
              </button>
              <StatusChip published={p.status === "published"} />
              {p.status === "published" && (
                <a
                  href={`/blog/${p.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View post"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusChip({ published }: { published: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em]",
        published
          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
          : "bg-muted text-muted-foreground"
      )}
    >
      {published ? "Live" : "Draft"}
    </span>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Editor
// ═════════════════════════════════════════════════════════════════════════

function Editor({
  draft,
  setDraft,
  onDone,
}: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  onDone: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"save" | "publish" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft({ ...draft, [k]: v });

  // The slug follows the title until someone edits it directly. After a post
  // is live its address is load-bearing — Google indexed it — so an existing
  // post never re-slugs itself.
  const onTitle = (title: string) =>
    setDraft({
      ...draft,
      title,
      slug: draft.slugTouched ? draft.slug : slugify(title),
    });

  const html = useMemo(() => renderMarkdown(draft.body), [draft.body]);
  const slug = draft.slug || slugify(draft.title);

  async function save(publish: boolean) {
    setBusy(publish ? "publish" : "save");
    setError(null);
    try {
      await saveBlogPost({
        id: draft.id,
        title: draft.title,
        slug,
        excerpt: draft.excerpt,
        body: draft.body,
        status: publish ? "published" : "draft",
      });
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
      setBusy(null);
    }
  }

  async function remove() {
    if (!draft.id) return;
    setBusy("delete");
    setError(null);
    try {
      await deleteBlogPost(draft.id);
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setDraft(null)}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All posts
        </button>
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
            preview
              ? "border-foreground/20 bg-foreground text-background"
              : "border-border/70 text-muted-foreground hover:text-foreground"
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </button>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card/70 p-4 shadow-soft sm:p-6">
        <AnimatePresence mode="wait" initial={false}>
          {preview ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease }}
            >
              <h1 className="text-[28px] font-semibold leading-tight tracking-tightest">
                {draft.title || "Untitled"}
              </h1>
              <p className="mt-2 text-[11.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {readingMinutes(draft.body)} min read
              </p>
              <div className="np-prose mt-8" dangerouslySetInnerHTML={{ __html: html }} />
            </motion.div>
          ) : (
            <motion.div
              key="write"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="bp-title">Title</Label>
                <Input
                  id="bp-title"
                  value={draft.title}
                  onChange={(e) => onTitle(e.target.value.slice(0, 120))}
                  placeholder="CPP and EI rates for 2026, and what changed"
                />
                <p className="text-[11px] text-muted-foreground">
                  This is the headline Google shows. Write it as the question someone types.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bp-slug">Web address</Label>
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 text-[13px] text-muted-foreground">/blog/</span>
                  <Input
                    id="bp-slug"
                    value={draft.slug}
                    onChange={(e) =>
                      setDraft({ ...draft, slug: slugify(e.target.value), slugTouched: true })
                    }
                    placeholder="cpp-ei-rates-2026"
                  />
                </div>
                {draft.id && (
                  <p className="text-[11px] text-muted-foreground">
                    Changing this on a live post drops the ranking it has earned — the old
                    address becomes a dead link.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bp-excerpt">Summary</Label>
                <Input
                  id="bp-excerpt"
                  value={draft.excerpt}
                  onChange={(e) => set("excerpt", e.target.value.slice(0, 200))}
                  placeholder="Left blank, the opening lines are used."
                />
                <p className="text-[11px] text-muted-foreground">
                  The grey line under the headline in search results. Around 150 characters.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bp-body">Post</Label>
                <textarea
                  id="bp-body"
                  value={draft.body}
                  onChange={(e) => set("body", e.target.value)}
                  spellCheck
                  placeholder={"## A heading\n\nA paragraph. **Bold**, *italic*, [a link](https://canada.ca).\n\n- a point\n- another\n\n| Rate | 2026 |\n| --- | --- |\n| CPP | 5.95% |"}
                  className="min-h-[420px] w-full resize-y rounded-2xl border border-border bg-background px-3.5 py-3 font-mono text-[13px] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                />
                <p className="text-[11px] text-muted-foreground">
                  Markdown: <code className="rounded bg-muted px-1">##</code> headings,{" "}
                  <code className="rounded bg-muted px-1">-</code> lists,{" "}
                  <code className="rounded bg-muted px-1">**bold**</code>, links, and pipe
                  tables for rates.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12.5px] font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        {draft.id ? (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-full px-3 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-[12.5px] font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy === "delete" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete for good
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 self-start rounded-full px-3 py-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )
        ) : (
          <span />
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            disabled={busy !== null || !draft.title.trim()}
            onClick={() => save(false)}
            className="rounded-full"
          >
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save draft
          </Button>
          <Button
            disabled={busy !== null || !draft.title.trim() || !draft.body.trim()}
            onClick={() => save(true)}
            className="rounded-full"
          >
            {busy === "publish" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" strokeWidth={2.6} />
            )}
            {draft.published ? "Update live post" : "Publish"}
          </Button>
        </div>
      </div>
    </div>
  );
}
