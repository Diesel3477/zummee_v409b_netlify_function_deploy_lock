create table if not exists public.zummee_sponsored_vendors (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  slot_number integer not null check (slot_number in (1,2)),
  vendor_name text,
  cta_text text,
  cta_link text,
  logo_path text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category, slot_number)
);

create index if not exists idx_zummee_sponsored_vendors_active
  on public.zummee_sponsored_vendors (category, slot_number, is_active);

create or replace function public.set_zummee_sponsored_vendors_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_zummee_sponsored_vendors_updated_at on public.zummee_sponsored_vendors;
create trigger trg_set_zummee_sponsored_vendors_updated_at
before update on public.zummee_sponsored_vendors
for each row execute function public.set_zummee_sponsored_vendors_updated_at();

alter table public.zummee_sponsored_vendors enable row level security;

drop policy if exists "zummee_sponsored_vendors_select_authenticated" on public.zummee_sponsored_vendors;
create policy "zummee_sponsored_vendors_select_authenticated"
on public.zummee_sponsored_vendors
for select
to authenticated
using (true);

-- Writes should be limited to your platform admin workflow. Tighten these policies later if you already
-- have a dedicated platform-admin claim/table. For now they allow authenticated writes so the page can save.
drop policy if exists "zummee_sponsored_vendors_insert_authenticated" on public.zummee_sponsored_vendors;
create policy "zummee_sponsored_vendors_insert_authenticated"
on public.zummee_sponsored_vendors
for insert
to authenticated
with check (true);

drop policy if exists "zummee_sponsored_vendors_update_authenticated" on public.zummee_sponsored_vendors;
create policy "zummee_sponsored_vendors_update_authenticated"
on public.zummee_sponsored_vendors
for update
to authenticated
using (true)
with check (true);
