create table if not exists workspace_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  student_id uuid not null,
  type text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
