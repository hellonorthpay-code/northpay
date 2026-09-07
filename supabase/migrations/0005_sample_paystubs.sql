-- ─────────────────────────────────────────────────────────────────────────
-- "Try a sample paystub" — the landing-page lead funnel.
--
-- A visitor enters a name, business, province, rate and hours, and we email
-- them a real paystub computed by the production payroll engine. Two things
-- need to exist for that:
--
--   1. sample_requests — one row per request. Used for abuse control (the
--      endpoint is public and every request sends an email that counts
--      against the Brevo daily cap), and as a lead list for the founders.
--      The IP is stored only as a salted hash.
--
--   2. email_queue.owner_id becomes nullable. Sample emails have no signed-in
--      employer behind them; every other row keeps its owner exactly as now.
--
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.sample_requests (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  email          text not null,
  ip_hash        text,
  first_name     text,
  business_name  text,
  province       text,
  pay_frequency  text,
  hourly_rate    numeric,
  hours          numeric,
  net_pay        numeric
);

-- Rate-limit lookups: "how many from this address / this IP in the last day".
create index if not exists sample_requests_email_idx
  on public.sample_requests (email, created_at desc);
create index if not exists sample_requests_ip_idx
  on public.sample_requests (ip_hash, created_at desc);

-- Service role only. No browser client ever reads or writes this.
alter table public.sample_requests enable row level security;

alter table public.email_queue alter column owner_id drop not null;
