alter table public.groups
  add column description text,
  add column archived_at timestamptz,
  add constraint groups_description_length_check
    check (description is null or char_length(description) <= 500);

comment on column public.groups.description is
  'Optional owner-managed context for the group. Empty values are stored as null.';
comment on column public.groups.archived_at is
  'When set, the group remains viewable under its existing access rules but is read-only.';

create index groups_created_by_user_archived_updated_idx
  on public.groups (created_by_user_id, archived_at, updated_at desc)
  where created_by_user_id is not null;

alter table public.group_activity_events
  drop constraint group_activity_events_event_type_check;

alter table public.group_activity_events
  add constraint group_activity_events_event_type_check
    check (event_type in (
      'group.created',
      'group.renamed',
      'group.description_updated',
      'group.access_changed',
      'group.archived',
      'group.restored',
      'member.added',
      'member.renamed',
      'member.archived',
      'member.restored',
      'member.removed',
      'expense.created',
      'expense.updated',
      'expense.deleted',
      'settlement.recorded',
      'invitation.sent',
      'invitation.accepted',
      'invitation.declined'
    ));

create or replace function public.prevent_archived_group_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  if tg_table_name = 'expense_participants' then
    select expense.group_id into v_group_id
    from public.expenses as expense
    where expense.id = case when tg_op = 'DELETE' then old.expense_id else new.expense_id end;
  else
    v_group_id := case when tg_op = 'DELETE' then old.group_id else new.group_id end;
  end if;

  if exists (
    select 1
    from public.groups
    where id = v_group_id and archived_at is not null
  ) then
    raise exception 'group_is_archived';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.prevent_archived_group_mutation()
  from public, anon, authenticated;

create trigger members_prevent_archived_group_mutation
before insert or update or delete on public.members
for each row execute function public.prevent_archived_group_mutation();

create trigger expenses_prevent_archived_group_mutation
before insert or update or delete on public.expenses
for each row execute function public.prevent_archived_group_mutation();

create trigger expense_participants_prevent_archived_group_mutation
before insert or update or delete on public.expense_participants
for each row execute function public.prevent_archived_group_mutation();

create trigger settlement_payments_prevent_archived_group_mutation
before insert or update or delete on public.settlement_payments
for each row execute function public.prevent_archived_group_mutation();

create trigger group_memberships_prevent_archived_group_mutation
before insert or update or delete on public.group_memberships
for each row execute function public.prevent_archived_group_mutation();

create trigger group_invitations_prevent_archived_group_mutation
before insert or update or delete on public.group_invitations
for each row execute function public.prevent_archived_group_mutation();

create or replace function public.update_group_details_with_activity(
  p_group_id uuid,
  p_name text,
  p_description text,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups%rowtype;
  v_name text := btrim(p_name);
  v_description text := nullif(btrim(p_description), '');
begin
  select * into v_group
  from public.groups
  where id = p_group_id
  for update;

  if not found then
    return 'missing';
  end if;

  if p_actor_user_id is null
    or v_group.created_by_user_id is distinct from p_actor_user_id then
    return 'forbidden';
  end if;

  if v_group.archived_at is not null then
    return 'archived';
  end if;

  if v_group.name = v_name
    and v_group.description is not distinct from v_description then
    return 'unchanged';
  end if;

  update public.groups
  set name = v_name, description = v_description
  where id = p_group_id;

  if v_group.name is distinct from v_name then
    perform public.record_group_activity(
      p_group_id,
      p_actor_user_id,
      'group.renamed',
      p_group_id,
      jsonb_build_object(
        'previousName', v_group.name,
        'groupName', v_name
      )
    );
  end if;

  if v_group.description is distinct from v_description then
    perform public.record_group_activity(
      p_group_id,
      p_actor_user_id,
      'group.description_updated',
      p_group_id,
      '{}'::jsonb
    );
  end if;

  return 'updated';
end;
$$;

revoke all on function public.update_group_details_with_activity(
  uuid, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.update_group_details_with_activity(
  uuid, text, text, uuid
) to service_role;

create or replace function public.archive_group_with_activity(
  p_group_id uuid,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups%rowtype;
begin
  select * into v_group
  from public.groups
  where id = p_group_id
  for update;

  if not found then
    return 'missing';
  end if;

  if p_actor_user_id is null
    or v_group.created_by_user_id is distinct from p_actor_user_id then
    return 'forbidden';
  end if;

  if v_group.archived_at is not null then
    return 'already_archived';
  end if;

  update public.groups set archived_at = now() where id = p_group_id;

  perform public.record_group_activity(
    p_group_id,
    p_actor_user_id,
    'group.archived',
    p_group_id,
    '{}'::jsonb
  );

  return 'archived';
end;
$$;

revoke all on function public.archive_group_with_activity(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.archive_group_with_activity(uuid, uuid)
  to service_role;

create or replace function public.restore_group_with_activity(
  p_group_id uuid,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups%rowtype;
begin
  select * into v_group
  from public.groups
  where id = p_group_id
  for update;

  if not found then
    return 'missing';
  end if;

  if p_actor_user_id is null
    or v_group.created_by_user_id is distinct from p_actor_user_id then
    return 'forbidden';
  end if;

  if v_group.archived_at is null then
    return 'already_active';
  end if;

  update public.groups set archived_at = null where id = p_group_id;

  perform public.record_group_activity(
    p_group_id,
    p_actor_user_id,
    'group.restored',
    p_group_id,
    '{}'::jsonb
  );

  return 'restored';
end;
$$;

revoke all on function public.restore_group_with_activity(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.restore_group_with_activity(uuid, uuid)
  to service_role;

create or replace function public.permanently_delete_group(
  p_group_id uuid,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups%rowtype;
begin
  select * into v_group
  from public.groups
  where id = p_group_id
  for update;

  if not found then
    return 'missing';
  end if;

  if p_actor_user_id is null
    or v_group.created_by_user_id is distinct from p_actor_user_id then
    return 'forbidden';
  end if;

  if v_group.archived_at is null then
    return 'active';
  end if;

  delete from public.groups where id = p_group_id;
  return 'deleted';
end;
$$;

revoke all on function public.permanently_delete_group(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.permanently_delete_group(uuid, uuid)
  to service_role;

create or replace function public.update_group_access_with_activity(
  p_group_id uuid,
  p_access_mode text,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups%rowtype;
begin
  if p_access_mode not in ('public', 'private') then
    raise exception 'invalid_access_mode';
  end if;

  select * into v_group
  from public.groups
  where id = p_group_id
  for update;

  if not found then
    return 'missing';
  end if;

  if p_actor_user_id is null
    or v_group.created_by_user_id is distinct from p_actor_user_id then
    return 'forbidden';
  end if;

  if v_group.archived_at is not null then
    return 'archived';
  end if;

  if v_group.access_mode = p_access_mode then
    return 'unchanged';
  end if;

  update public.groups
  set access_mode = p_access_mode
  where id = p_group_id;

  perform public.record_group_activity(
    p_group_id,
    p_actor_user_id,
    'group.access_changed',
    p_group_id,
    jsonb_build_object(
      'previousAccessMode', v_group.access_mode,
      'accessMode', p_access_mode
    )
  );

  return 'updated';
end;
$$;

revoke all on function public.update_group_access_with_activity(
  uuid, text, uuid
) from public, anon, authenticated;
grant execute on function public.update_group_access_with_activity(
  uuid, text, uuid
) to service_role;
