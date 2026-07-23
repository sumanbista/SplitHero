alter table public.members
  add column is_active boolean not null default true,
  add column archived_at timestamptz,
  add constraint members_archive_state_check
    check (
      (is_active and archived_at is null)
      or (not is_active and archived_at is not null)
    );

alter table public.group_activity_events
  drop constraint group_activity_events_event_type_check;

alter table public.group_activity_events
  add constraint group_activity_events_event_type_check
    check (event_type in (
      'group.created',
      'group.renamed',
      'group.access_changed',
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

create or replace function public.rename_member_with_activity(
  p_group_id uuid,
  p_member_id uuid,
  p_name text,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_name text;
  v_name text := btrim(p_name);
begin
  perform 1 from public.groups where id = p_group_id for update;
  if not found then
    return 'missing';
  end if;

  select name into v_previous_name
  from public.members
  where id = p_member_id and group_id = p_group_id
  for update;

  if not found then
    return 'missing';
  end if;

  if v_previous_name = v_name then
    return 'unchanged';
  end if;

  update public.members set name = v_name where id = p_member_id;

  perform public.record_group_activity(
    p_group_id,
    p_actor_user_id,
    'member.renamed',
    p_member_id,
    jsonb_build_object(
      'previousName', v_previous_name,
      'memberName', v_name
    )
  );

  return 'renamed';
end;
$$;

create or replace function public.set_member_active_with_activity(
  p_group_id uuid,
  p_member_id uuid,
  p_is_active boolean,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_name text;
  v_is_active boolean;
begin
  perform 1 from public.groups where id = p_group_id for update;
  if not found then
    return 'missing';
  end if;

  select name, is_active into v_member_name, v_is_active
  from public.members
  where id = p_member_id and group_id = p_group_id
  for update;

  if not found then
    return 'missing';
  end if;

  if v_is_active = p_is_active then
    return case when p_is_active then 'already_active' else 'already_archived' end;
  end if;

  update public.members
  set
    is_active = p_is_active,
    archived_at = case when p_is_active then null else now() end
  where id = p_member_id;

  perform public.record_group_activity(
    p_group_id,
    p_actor_user_id,
    case when p_is_active then 'member.restored' else 'member.archived' end,
    p_member_id,
    jsonb_build_object('memberName', v_member_name)
  );

  return case when p_is_active then 'restored' else 'archived' end;
end;
$$;

create or replace function public.remove_unused_member_with_activity(
  p_group_id uuid,
  p_member_id uuid,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members%rowtype;
  v_balance_cents bigint;
begin
  perform 1 from public.groups where id = p_group_id for update;
  if not found then
    return 'missing';
  end if;

  select * into v_member
  from public.members
  where id = p_member_id and group_id = p_group_id
  for update;

  if not found then
    return 'missing';
  end if;

  if v_member.user_id is not null
    or exists (
      select 1 from public.group_memberships
      where group_id = p_group_id and member_id = p_member_id
    ) then
    return 'account_linked';
  end if;

  select
    coalesce((
      select sum(amount_cents) from public.expenses
      where group_id = p_group_id and paid_by_member_id = p_member_id
    ), 0)
    - coalesce((
      select sum(participant.share_cents)
      from public.expense_participants as participant
      join public.expenses as expense on expense.id = participant.expense_id
      where expense.group_id = p_group_id and participant.member_id = p_member_id
    ), 0)
    + coalesce((
      select sum(amount_cents) from public.settlement_payments
      where group_id = p_group_id and from_member_id = p_member_id
    ), 0)
    - coalesce((
      select sum(amount_cents) from public.settlement_payments
      where group_id = p_group_id and to_member_id = p_member_id
    ), 0)
  into v_balance_cents;

  if v_balance_cents <> 0 then
    return 'non_zero_balance';
  end if;

  if exists (
    select 1 from public.expenses
    where group_id = p_group_id and paid_by_member_id = p_member_id
  ) or exists (
    select 1
    from public.expense_participants as participant
    join public.expenses as expense on expense.id = participant.expense_id
    where expense.group_id = p_group_id and participant.member_id = p_member_id
  ) or exists (
    select 1 from public.settlement_payments
    where group_id = p_group_id
      and p_member_id in (from_member_id, to_member_id)
  ) or exists (
    select 1 from public.group_invitations
    where group_id = p_group_id and invited_member_id = p_member_id
  ) then
    return 'has_history';
  end if;

  perform public.record_group_activity(
    p_group_id,
    p_actor_user_id,
    'member.removed',
    p_member_id,
    jsonb_build_object('memberName', v_member.name)
  );

  delete from public.members where id = p_member_id;
  return 'removed';
end;
$$;

revoke all on function public.rename_member_with_activity(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.rename_member_with_activity(uuid, uuid, text, uuid)
  to service_role;

revoke all on function public.set_member_active_with_activity(uuid, uuid, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.set_member_active_with_activity(uuid, uuid, boolean, uuid)
  to service_role;

revoke all on function public.remove_unused_member_with_activity(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.remove_unused_member_with_activity(uuid, uuid, uuid)
  to service_role;

create or replace function public.require_active_invited_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.invited_member_id is not null and not exists (
    select 1 from public.members
    where id = new.invited_member_id
      and group_id = new.group_id
      and is_active
  ) then
    raise exception 'invited_member_inactive';
  end if;
  return new;
end;
$$;

revoke all on function public.require_active_invited_member()
  from public, anon, authenticated;

create trigger group_invitations_require_active_member
before insert or update of invited_member_id on public.group_invitations
for each row execute function public.require_active_invited_member();

-- New expenses may only use active members.
create or replace function public.create_expense_with_participants(
  p_group_id uuid,
  p_title text,
  p_amount_cents bigint,
  p_paid_by_member_id uuid,
  p_participant_ids uuid[],
  p_participant_shares bigint[],
  p_expense_date date,
  p_notes text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_expense_id uuid;
  v_share_total bigint;
begin
  perform 1 from public.groups where id = p_group_id for update;
  if not found then raise exception 'Group does not exist.'; end if;

  if not exists (
    select 1 from public.members
    where id = p_paid_by_member_id and group_id = p_group_id and is_active
  ) then
    raise exception 'Payer is not an active member of the group.';
  end if;

  if coalesce(cardinality(p_participant_ids), 0) = 0
    or cardinality(p_participant_ids) <> cardinality(p_participant_shares) then
    raise exception 'Participant ids and shares must be non-empty and aligned.';
  end if;

  if (
    select count(distinct participant_id)
    from unnest(p_participant_ids) as participant(participant_id)
  ) <> cardinality(p_participant_ids) then
    raise exception 'Participants must be unique.';
  end if;

  if (
    select count(*) from public.members
    where group_id = p_group_id and is_active and id = any(p_participant_ids)
  ) <> cardinality(p_participant_ids) then
    raise exception 'All participants must be active members of the group.';
  end if;

  if exists (
    select 1 from unnest(p_participant_shares) as share(share_cents)
    where share_cents < 0
  ) then
    raise exception 'Participant shares cannot be negative.';
  end if;

  select coalesce(sum(share_cents), 0) into v_share_total
  from unnest(p_participant_shares) as share(share_cents);

  if p_amount_cents is null or p_amount_cents <= 0
    or v_share_total <> p_amount_cents then
    raise exception 'Participant shares must equal the expense amount.';
  end if;

  insert into public.expenses (
    group_id, title, amount_cents, paid_by_member_id, expense_date, notes
  ) values (
    p_group_id, btrim(p_title), p_amount_cents, p_paid_by_member_id,
    coalesce(p_expense_date, current_date), nullif(btrim(p_notes), '')
  ) returning id into v_expense_id;

  insert into public.expense_participants (expense_id, member_id, share_cents)
  select v_expense_id, participant.member_id, share.share_cents
  from unnest(p_participant_ids) with ordinality
    as participant(member_id, position)
  join unnest(p_participant_shares) with ordinality
    as share(share_cents, position) using (position);

  return v_expense_id;
end;
$$;

-- Existing archived payers/participants may remain on an edited expense, but
-- archived members cannot be newly introduced to it.
create or replace function public.update_expense_with_participants(
  p_group_id uuid,
  p_expense_id uuid,
  p_expected_updated_at timestamptz,
  p_title text,
  p_amount_cents bigint,
  p_paid_by_member_id uuid,
  p_participant_ids uuid[],
  p_participant_shares bigint[],
  p_expense_date date,
  p_notes text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_previous public.expenses%rowtype;
  v_share_total bigint;
begin
  perform 1 from public.groups where id = p_group_id for update;
  if not found then return 'missing'; end if;

  select * into v_previous from public.expenses
  where id = p_expense_id and group_id = p_group_id
  for update;
  if not found then return 'missing'; end if;
  if v_previous.updated_at is distinct from p_expected_updated_at then
    return 'conflict';
  end if;

  if not exists (
    select 1 from public.members
    where id = p_paid_by_member_id and group_id = p_group_id
      and (is_active or id = v_previous.paid_by_member_id)
  ) then
    raise exception 'Payer is not available for this expense.';
  end if;

  if coalesce(cardinality(p_participant_ids), 0) = 0
    or cardinality(p_participant_ids) <> cardinality(p_participant_shares) then
    raise exception 'Participant ids and shares must be non-empty and aligned.';
  end if;

  if (
    select count(distinct participant_id)
    from unnest(p_participant_ids) as participant(participant_id)
  ) <> cardinality(p_participant_ids) then
    raise exception 'Participants must be unique.';
  end if;

  if exists (
    select 1 from unnest(p_participant_ids) as participant(member_id)
    where not exists (
      select 1 from public.members as member
      where member.id = participant.member_id
        and member.group_id = p_group_id
        and (
          member.is_active
          or exists (
            select 1 from public.expense_participants as previous_participant
            where previous_participant.expense_id = p_expense_id
              and previous_participant.member_id = member.id
          )
        )
    )
  ) then
    raise exception 'Participant is not available for this expense.';
  end if;

  if exists (
    select 1 from unnest(p_participant_shares) as share(share_cents)
    where share_cents < 0
  ) then
    raise exception 'Participant shares cannot be negative.';
  end if;

  select coalesce(sum(share_cents), 0) into v_share_total
  from unnest(p_participant_shares) as share(share_cents);
  if p_amount_cents is null or p_amount_cents <= 0
    or v_share_total <> p_amount_cents then
    raise exception 'Participant shares must equal the expense amount.';
  end if;

  update public.expenses set
    title = btrim(p_title),
    amount_cents = p_amount_cents,
    paid_by_member_id = p_paid_by_member_id,
    expense_date = coalesce(p_expense_date, current_date),
    notes = nullif(btrim(p_notes), '')
  where id = p_expense_id;

  delete from public.expense_participants where expense_id = p_expense_id;
  insert into public.expense_participants (expense_id, member_id, share_cents)
  select p_expense_id, participant.member_id, share.share_cents
  from unnest(p_participant_ids) with ordinality
    as participant(member_id, position)
  join unnest(p_participant_shares) with ordinality
    as share(share_cents, position) using (position);

  return 'updated';
end;
$$;
