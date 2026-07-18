-- ─────────────────────────────────────────────────────────────────────────
-- Stripe subscription state, one row per employer (auth user).
--
-- The webhook (service role) upserts this on checkout / renewal / cancel.
-- The free trial is time-based off auth.users.created_at and needs no row —
-- a row only appears once the employer has interacted with Stripe.
--
-- Run this once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.subscriptions (
  owner_id            uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id  text,
  stripe_subscription_id text,
  status              text,          -- Stripe status: active | trialing | past_due | canceled | ...
  current_period_end  timestamptz,
  updated_at          timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx
  on public.subscriptions (stripe_customer_id);

-- Only the service role (webhook + billing APIs) touches this table.
alter table public.subscriptions enable row level security;
