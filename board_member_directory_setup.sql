create table if not exists board_member_directory (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  company_id uuid,
  full_name text,
  position text,
  email text,
  phone text,
  term_begin date,
  term_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists board_member_directory_community_idx
on board_member_directory(community_id);

create index if not exists board_member_directory_company_idx
on board_member_directory(company_id);

create index if not exists board_member_directory_email_idx
on board_member_directory(email);
