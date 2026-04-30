create table if not exists community_directory_opt_ins (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid not null,
  resident_id uuid,
  resident_name text not null,
  address text,
  phone text,
  opted_in boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (community_id, resident_id)
);

create index if not exists idx_community_directory_opt_ins_community on community_directory_opt_ins (community_id);
create index if not exists idx_community_directory_opt_ins_visible on community_directory_opt_ins (community_id, opted_in);
alter table community_directory_opt_ins enable row level security;
drop policy if exists "Community members can read opted in directory" on community_directory_opt_ins;
create policy "Community members can read opted in directory" on community_directory_opt_ins for select using (opted_in = true);
drop policy if exists "Residents can manage directory opt in" on community_directory_opt_ins;
create policy "Residents can manage directory opt in" on community_directory_opt_ins for all using (true) with check (true);

create table if not exists architectural_change_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid not null,
  resident_id uuid,
  resident_email text,
  resident_name text,
  address text,
  request_title text not null,
  request_type text,
  description text,
  file_path text,
  status text default 'submitted',
  reviewer_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_architectural_change_requests_community on architectural_change_requests (community_id);
create index if not exists idx_architectural_change_requests_resident on architectural_change_requests (resident_id);
create index if not exists idx_architectural_change_requests_status on architectural_change_requests (status);
alter table architectural_change_requests enable row level security;
drop policy if exists "Residents and staff can read ACC requests" on architectural_change_requests;
create policy "Residents and staff can read ACC requests" on architectural_change_requests for select using (true);
drop policy if exists "Residents can submit ACC requests" on architectural_change_requests;
create policy "Residents can submit ACC requests" on architectural_change_requests for insert with check (true);
drop policy if exists "Staff can update ACC requests" on architectural_change_requests;
create policy "Staff can update ACC requests" on architectural_change_requests for update using (true) with check (true);

-- Create Supabase Storage bucket: acc-request-files
-- Recommended: public read if residents/staff need direct PDF/image links.
