-- Named things visitors DO, as opposed to pages they land on.
--
-- Kept beside page_views rather than inside it: a page view and an action are
-- different units, and folding them into one table would mean every existing
-- traffic query had to learn to exclude the rows that aren't views. One
-- forgotten filter there quietly inflates every number on the dashboard.
--
-- Same privacy contract as page_views, for the same reason — this is a
-- payroll product under PIPEDA:
--   • No cookies, no persistent identifier.
--   • visitor_hash is the SAME daily-rotating, non-reversible hash the
--     traffic beacon uses, so "how many people" is answerable without
--     anyone being identifiable, and not across days.
--   • Nothing a visitor typed is recorded. That someone used the calculator
--     is a product metric; what they earn is their business.
--
-- Safe to run more than once.

create table if not exists public.site_events (
  id           bigserial primary key,
  created_at   timestamptz not null default now(),
  -- e.g. 'calculator_used'. A short, closed vocabulary set by the server.
  name         text not null,
  country      text,
  device       text,
  visitor_hash text
);

create index if not exists site_events_created_idx
  on public.site_events (created_at desc);
create index if not exists site_events_name_idx
  on public.site_events (name, created_at desc);

-- Writes come from the service-role beacon route; reads from the admin API.
-- No browser client ever touches this table directly.
alter table public.site_events enable row level security;
