-- Optional vendor dispatch tracking columns for MCC automatic vendor dispatch
-- Safe to run multiple times.

alter table public.resident_work_orders
  add column if not exists vendor_dispatched_at timestamptz;

alter table public.resident_work_orders
  add column if not exists vendor_dispatch_status text;

alter table public.resident_work_orders
  add column if not exists vendor_dispatch_error text;
