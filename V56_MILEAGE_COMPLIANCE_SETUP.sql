create table if not exists public.mileage_compliance_completions (
  id uuid primary key default gen_random_uuid(),
  employee_user_id uuid not null,
  employee_email text,
  employee_name text,
  company_id uuid,
  community_id uuid not null,
  community_name text,
  completed_at timestamptz not null default now(),
  month_key text not null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_mileage_compliance_once_per_month
  on public.mileage_compliance_completions (employee_user_id, community_id, month_key);
