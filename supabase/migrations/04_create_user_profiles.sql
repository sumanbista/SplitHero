create table public.profiles (
  id uuid primary key,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_id_fkey
    foreign key (id) references auth.users (id) on delete cascade,
  constraint profiles_display_name_length_check
    check (
      display_name is null
      or char_length(btrim(display_name)) between 1 and 80
    ),
  constraint profiles_avatar_url_length_check
    check (avatar_url is null or char_length(avatar_url) <= 2048)
);

create index groups_created_by_user_id_updated_at_idx
  on public.groups (created_by_user_id, updated_at desc)
  where created_by_user_id is not null;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    nullif(
      btrim(
        coalesce(
          new.raw_user_meta_data ->> 'display_name',
          new.raw_user_meta_data ->> 'full_name',
          ''
        )
      ),
      ''
    ),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user_profile()
  from public, anon, authenticated;

create trigger auth_users_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.profiles (id, display_name, avatar_url)
select
  auth_user.id,
  nullif(
    btrim(
      coalesce(
        auth_user.raw_user_meta_data ->> 'display_name',
        auth_user.raw_user_meta_data ->> 'full_name',
        ''
      )
    ),
    ''
  ),
  nullif(
    btrim(coalesce(auth_user.raw_user_meta_data ->> 'avatar_url', '')),
    ''
  )
from auth.users as auth_user
on conflict (id) do nothing;
