"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
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
  fetchBlogPostAnalytics,
  fetchBlogPosts,
  saveBlogPost,
  type BlogPost,
} from "@/lib/admin/client";
import { renderMarkdown } from "@/lib/blog/markdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BlogPostAnalytics, TrafficBreakdown } from "@/lib/admin/types";
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
  // Which post's readership popup is open (null = closed).
  const [statsFor, setStatsFor] = useState<BlogPost | null>(null);

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
              <button
                type="button"
                onClick={() => setStatsFor(p)}
                aria-label={`Analytics for ${p.title}`}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 text-[12px] font-medium text-foreground transition-all duration-200 hover:bg-muted active:scale-95"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Analytics</span>
              </button>
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

      <Dialog open={!!statsFor} onOpenChange={(o) => !o && setStatsFor(null)}>
        <DialogContent className="max-h-[88vh] w-[calc(100vw-2rem)] max-w-lg gap-0 overflow-y-auto p-5 sm:p-7">
          {statsFor && <PostAnalytics post={statsFor} />}
        </DialogContent>
      </Dialog>
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

// ─────────────────────────────────────────────────────────────────────────
// Per-post readership popup. Numbers come from the first-party page_views
// table (the same beacon behind the Analytics tab), so they agree with it.
// ─────────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function PostAnalytics({ post }: { post: BlogPost }) {
  const [data, setData] = useState<BlogPostAnalytics | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr(null);
    fetchBlogPostAnalytics(post.slug)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : "Couldn't load analytics."));
    return () => {
      alive = false;
    };
  }, [post.slug]);

  const peak = data ? Math.max(1, ...data.daily.map((d) => d.views)) : 1;
  const live = post.status === "published";

  return (
    <div>
      {/* Header */}
      <div className="pr-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Post analytics
        </p>
        <DialogTitle className="mt-1.5 text-[19px] leading-snug">{post.title}</DialogTitle>
        <DialogDescription className="mt-1 truncate text-[12px]">
          /blog/{post.slug}
          {post.publishedAt ? ` · published ${formatDate(post.publishedAt.slice(0, 10))}` : " · draft"}
        </DialogDescription>
      </div>

      {err ? (
        <p className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12.5px] font-medium text-destructive">
          {err}
        </p>
      ) : !data ? (
        <div className="mt-6 space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[74px] animate-pulse rounded-2xl bg-muted/60" />
            ))}
          </div>
          <div className="h-28 animate-pulse rounded-2xl bg-muted/60" />
          <div className="h-36 animate-pulse rounded-2xl bg-muted/60" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease }}
        >
          {/* Headline numbers */}
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <StatTile label="Total views" value={data.views} />
            <StatTile label="Readers" value={data.readers} hint="unique per day" />
            <StatTile label="Last 7 days" value={data.views7d} />
            <StatTile label="Last 30 days" value={data.views30d} />
          </div>

          {data.views === 0 ? (
            <div className="mt-5 rounded-2xl border border-border/60 bg-muted/20 px-4 py-8 text-center">
              <Eye className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-[13.5px] font-medium tracking-tight">No views yet</p>
              <p className="mx-auto mt-1 max-w-xs text-[12px] text-muted-foreground">
                {live
                  ? "Readers will show up here as soon as the post gets its first visit."
                  : "Publish the post and its readership will start appearing here."}
              </p>
            </div>
          ) : (
            <>
              {/* 30-day trend */}
              <div className="mt-5 rounded-2xl border border-border/60 bg-background/60 p-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-[12px] font-medium tracking-tight">Views, last 30 days</p>
                  {data.lastViewAt && (
                    <p className="text-[11px] text-muted-foreground">
                      Last read {timeAgo(data.lastViewAt)}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex h-24 items-end gap-[3px]">
                  {data.daily.map((d, i) => (
                    <div
                      key={d.date}
                      className="group relative flex h-full flex-1 items-end"
                      title={`${formatDate(d.date)} · ${d.views} view${d.views === 1 ? "" : "s"}`}
                    >
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(d.views ? 6 : 2, (d.views / peak) * 100)}%` }}
                        transition={{ duration: 0.5, ease, delay: 0.1 + i * 0.012 }}
                        className={cn(
                          "w-full rounded-t-[3px] transition-colors",
                          d.views ? "bg-foreground/80 group-hover:bg-foreground" : "bg-muted"
                        )}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                  <span>{formatDate(data.daily[0].date)}</span>
                  <span>Today</span>
                </div>
              </div>

              {/* Breakdowns */}
              <div className="mt-3 space-y-3">
                <Breakdown title="Where readers came from" rows={data.referrers} />
                <Breakdown title="Countries" rows={data.countries} />
                <Breakdown title="Devices" rows={data.devices} />
              </div>
            </>
          )}

          <p className="mt-5 text-[10.5px] leading-relaxed text-muted-foreground">
            Cookieless, first-party counts. Bots and Do-Not-Track visits are excluded, and the
            visitor id rotates daily — so someone reading on two days counts as two readers.
          </p>
        </motion.div>
      )}
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
      <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[22px] font-semibold leading-none tracking-tight tabular-nums">
        {value.toLocaleString("en-CA")}
      </p>
      {hint && <p className="mt-1 text-[10.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: TrafficBreakdown[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
      <p className="text-[12px] font-medium tracking-tight">{title}</p>
      <ul className="mt-2.5 space-y-2">
        {rows.map((r, i) => (
          <li key={r.label} className="text-[12.5px]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate">{r.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {r.value.toLocaleString("en-CA")} · {r.share}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${r.share}%` }}
                transition={{ duration: 0.6, ease, delay: 0.15 + i * 0.05 }}
                className="h-full rounded-full bg-foreground/70"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
