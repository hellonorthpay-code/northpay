-- ─────────────────────────────────────────────────────────────────────────
-- Add the employee's chosen first pay period (bi-weekly cycle start).
-- Recorded when adding an employee; in a payroll run whose period ends before
-- this date, the employee is shown but not auto-selected.
--
-- Run this once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.employees
  add column if not exists pay_start_date date;
