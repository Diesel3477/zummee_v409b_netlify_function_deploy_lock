alter table public.companies
add column if not exists logo_path text;

insert into storage.buckets (id, name, public)
values ('company_logos', 'company_logos', true)
on conflict (id) do nothing;

create policy if not exists "company_logos_authenticated_upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'company_logos');

create policy if not exists "company_logos_authenticated_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'company_logos')
with check (bucket_id = 'company_logos');

create policy if not exists "company_logos_authenticated_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'company_logos');

create policy if not exists "company_logos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'company_logos');


alter table companies
add column if not exists mailing_name text,
add column if not exists mailing_address_1 text,
add column if not exists mailing_address_2 text,
add column if not exists mailing_city text,
add column if not exists mailing_state text,
add column if not exists mailing_zip text;
