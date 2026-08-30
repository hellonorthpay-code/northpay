-- ─────────────────────────────────────────────────────────────────────────
-- Website traffic, collected first-party. No third-party analytics script.
--
-- Privacy by construction — this is a Canadian business under PIPEDA, and
-- payroll customers are exactly the audience who care:
--   • No cookies, no localStorage, no persistent identifier.
--   • Raw IP is NEVER stored. It is hashed together with the user agent, the
--     calendar date, and a server-side secret. The salt changes daily, so the
--     hash cannot be linked across days and cannot be reversed to an IP.
--   • Country/city come from Vercel's edge geo headers — coarse, and derived
--     from the same request that was already being served.
--
-- The daily-rotating hash is what makes "unique visitors" possible without
-- identifying anyone.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.page_views (
  id             bigserial primary key,
  created_at     timestamptz not null default now(),
  path           text not null,
  -- Host only ("google.com"), never the full referring URL, which can carry
  -- search terms and other personal detail.
  referrer_host  text,
  country        text,          -- ISO-3166-1 alpha-2
  city           text,
  device         text,          -- mobile | tablet | desktop
  browser        text,
  os             text,
  -- sha256(ip + ua + date + secret). Rotates daily. Not reversible.
  visitor_hash   text
);

create index if not exists page_views_created_idx
  on public.page_views (created_at desc);
create index if not exists page_views_country_idx
  on public.page_views (country);
create index if not exists page_views_visitor_idx
  on public.page_views (visitor_hash);

-- Writes come from the service-role beacon route; reads from the admin API.
-- No browser client ever touches this table directly.
alter table public.page_views enable row level security;
