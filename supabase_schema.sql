create table if not exists public.monocheck_study_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.monocheck_study_data enable row level security;
drop policy if exists "study select own" on public.monocheck_study_data;
drop policy if exists "study insert own" on public.monocheck_study_data;
drop policy if exists "study update own" on public.monocheck_study_data;
create policy "study select own" on public.monocheck_study_data for select using (auth.uid()=user_id);
create policy "study insert own" on public.monocheck_study_data for insert with check (auth.uid()=user_id);
create policy "study update own" on public.monocheck_study_data for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
