-- Vendor Reviews Phase 1 setup for Preferred Vendors

create extension if not exists pgcrypto;

create table if not exists public.vendor_reviews (
  id uuid primary key default gen_random_uuid(),
  vendor_key text not null,
  vendor_name text not null,
  vendor_type text,
  company text not null,
  community_id uuid not null,
  reviewer_user_id uuid,
  reviewer_name text,
  rating integer not null check (rating between 1 and 5),
  note text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendor_reviews_company_community_idx
  on public.vendor_reviews(company, community_id, vendor_key, created_at desc);

create or replace function public.set_vendor_reviews_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_vendor_reviews_updated_at on public.vendor_reviews;
create trigger trg_vendor_reviews_updated_at
before update on public.vendor_reviews
for each row execute function public.set_vendor_reviews_updated_at();

alter table public.vendor_reviews enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='vendor_reviews' and policyname='vendor_reviews_select_authenticated'
  ) then
    create policy vendor_reviews_select_authenticated
      on public.vendor_reviews
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='vendor_reviews' and policyname='vendor_reviews_insert_authenticated'
  ) then
    create policy vendor_reviews_insert_authenticated
      on public.vendor_reviews
      for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='vendor_reviews' and policyname='vendor_reviews_update_authenticated'
  ) then
    create policy vendor_reviews_update_authenticated
      on public.vendor_reviews
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;
