alter table public.expenses
  add column split_mode text not null default 'equal',
  add constraint expenses_split_mode_check
    check (split_mode in ('equal', 'exact', 'percentage'));

alter table public.expense_participants
  add column percentage_basis_points integer,
  add constraint expense_participants_percentage_basis_points_check
    check (
      percentage_basis_points is null
      or percentage_basis_points between 0 and 10000
    );

create or replace function public.create_expense_with_participants(
  p_group_id uuid,
  p_title text,
  p_amount_cents bigint,
  p_paid_by_member_id uuid,
  p_participant_ids uuid[],
  p_participant_shares bigint[],
  p_split_mode text,
  p_participant_percentages integer[],
  p_expense_date date,
  p_notes text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
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

  if p_split_mode is null
    or p_split_mode not in ('equal', 'exact', 'percentage') then
    raise exception 'Expense split mode is invalid.';
  end if;

  if p_split_mode = 'percentage' then
    if cardinality(p_participant_percentages)
      is distinct from cardinality(p_participant_ids)
      or exists (
        select 1
        from unnest(p_participant_percentages) as percentage(basis_points)
        where basis_points is null or basis_points < 0 or basis_points > 10000
      )
      or (
        select coalesce(sum(basis_points), 0)
        from unnest(p_participant_percentages) as percentage(basis_points)
      ) <> 10000 then
      raise exception 'Participant percentages must be aligned and total 100%%.';
    end if;
  elsif coalesce(cardinality(p_participant_percentages), 0) <> 0 then
    raise exception 'Only percentage splits may store percentages.';
  end if;

  insert into public.expenses (
    group_id,
    title,
    amount_cents,
    paid_by_member_id,
    split_mode,
    expense_date,
    notes
  ) values (
    p_group_id,
    btrim(p_title),
    p_amount_cents,
    p_paid_by_member_id,
    p_split_mode,
    coalesce(p_expense_date, current_date),
    nullif(btrim(p_notes), '')
  ) returning id into v_expense_id;

  insert into public.expense_participants (
    expense_id,
    member_id,
    share_cents,
    percentage_basis_points
  )
  select
    v_expense_id,
    participant.member_id,
    p_participant_shares[participant.position::integer],
    case
      when p_split_mode = 'percentage'
        then p_participant_percentages[participant.position::integer]
      else null
    end
  from unnest(p_participant_ids) with ordinality
    as participant(member_id, position);

  perform public.record_group_activity(
    p_group_id,
    p_actor_user_id,
    'expense.created',
    v_expense_id,
    jsonb_build_object(
      'title', btrim(p_title),
      'amountCents', p_amount_cents
    )
  );

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
  p_split_mode text,
  p_participant_percentages integer[],
  p_expense_date date,
  p_notes text,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous public.expenses%rowtype;
  v_previous_participant_ids uuid[];
  v_previous_participant_shares bigint[];
  v_new_participant_ids uuid[];
  v_new_participant_shares bigint[];
  v_previous_payer_name text;
  v_new_payer_name text;
  v_new_date date := coalesce(p_expense_date, current_date);
  v_new_notes text := nullif(btrim(p_notes), '');
  v_share_total bigint;
  v_changes text[] := array[]::text[];
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

  select
    coalesce(array_agg(member_id order by member_id), array[]::uuid[]),
    coalesce(array_agg(share_cents order by member_id), array[]::bigint[])
  into v_previous_participant_ids, v_previous_participant_shares
  from public.expense_participants
  where expense_id = p_expense_id;

  select
    coalesce(array_agg(participant.member_id order by participant.member_id), array[]::uuid[]),
    coalesce(array_agg(participant.share_cents order by participant.member_id), array[]::bigint[])
  into v_new_participant_ids, v_new_participant_shares
  from (
    select
      member.member_id,
      p_participant_shares[member.position::integer] as share_cents
    from unnest(p_participant_ids) with ordinality
      as member(member_id, position)
  ) as participant;

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
            select 1
            from public.expense_participants as previous_participant
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

  if p_split_mode is null
    or p_split_mode not in ('equal', 'exact', 'percentage') then
    raise exception 'Expense split mode is invalid.';
  end if;

  if p_split_mode = 'percentage' then
    if cardinality(p_participant_percentages)
      is distinct from cardinality(p_participant_ids)
      or exists (
        select 1
        from unnest(p_participant_percentages) as percentage(basis_points)
        where basis_points is null or basis_points < 0 or basis_points > 10000
      )
      or (
        select coalesce(sum(basis_points), 0)
        from unnest(p_participant_percentages) as percentage(basis_points)
      ) <> 10000 then
      raise exception 'Participant percentages must be aligned and total 100%%.';
    end if;
  elsif coalesce(cardinality(p_participant_percentages), 0) <> 0 then
    raise exception 'Only percentage splits may store percentages.';
  end if;

  update public.expenses set
    title = btrim(p_title),
    amount_cents = p_amount_cents,
    paid_by_member_id = p_paid_by_member_id,
    split_mode = p_split_mode,
    expense_date = v_new_date,
    notes = v_new_notes
  where id = p_expense_id;

  delete from public.expense_participants where expense_id = p_expense_id;
  insert into public.expense_participants (
    expense_id,
    member_id,
    share_cents,
    percentage_basis_points
  )
  select
    p_expense_id,
    participant.member_id,
    p_participant_shares[participant.position::integer],
    case
      when p_split_mode = 'percentage'
        then p_participant_percentages[participant.position::integer]
      else null
    end
  from unnest(p_participant_ids) with ordinality
    as participant(member_id, position);

  if v_previous.title is distinct from btrim(p_title) then
    v_changes := array_append(v_changes, 'title');
  end if;
  if v_previous.amount_cents is distinct from p_amount_cents then
    v_changes := array_append(v_changes, 'amount');
  end if;
  if v_previous.paid_by_member_id is distinct from p_paid_by_member_id then
    v_changes := array_append(v_changes, 'payer');
  end if;
  if v_previous_participant_ids is distinct from v_new_participant_ids then
    v_changes := array_append(v_changes, 'participants');
  elsif v_previous_participant_shares is distinct from v_new_participant_shares
    or v_previous.split_mode is distinct from p_split_mode then
    v_changes := array_append(v_changes, 'split');
  end if;
  if v_previous.expense_date is distinct from v_new_date then
    v_changes := array_append(v_changes, 'date');
  end if;
  if v_previous.notes is distinct from v_new_notes then
    v_changes := array_append(v_changes, 'notes');
  end if;

  if cardinality(v_changes) = 0 then
    return 'updated';
  end if;

  if 'payer' = any(v_changes) then
    select name into v_previous_payer_name
    from public.members where id = v_previous.paid_by_member_id;
    select name into v_new_payer_name
    from public.members where id = p_paid_by_member_id;
  end if;

  perform public.record_group_activity(
    p_group_id,
    p_actor_user_id,
    'expense.updated',
    p_expense_id,
    jsonb_strip_nulls(jsonb_build_object(
      'changes', to_jsonb(v_changes),
      'previousTitle', v_previous.title,
      'title', btrim(p_title),
      'previousAmountCents', v_previous.amount_cents,
      'amountCents', p_amount_cents,
      'previousPayerName', v_previous_payer_name,
      'payerName', v_new_payer_name,
      'previousDate', v_previous.expense_date,
      'date', v_new_date
    ))
  );

  return 'updated';
end;
$$;

-- Keep the previous Server Action signature safe during rolling deployments.
-- Older app instances still create equal splits, but now pass through the new
-- transaction so split metadata cannot become inconsistent.
create or replace function public.create_expense_with_participants(
  p_group_id uuid,
  p_title text,
  p_amount_cents bigint,
  p_paid_by_member_id uuid,
  p_participant_ids uuid[],
  p_participant_shares bigint[],
  p_expense_date date,
  p_notes text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.create_expense_with_participants(
    p_group_id,
    p_title,
    p_amount_cents,
    p_paid_by_member_id,
    p_participant_ids,
    p_participant_shares,
    'equal',
    null::integer[],
    p_expense_date,
    p_notes,
    p_actor_user_id
  );
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
  p_notes text,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.update_expense_with_participants(
    p_group_id,
    p_expense_id,
    p_expected_updated_at,
    p_title,
    p_amount_cents,
    p_paid_by_member_id,
    p_participant_ids,
    p_participant_shares,
    'equal',
    null::integer[],
    p_expense_date,
    p_notes,
    p_actor_user_id
  );
end;
$$;

revoke all on function public.create_expense_with_participants(
  uuid, text, bigint, uuid, uuid[], bigint[], date, text, uuid
) from public, anon, authenticated;
grant execute on function public.create_expense_with_participants(
  uuid, text, bigint, uuid, uuid[], bigint[], date, text, uuid
) to service_role;

revoke all on function public.update_expense_with_participants(
  uuid, uuid, timestamptz, text, bigint, uuid, uuid[], bigint[], date, text, uuid
) from public, anon, authenticated;
grant execute on function public.update_expense_with_participants(
  uuid, uuid, timestamptz, text, bigint, uuid, uuid[], bigint[], date, text, uuid
) to service_role;

revoke all on function public.create_expense_with_participants(
  uuid, text, bigint, uuid, uuid[], bigint[], text, integer[], date, text, uuid
) from public, anon, authenticated;
grant execute on function public.create_expense_with_participants(
  uuid, text, bigint, uuid, uuid[], bigint[], text, integer[], date, text, uuid
) to service_role;

revoke all on function public.update_expense_with_participants(
  uuid, uuid, timestamptz, text, bigint, uuid, uuid[], bigint[], text, integer[], date, text, uuid
) from public, anon, authenticated;
grant execute on function public.update_expense_with_participants(
  uuid, uuid, timestamptz, text, bigint, uuid, uuid[], bigint[], text, integer[], date, text, uuid
) to service_role;
