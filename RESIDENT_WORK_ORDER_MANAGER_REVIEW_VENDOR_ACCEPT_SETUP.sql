-- Zummee resident work order manager-review + vendor accept setup
-- Run once in Supabase SQL Editor.

alter table public.resident_work_orders
  add column if not exists resident_id uuid,
  add column if not exists vendor_id uuid,
  add column if not exists status text default 'manager_review',
  add column if not exists manager_approved_at timestamptz,
  add column if not exists manager_approved_by uuid,
  add column if not exists assigned_vendor_name text,
  add column if not exists assigned_vendor_email text,
  add column if not exists vendor_response_status text,
  add column if not exists vendor_accepted_at timestamptz;

-- New resident submissions should wait for manager review by default.
alter table public.resident_work_orders
  alter column status set default 'manager_review';

-- Helpful indexes for MCC and vendor acceptance lookups.
create index if not exists idx_resident_work_orders_status on public.resident_work_orders(status);
create index if not exists idx_resident_work_orders_resident_id on public.resident_work_orders(resident_id);
create index if not exists idx_resident_work_orders_resident_email on public.resident_work_orders(resident_email);
create index if not exists idx_resident_work_orders_community_status on public.resident_work_orders(community_id, status);
create index if not exists idx_resident_work_orders_vendor_email on public.resident_work_orders(assigned_vendor_email);

-- Optional linked maintenance table columns. These are used by the accept-vendor-job edge function when the table exists.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='maintenance_requests') then
    alter table public.maintenance_requests
      add column if not exists resident_work_order_id uuid,
      add column if not exists vendor_response_status text,
      add column if not exists vendor_accepted_at timestamptz;
  end if;
end $$;
