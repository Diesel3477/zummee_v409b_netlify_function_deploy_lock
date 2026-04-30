-- Phase 2A: Structured Non-Negotiables (templates + per-item completion)
create table if not exists public.daily_ops_template_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  template_type text not null check (template_type in ('nonneg','daily_checklist')),
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists daily_ops_template_items_company_idx
  on public.daily_ops_template_items(company_id);

alter table public.daily_ops_template_items enable row level security;

drop policy if exists "dos_template_items_read" on public.daily_ops_template_items;
create policy "dos_template_items_read"
on public.daily_ops_template_items
for select to authenticated
using (true);

drop policy if exists "dos_template_items_write" on public.daily_ops_template_items;
create policy "dos_template_items_write"
on public.daily_ops_template_items
for insert to authenticated
with check (true);

drop policy if exists "dos_template_items_update" on public.daily_ops_template_items;
create policy "dos_template_items_update"
on public.daily_ops_template_items
for update to authenticated
using (true) with check (true);

drop policy if exists "dos_template_items_delete" on public.daily_ops_template_items;
create policy "dos_template_items_delete"
on public.daily_ops_template_items
for delete to authenticated
using (true);


create table if not exists public.daily_ops_item_completion (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  community_id uuid null,
  user_id uuid not null,
  template_item_id uuid not null references public.daily_ops_template_items(id) on delete cascade,
  day date not null,
  completed_at timestamptz not null default now(),
  unique (user_id, template_item_id, day)
);

create index if not exists daily_ops_item_completion_lookup_idx
  on public.daily_ops_item_completion(company_id, user_id, day);

alter table public.daily_ops_item_completion enable row level security;

drop policy if exists "dos_item_completion_read" on public.daily_ops_item_completion;
create policy "dos_item_completion_read"
on public.daily_ops_item_completion
for select to authenticated
using (true);

drop policy if exists "dos_item_completion_insert" on public.daily_ops_item_completion;
create policy "dos_item_completion_insert"
on public.daily_ops_item_completion
for insert to authenticated
with check (true);

drop policy if exists "dos_item_completion_delete" on public.daily_ops_item_completion;
create policy "dos_item_completion_delete"
on public.daily_ops_item_completion
for delete to authenticated
using (true);
