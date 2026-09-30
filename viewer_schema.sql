-- MONOcheck 学習管理: 閲覧専用アクセス追加
-- 既存の monocheck_study_data / auth.users は変更しません。
create extension if not exists pgcrypto;

create table if not exists public.monocheck_viewer_access (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  viewer_id text not null unique,
  password_hash text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.monocheck_viewer_sessions (
  token_hash text primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists monocheck_viewer_sessions_owner_idx
  on public.monocheck_viewer_sessions(owner_user_id);
create index if not exists monocheck_viewer_sessions_expires_idx
  on public.monocheck_viewer_sessions(expires_at);

alter table public.monocheck_viewer_access enable row level security;
alter table public.monocheck_viewer_sessions enable row level security;

-- 閲覧認証の中身はクライアントから直接SELECTさせない。
-- 管理者本人だけが自分の閲覧IDを設定できる。
drop policy if exists "viewer_access_owner_select" on public.monocheck_viewer_access;
create policy "viewer_access_owner_select"
on public.monocheck_viewer_access for select to authenticated
using (auth.uid() = owner_user_id);

drop policy if exists "viewer_access_owner_insert" on public.monocheck_viewer_access;
create policy "viewer_access_owner_insert"
on public.monocheck_viewer_access for insert to authenticated
with check (auth.uid() = owner_user_id);

drop policy if exists "viewer_access_owner_update" on public.monocheck_viewer_access;
create policy "viewer_access_owner_update"
on public.monocheck_viewer_access for update to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

drop policy if exists "viewer_access_owner_delete" on public.monocheck_viewer_access;
create policy "viewer_access_owner_delete"
on public.monocheck_viewer_access for delete to authenticated
using (auth.uid() = owner_user_id);

-- セッション表はRPCだけから触る。
revoke all on public.monocheck_viewer_sessions from anon, authenticated;
revoke all on public.monocheck_viewer_access from anon;
grant select, insert, update, delete on public.monocheck_viewer_access to authenticated;

create or replace function public.monocheck_viewer_set_credentials(p_viewer_id text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '本人ログインが必要です'; end if;
  if length(trim(p_viewer_id)) < 3 or length(trim(p_viewer_id)) > 40 then raise exception '閲覧IDは3〜40文字で入力してください'; end if;
  if p_viewer_id !~ '^[A-Za-z0-9_-]+$' then raise exception '閲覧IDは英数字・_・-のみ使用できます'; end if;
  if length(p_password) < 6 then raise exception '閲覧パスワードは6文字以上にしてください'; end if;
  insert into public.monocheck_viewer_access(owner_user_id, viewer_id, password_hash, enabled, updated_at)
  values(uid, trim(p_viewer_id), crypt(p_password, gen_salt('bf')), true, now())
  on conflict (owner_user_id) do update
    set viewer_id=excluded.viewer_id,
        password_hash=excluded.password_hash,
        enabled=true,
        updated_at=now();
end;
$$;

create or replace function public.monocheck_viewer_disable()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.monocheck_viewer_access
     set enabled=false, updated_at=now()
   where owner_user_id=auth.uid();
end;
$$;

create or replace function public.monocheck_viewer_login(p_viewer_id text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare rec public.monocheck_viewer_access%rowtype;
      raw_token text;
      token_digest text;
      payload jsonb;
begin
  select * into rec
    from public.monocheck_viewer_access
   where viewer_id=trim(p_viewer_id) and enabled=true
   limit 1;
  if rec.owner_user_id is null or rec.password_hash is null or crypt(p_password, rec.password_hash) <> rec.password_hash then
    raise exception '閲覧IDまたはパスワードが違います';
  end if;

  delete from public.monocheck_viewer_sessions where expires_at < now();
  raw_token := encode(gen_random_bytes(32),'hex');
  token_digest := encode(digest(raw_token,'sha256'),'hex');
  insert into public.monocheck_viewer_sessions(token_hash, owner_user_id, expires_at)
  values(token_digest, rec.owner_user_id, now() + interval '30 days');

  select jsonb_build_object(
    'token', raw_token,
    'owner_user_id', rec.owner_user_id,
    'expires_at', now() + interval '30 days',
    'data', coalesce((select data from public.monocheck_study_data where user_id=rec.owner_user_id), '{}'::jsonb),
    'updated_at', coalesce((select updated_at from public.monocheck_study_data where user_id=rec.owner_user_id), now())
  ) into payload;
  return payload;
end;
$$;

create or replace function public.monocheck_viewer_get_data(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare uid uuid;
begin
  select owner_user_id into uid
    from public.monocheck_viewer_sessions
   where token_hash=encode(digest(p_token,'sha256'),'hex')
     and expires_at > now()
   limit 1;
  if uid is null then raise exception '閲覧セッションが無効または期限切れです'; end if;
  return jsonb_build_object(
    'data', coalesce((select data from public.monocheck_study_data where user_id=uid), '{}'::jsonb),
    'updated_at', coalesce((select updated_at from public.monocheck_study_data where user_id=uid), now())
  );
end;
$$;

create or replace function public.monocheck_viewer_logout(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.monocheck_viewer_sessions
   where token_hash=encode(digest(p_token,'sha256'),'hex');
end;
$$;

revoke all on function public.monocheck_viewer_set_credentials(text,text) from public;
revoke all on function public.monocheck_viewer_disable() from public;
revoke all on function public.monocheck_viewer_login(text,text) from public;
revoke all on function public.monocheck_viewer_get_data(text) from public;
revoke all on function public.monocheck_viewer_logout(text) from public;
grant execute on function public.monocheck_viewer_set_credentials(text,text) to authenticated;
grant execute on function public.monocheck_viewer_disable() to authenticated;
grant execute on function public.monocheck_viewer_login(text,text) to anon, authenticated;
grant execute on function public.monocheck_viewer_get_data(text) to anon, authenticated;
grant execute on function public.monocheck_viewer_logout(text) to anon, authenticated;
