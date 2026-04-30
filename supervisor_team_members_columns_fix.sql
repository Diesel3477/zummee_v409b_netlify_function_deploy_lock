-- Optional cleanup if you want the table to match the richer app schema later.
-- The current v35 build no longer requires these columns.
alter table if exists supervisor_team_members
add column if not exists supervisor_name text;

alter table if exists supervisor_team_members
add column if not exists employee_name text;
