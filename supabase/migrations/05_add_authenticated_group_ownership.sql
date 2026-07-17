alter table public.groups
  add constraint groups_created_by_user_id_fkey
  foreign key (created_by_user_id)
  references auth.users (id)
  on delete set null;

comment on column public.groups.created_by_user_id is
  'Server-validated owner for account-created groups; null for guest groups.';
