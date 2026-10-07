-- Blog posts, written in the admin panel and served on the public site.
--
-- Reads and writes both go through server routes that hold the service key
-- (/api/admin/blog for writing, server components for reading), so no
-- browser ever talks to this table directly. RLS is therefore enabled with
-- NO policy: the service role bypasses RLS, and the anon key — the one
-- shipped to every visitor's browser — gets nothing. A draft is not public
-- until a server route decides it is.
--
-- Safe to run more than once.

create table if not exists public.blog_posts (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  excerpt     text not null default '',
  body        text not null default '',
  -- 'draft' | 'published'. Only 'published' is ever served publicly.
  status      text not null default 'draft',
  -- Set the first time a post is published and kept thereafter, so editing
  -- a live post doesn't reorder the index or change its dateline.
  published_at timestamptz,
  author_name text not null default 'NorthPay',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.blog_posts enable row level security;

-- The public index reads published posts newest-first; the admin list reads
-- everything by last touched.
create index if not exists blog_posts_published_idx
  on public.blog_posts (published_at desc)
  where status = 'published';

create index if not exists blog_posts_updated_idx
  on public.blog_posts (updated_at desc);
