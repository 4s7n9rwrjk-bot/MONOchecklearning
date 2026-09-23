create table if not exists public.monocheck_study_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- PostgREST/Supabaseからauthenticatedユーザーが表へアクセスできるようにする
grant usage on schema public to authenticated;
grant select, insert, update on table public.monocheck_study_data to authenticated;

alter table public.monocheck_study_data enable row level security;

drop policy if exists "study select own" on public.monocheck_study_data;
drop policy if exists "study insert own" on public.monocheck_study_data;
drop policy if exists "study update own" on public.monocheck_study_data;

create policy "study select own"
on public.monocheck_study_data for select
to authenticated
using (auth.uid() = user_id);

create policy "study insert own"
on public.monocheck_study_data for insert
to authenticated
with check (auth.uid() = user_id);

create policy "study update own"
on public.monocheck_study_data for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Supabase/PostgRESTのスキーマキャッシュを更新
notify pgrst, 'reload schema';
