-- Zummee Admin Contacts table for Employee Account Activations
create table if not exists public.admin_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  company_name text,
  admin_name text not null,
  admin_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, admin_email)
);

alter table public.admin_contacts enable row level security;

drop policy if exists "Company users can read admin contacts" on public.admin_contacts;
create policy "Company users can read admin contacts"
on public.admin_contacts
for select
using (true);

drop policy if exists "Supervisors can manage admin contacts" on public.admin_contacts;
create policy "Supervisors can manage admin contacts"
on public.admin_contacts
for all
using (true)
with check (true);
