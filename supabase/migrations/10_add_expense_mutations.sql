-- Expense writes and settlement recording take the same group row lock. This
-- serializes financial mutations so a settlement cannot be recorded against a
-- partially changed or concurrently changing expense ledger.
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
  perform 1
  from public.groups
  where id = p_group_id
  for update;

  if not found then
    raise exception 'Group does not exist.';
  end if;

  if not exists (
    select 1
    from public.members
    where id = p_paid_by_member_id and group_id = p_group_id
  ) then
    raise exception 'Payer does not belong to the group.';
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
    select count(*)
    from public.members
    where group_id = p_group_id and id = any(p_participant_ids)
  ) <> cardinality(p_participant_ids) then
    raise exception 'All participants must belong to the group.';
  end if;

  if exists (
    select 1
    from unnest(p_participant_shares) as participant_share(share_cents)
    where share_cents < 0
  ) then
    raise exception 'Participant shares cannot be negative.';
  end if;

  select coalesce(sum(share_cents), 0)
  into v_share_total
  from unnest(p_participant_shares) as participant_share(share_cents);

  if p_amount_cents is null
    or p_amount_cents <= 0
    or v_share_total <> p_amount_cents then
    raise exception 'Participant shares must equal the expense amount.';
  end if;

  insert into public.expenses (
    group_id,
    title,
    amount_cents,
    paid_by_member_id,
    expense_date,
    notes
  )
  values (
    p_group_id,
    btrim(p_title),
    p_amount_cents,
    p_paid_by_member_id,
    coalesce(p_expense_date, current_date),
    nullif(btrim(p_notes), '')
  )
  returning id into v_expense_id;

  insert into public.expense_participants (
    expense_id,
    member_id,
    share_cents
  )
  select
    v_expense_id,
    participant.member_id,
    participant_share.share_cents
  from unnest(p_participant_ids) with ordinality
    as participant(member_id, position)
  join unnest(p_participant_shares) with ordinality
    as participant_share(share_cents, position)
    using (position);

  return v_expense_id;
end;
$$;

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
  v_current_updated_at timestamptz;
  v_share_total bigint;
begin
  perform 1
  from public.groups
  where id = p_group_id
  for update;

  if not found then
    return 'missing';
  end if;

  select expense.updated_at
  into v_current_updated_at
  from public.expenses as expense
  where expense.id = p_expense_id and expense.group_id = p_group_id
  for update;

  if not found then
    return 'missing';
  end if;

  if v_current_updated_at is distinct from p_expected_updated_at then
    return 'conflict';
  end if;

  if not exists (
    select 1
    from public.members
    where id = p_paid_by_member_id and group_id = p_group_id
  ) then
    raise exception 'Payer does not belong to the group.';
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
    select count(*)
    from public.members
    where group_id = p_group_id and id = any(p_participant_ids)
  ) <> cardinality(p_participant_ids) then
    raise exception 'All participants must belong to the group.';
  end if;

  if exists (
    select 1
    from unnest(p_participant_shares) as participant_share(share_cents)
    where share_cents < 0
  ) then
    raise exception 'Participant shares cannot be negative.';
  end if;

  select coalesce(sum(share_cents), 0)
  into v_share_total
  from unnest(p_participant_shares) as participant_share(share_cents);

  if p_amount_cents is null
    or p_amount_cents <= 0
    or v_share_total <> p_amount_cents then
    raise exception 'Participant shares must equal the expense amount.';
  end if;

  update public.expenses
  set
    title = btrim(p_title),
    amount_cents = p_amount_cents,
    paid_by_member_id = p_paid_by_member_id,
    expense_date = coalesce(p_expense_date, current_date),
    notes = nullif(btrim(p_notes), '')
  where id = p_expense_id;

  delete from public.expense_participants
  where expense_id = p_expense_id;

  insert into public.expense_participants (
    expense_id,
    member_id,
    share_cents
  )
  select
    p_expense_id,
    participant.member_id,
    participant_share.share_cents
  from unnest(p_participant_ids) with ordinality
    as participant(member_id, position)
  join unnest(p_participant_shares) with ordinality
    as participant_share(share_cents, position)
    using (position);

  return 'updated';
end;
$$;

create or replace function public.delete_expense(
  p_group_id uuid,
  p_expense_id uuid,
  p_expected_updated_at timestamptz
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_current_updated_at timestamptz;
begin
  perform 1
  from public.groups
  where id = p_group_id
  for update;

  if not found then
    return 'missing';
  end if;

  select expense.updated_at
  into v_current_updated_at
  from public.expenses as expense
  where expense.id = p_expense_id and expense.group_id = p_group_id
  for update;

  if not found then
    return 'missing';
  end if;

  if v_current_updated_at is distinct from p_expected_updated_at then
    return 'conflict';
  end if;

  delete from public.expenses
  where id = p_expense_id;

  return 'deleted';
end;
$$;

revoke all on function public.update_expense_with_participants(
  uuid, uuid, timestamptz, text, bigint, uuid, uuid[], bigint[], date, text
) from public, anon, authenticated;
grant execute on function public.update_expense_with_participants(
  uuid, uuid, timestamptz, text, bigint, uuid, uuid[], bigint[], date, text
) to service_role;

revoke all on function public.delete_expense(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.delete_expense(uuid, uuid, timestamptz)
  to service_role;
