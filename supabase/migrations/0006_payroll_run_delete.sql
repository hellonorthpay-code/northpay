-- Let an owner delete their own payroll run.
--
-- The Paystubs tab can now correct a mistake: the most recent paystub for an
-- employee can be edited (delete + re-finalize) or deleted outright. Without
-- a delete policy, row-level security turns that delete into a silent no-op —
-- PostgREST reports success, zero rows go, and the app would show the paystub
-- as gone while it is still folded into year-to-date and the CRA remittance.
--
-- Safe to run more than once.

alter table public.payroll_runs enable row level security;

drop policy if exists "payroll_runs owner delete" on public.payroll_runs;

create policy "payroll_runs owner delete"
  on public.payroll_runs
  for delete
  using (auth.uid() = owner_id);
