-- MONOcheck Cloud Sync (Supabase)
-- SupabaseのSQL Editorにそのまま貼り付けて実行してください。

create table if not exists public.monocheck_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.monocheck_data enable row level security;

drop policy if exists "Users can read own MONOcheck data" on public.monocheck_data;
drop policy if exists "Users can insert own MONOcheck data" on public.monocheck_data;
drop policy if exists "Users can update own MONOcheck data" on public.monocheck_data;

create policy "Users can read own MONOcheck data"
on public.monocheck_data for select
using (auth.uid() = user_id);

create policy "Users can insert own MONOcheck data"
on public.monocheck_data for insert
with check (auth.uid() = user_id);

create policy "Users can update own MONOcheck data"
on public.monocheck_data for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
