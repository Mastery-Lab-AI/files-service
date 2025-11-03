-- Enable RLS on workspace_files (idempotent)
alter table if exists public.workspace_files enable row level security;

-- Drop existing conflicting policies (if they exist)
drop policy if exists "Student can DELETE files" on public.workspace_files;
drop policy if exists "Student can SELECT files" on public.workspace_files;
drop policy if exists "Student can INSERT files" on public.workspace_files;

-- SELECT: a student can read their own rows
create policy "Student can SELECT files"
  on public.workspace_files
  for select
  to authenticated
  using (auth.uid() = student_id);

-- DELETE: a student can delete their own rows
create policy "Student can DELETE files"
  on public.workspace_files
  for delete
  to authenticated
  using (auth.uid() = student_id);

-- INSERT (optional): a student can insert rows for themselves
create policy "Student can INSERT files"
  on public.workspace_files
  for insert
  to authenticated
  with check (auth.uid() = student_id);

-- Data alignment for legacy notes: set student_id = workspace_id where they differ
-- This brings old rows in line with current app expectations so deletes will be authorized.
update public.workspace_files
   set student_id = workspace_id
 where type = 'note'
   and student_id is distinct from workspace_id;

