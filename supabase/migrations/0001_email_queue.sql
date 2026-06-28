-- ─────────────────────────────────────────────────────────────────────────
-- Email send-queue for paystub delivery.
--
-- Rows are inserted by the enqueue API (service role, owner_id = the employer
-- who ran payroll) and drained by the cron API, which sends via Brevo at a
-- rate that stays under the free 300/day cap. The "within 24 hours" promise
-- in the UI is backed by this queue.
--
-- Run this once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.email_queue (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  to_email      text not null,
  to_name       text,
  reply_to      text,
  subject       text not null,
  html          text not null,
  pdf_base64    text,          -- attachment; cleared once sent to reclaim space
  pdf_filename  text,
  status        text not null default 'pending',  -- pending | sent | failed
  attempts      int  not null default 0,
  last_error    text,
  scheduled_for timestamptz not null default now(),
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- The drainer selects pending rows that are due, oldest first.
create index if not exists email_queue_due_idx
  on public.email_queue (status, scheduled_for);

-- The daily-cap guard counts recently-sent rows.
create index if not exists email_queue_sent_idx
  on public.email_queue (status, sent_at);

-- RLS: the queue is only ever touched by the service-role key (enqueue +
-- drain APIs), never directly from the browser. Enable RLS with no public
-- policies so the anon/authenticated keys cannot read other people's rows.
alter table public.email_queue enable row level security;
