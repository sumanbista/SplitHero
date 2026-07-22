-- Keep table-specific trigger fields inside their matching table branch.
-- A group owner initially has no linked participant, so the previous function
-- fell through from group_memberships and read a nonexistent invitation field.
create or replace function public.enforce_same_group_relationships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  if tg_table_name = 'expenses' then
    select member.group_id into v_group_id
    from public.members as member
    where member.id = new.paid_by_member_id;

    if v_group_id is distinct from new.group_id then
      raise exception 'payer_group_mismatch';
    end if;
  elsif tg_table_name = 'expense_participants' then
    select expense.group_id into v_group_id
    from public.expenses as expense
    where expense.id = new.expense_id;

    if v_group_id is null or not exists (
      select 1 from public.members as member
      where member.id = new.member_id and member.group_id = v_group_id
    ) then
      raise exception 'participant_group_mismatch';
    end if;
  elsif tg_table_name = 'settlement_payments' then
    if (
      select count(*)
      from public.members as member
      where member.group_id = new.group_id
        and member.id in (new.from_member_id, new.to_member_id)
    ) <> 2 then
      raise exception 'settlement_group_mismatch';
    end if;
  elsif tg_table_name = 'group_memberships' then
    if new.member_id is not null then
      select member.group_id into v_group_id
      from public.members as member
      where member.id = new.member_id;

      if v_group_id is distinct from new.group_id then
        raise exception 'membership_group_mismatch';
      end if;
    end if;
  elsif tg_table_name = 'group_invitations' then
    if new.invited_member_id is not null then
      select member.group_id into v_group_id
      from public.members as member
      where member.id = new.invited_member_id;

      if v_group_id is distinct from new.group_id then
        raise exception 'invitation_group_mismatch';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_same_group_relationships()
  from public, anon, authenticated;

-- An authenticated owner is both an access-control principal and an expense
-- participant. Creating and linking both records in this trigger keeps group
-- creation atomic. Guest groups intentionally remain empty.
create or replace function public.create_owner_group_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_member_name text;
begin
  if new.created_by_user_id is not null then
    select left(
      coalesce(nullif(btrim(profile.display_name), ''), 'Group owner'),
      50
    )
    into v_member_name
    from auth.users as auth_user
    left join public.profiles as profile on profile.id = auth_user.id
    where auth_user.id = new.created_by_user_id;

    insert into public.members (group_id, name, user_id)
    values (
      new.id,
      coalesce(v_member_name, 'Group owner'),
      new.created_by_user_id
    )
    returning id into v_member_id;

    insert into public.group_memberships (
      group_id,
      user_id,
      member_id,
      role
    )
    values (
      new.id,
      new.created_by_user_id,
      v_member_id,
      'owner'
    )
    on conflict (group_id, user_id) do update
    set role = 'owner', member_id = excluded.member_id;
  end if;

  return new;
end;
$$;

revoke all on function public.create_owner_group_membership()
  from public, anon, authenticated;
