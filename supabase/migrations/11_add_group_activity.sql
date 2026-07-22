create table public.group_activity_events (
  id bigint generated always as identity primary key,
  group_id uuid not null,
  actor_user_id uuid,
  actor_member_id uuid,
  actor_name_snapshot text not null,
  event_type text not null,
  subject_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint group_activity_events_group_id_fkey
    foreign key (group_id) references public.groups (id) on delete cascade,
  constraint group_activity_events_actor_user_id_fkey
    foreign key (actor_user_id) references auth.users (id) on delete set null,
  constraint group_activity_events_actor_member_id_fkey
    foreign key (actor_member_id) references public.members (id) on delete set null,
  constraint group_activity_events_actor_name_length_check
    check (char_length(btrim(actor_name_snapshot)) between 1 and 80),
  constraint group_activity_events_event_type_check
    check (event_type in (
      'group.created',
      'group.renamed',
      'group.access_changed',
      'member.added',
      'expense.created',
      'expense.updated',
      'expense.deleted',
      'settlement.recorded',
      'invitation.sent',
      'invitation.accepted',
      'invitation.declined'
    )),
  constraint group_activity_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create index group_activity_events_group_created_at_idx
  on public.group_activity_events (group_id, created_at desc, id desc);

create index group_activity_events_actor_user_created_at_idx
  on public.group_activity_events (actor_user_id, created_at desc)
  where actor_user_id is not null;

alter table public.group_activity_events enable row level security;
revoke all on table public.group_activity_events from public, anon, authenticated;

comment on table public.group_activity_events is
  'Append-only, group-visible product activity. Free-form notes, invitation emails, tokens, and network identifiers are intentionally excluded.';

create or replace function public.prevent_group_activity_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Preserve normal group deletion: the parent row is already absent when its
  -- cascading activity deletes run. All direct edits and deletes are rejected.
  if tg_op = 'DELETE' and not exists (
    select 1 from public.groups where id = old.group_id
  ) then
    return old;
  end if;

  raise exception 'group_activity_is_append_only';
end;
$$;

revoke all on function public.prevent_group_activity_mutation()
  from public, anon, authenticated;

create trigger group_activity_events_prevent_mutation
before update or delete on public.group_activity_events
for each row execute function public.prevent_group_activity_mutation();

create or replace function public.record_group_activity(
  p_group_id uuid,
  p_actor_user_id uuid,
  p_event_type text,
  p_subject_id uuid,
  p_metadata jsonb
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_actor_member_id uuid;
  v_actor_name text;
  v_event_id bigint;
begin
  if p_actor_user_id is null then
    v_actor_name := 'A guest using the shared link';
  else
    select
      member.id,
      coalesce(
        nullif(btrim(profile.display_name), ''),
        nullif(btrim(member.name), '')
      )
    into v_actor_member_id, v_actor_name
    from public.members as member
    left join public.profiles as profile on profile.id = member.user_id
    where member.group_id = p_group_id and member.user_id = p_actor_user_id
    limit 1;

    if v_actor_name is null then
      select nullif(btrim(profile.display_name), '')
      into v_actor_name
      from public.profiles as profile
      where profile.id = p_actor_user_id;
    end if;

    v_actor_name := coalesce(v_actor_name, 'A group member');
  end if;

  insert into public.group_activity_events (
    group_id,
    actor_user_id,
    actor_member_id,
    actor_name_snapshot,
    event_type,
    subject_id,
    metadata
  )
  values (
    p_group_id,
    p_actor_user_id,
    v_actor_member_id,
    left(v_actor_name, 80),
    p_event_type,
    p_subject_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.record_group_activity(uuid, uuid, text, uuid, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.record_group_created_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.record_group_activity(
    new.id,
    new.created_by_user_id,
    'group.created',
    new.id,
    jsonb_build_object('groupName', new.name)
  );
  return new;
end;
$$;

revoke all on function public.record_group_created_activity()
  from public, anon, authenticated;

create trigger groups_record_created_activity
after insert on public.groups
for each row execute function public.record_group_created_activity();

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
  v_previous_access_mode text;
begin
  if p_access_mode not in ('public', 'private') then
    raise exception 'invalid_access_mode';
  end if;

  select access_mode
  into v_previous_access_mode
  from public.groups
  where id = p_group_id
  for update;

  if not found then
    return 'missing';
  end if;

  if v_previous_access_mode = p_access_mode then
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
      'previousAccessMode', v_previous_access_mode,
      'accessMode', p_access_mode
    )
  );

  return 'updated';
end;
$$;

create or replace function public.create_member_with_activity(
  p_group_id uuid,
  p_name text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  perform 1 from public.groups where id = p_group_id for update;
  if not found then
    raise exception 'group_not_available';
  end if;

  insert into public.members (group_id, name)
  values (p_group_id, btrim(p_name))
  returning id into v_member_id;

  perform public.record_group_activity(
    p_group_id,
    p_actor_user_id,
    'member.added',
    v_member_id,
    jsonb_build_object('memberName', btrim(p_name))
  );

  return v_member_id;
end;
$$;

create or replace function public.create_group_invitation_with_activity(
  p_group_id uuid,
  p_email text,
  p_token_hash text,
  p_role text,
  p_invited_member_id uuid,
  p_invited_by_user_id uuid,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation_id uuid;
  v_member_name text;
begin
  perform 1 from public.groups where id = p_group_id for update;
  if not found then
    raise exception 'group_not_available';
  end if;

  update public.group_invitations
  set status = 'expired', responded_at = now()
  where group_id = p_group_id
    and email = lower(btrim(p_email))
    and status = 'pending'
    and expires_at <= now();

  if p_invited_member_id is not null then
    select name into v_member_name
    from public.members
    where id = p_invited_member_id and group_id = p_group_id and user_id is null;

    if not found then
      raise exception 'invited_member_unavailable';
    end if;
  end if;

  insert into public.group_invitations (
    group_id,
    email,
    token_hash,
    role,
    invited_member_id,
    invited_by_user_id,
    expires_at
  )
  values (
    p_group_id,
    lower(btrim(p_email)),
    p_token_hash,
    p_role,
    p_invited_member_id,
    p_invited_by_user_id,
    p_expires_at
  )
  returning id into v_invitation_id;

  perform public.record_group_activity(
    p_group_id,
    p_invited_by_user_id,
    'invitation.sent',
    v_invitation_id,
    jsonb_strip_nulls(jsonb_build_object(
      'role', p_role,
      'linkedMemberName', v_member_name
    ))
  );

  return v_invitation_id;
end;
$$;

create or replace function public.decline_group_invitation_with_activity(
  p_invitation_id uuid,
  p_user_id uuid,
  p_email text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.group_invitations%rowtype;
begin
  select * into v_invitation
  from public.group_invitations
  where id = p_invitation_id
  for update;

  if not found
    or v_invitation.email <> lower(btrim(p_email))
    or v_invitation.status <> 'pending' then
    return false;
  end if;

  update public.group_invitations
  set status = 'declined', responded_at = now()
  where id = v_invitation.id;

  perform public.record_group_activity(
    v_invitation.group_id,
    p_user_id,
    'invitation.declined',
    v_invitation.id,
    jsonb_build_object('role', v_invitation.role)
  );

  return true;
end;
$$;

revoke all on function public.update_group_access_with_activity(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.update_group_access_with_activity(uuid, text, uuid)
  to service_role;

revoke all on function public.create_member_with_activity(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_member_with_activity(uuid, text, uuid)
  to service_role;

revoke all on function public.create_group_invitation_with_activity(
  uuid, text, text, text, uuid, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.create_group_invitation_with_activity(
  uuid, text, text, text, uuid, uuid, timestamptz
) to service_role;

revoke all on function public.decline_group_invitation_with_activity(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.decline_group_invitation_with_activity(uuid, uuid, text)
  to service_role;

create or replace function public.accept_group_invitation(
  p_invitation_id uuid,
  p_user_id uuid,
  p_email text
)
returns table (share_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.group_invitations%rowtype;
  existing_membership public.group_memberships%rowtype;
begin
  select * into invitation
  from public.group_invitations
  where id = p_invitation_id
  for update;

  if not found or invitation.email <> lower(btrim(p_email)) then
    raise exception 'invitation_not_available';
  end if;

  if invitation.status = 'accepted'
    and invitation.accepted_by_user_id = p_user_id then
    return query
      select groups.share_token from public.groups as groups
      where groups.id = invitation.group_id;
    return;
  end if;

  if invitation.status <> 'pending' then
    raise exception 'invitation_not_pending';
  end if;

  if invitation.expires_at <= now() then
    update public.group_invitations
    set status = 'expired', responded_at = now()
    where id = invitation.id;
    return;
  end if;

  if invitation.invited_member_id is not null then
    update public.members
    set user_id = p_user_id
    where id = invitation.invited_member_id
      and group_id = invitation.group_id
      and (user_id is null or user_id = p_user_id);

    if not found then
      raise exception 'invited_member_unavailable';
    end if;
  end if;

  select * into existing_membership
  from public.group_memberships
  where group_id = invitation.group_id and user_id = p_user_id
  for update;

  if found then
    if existing_membership.member_id is not null
      and invitation.invited_member_id is not null
      and existing_membership.member_id <> invitation.invited_member_id then
      raise exception 'membership_already_linked';
    end if;

    update public.group_memberships
    set member_id = coalesce(member_id, invitation.invited_member_id)
    where id = existing_membership.id;
  else
    insert into public.group_memberships (group_id, user_id, member_id, role)
    values (
      invitation.group_id,
      p_user_id,
      invitation.invited_member_id,
      invitation.role
    );
  end if;

  update public.group_invitations
  set
    status = 'accepted',
    accepted_by_user_id = p_user_id,
    responded_at = now()
  where id = invitation.id;

  perform public.record_group_activity(
    invitation.group_id,
    p_user_id,
    'invitation.accepted',
    invitation.id,
    jsonb_build_object('role', invitation.role)
  );

  return query
    select groups.share_token from public.groups as groups
    where groups.id = invitation.group_id;
end;
$$;

create or replace function public.record_recommended_settlement_payment(
  p_group_id uuid,
  p_from_member_id uuid,
  p_to_member_id uuid,
  p_amount_cents bigint,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_sender_balance bigint;
  v_receiver_balance bigint;
  v_from_member_name text;
  v_to_member_name text;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Settlement amount must be positive.';
  end if;

  if p_from_member_id = p_to_member_id then
    raise exception 'Settlement members must be different.';
  end if;

  perform 1 from public.groups where id = p_group_id for update;
  if not found then
    raise exception 'Group does not exist.';
  end if;

  if (
    select count(*)
    from public.members
    where group_id = p_group_id
      and id in (p_from_member_id, p_to_member_id)
  ) <> 2 then
    raise exception 'Settlement members must belong to the group.';
  end if;

  with member_balances as (
    select
      member.id,
      coalesce(paid.total_cents, 0)
        - coalesce(shared.total_cents, 0)
        + coalesce(sent.total_cents, 0)
        - coalesce(received.total_cents, 0) as balance_cents
    from public.members as member
    left join (
      select paid_by_member_id as member_id, sum(amount_cents) as total_cents
      from public.expenses
      where group_id = p_group_id
      group by paid_by_member_id
    ) as paid on paid.member_id = member.id
    left join (
      select participant.member_id, sum(participant.share_cents) as total_cents
      from public.expense_participants as participant
      join public.expenses as expense on expense.id = participant.expense_id
      where expense.group_id = p_group_id
      group by participant.member_id
    ) as shared on shared.member_id = member.id
    left join (
      select from_member_id as member_id, sum(amount_cents) as total_cents
      from public.settlement_payments
      where group_id = p_group_id
      group by from_member_id
    ) as sent on sent.member_id = member.id
    left join (
      select to_member_id as member_id, sum(amount_cents) as total_cents
      from public.settlement_payments
      where group_id = p_group_id
      group by to_member_id
    ) as received on received.member_id = member.id
    where member.group_id = p_group_id
  )
  select
    max(balance_cents) filter (where id = p_from_member_id),
    max(balance_cents) filter (where id = p_to_member_id)
  into v_sender_balance, v_receiver_balance
  from member_balances;

  if v_sender_balance >= 0 or v_receiver_balance <= 0 then
    raise exception 'Settlement direction no longer matches current balances.';
  end if;

  if p_amount_cents > least(-v_sender_balance, v_receiver_balance) then
    raise exception 'Settlement exceeds the current outstanding amount.';
  end if;

  insert into public.settlement_payments (
    group_id,
    from_member_id,
    to_member_id,
    amount_cents
  )
  values (p_group_id, p_from_member_id, p_to_member_id, p_amount_cents)
  returning id into v_payment_id;

  select name into v_from_member_name
  from public.members where id = p_from_member_id;
  select name into v_to_member_name
  from public.members where id = p_to_member_id;

  perform public.record_group_activity(
    p_group_id,
    p_actor_user_id,
    'settlement.recorded',
    v_payment_id,
    jsonb_build_object(
      'fromMemberName', v_from_member_name,
      'toMemberName', v_to_member_name,
      'amountCents', p_amount_cents
    )
  );

  return v_payment_id;
end;
$$;

revoke all on function public.record_recommended_settlement_payment(
  uuid, uuid, uuid, bigint
) from service_role;
revoke all on function public.record_recommended_settlement_payment(
  uuid, uuid, uuid, bigint, uuid
) from public, anon, authenticated;
grant execute on function public.record_recommended_settlement_payment(
  uuid, uuid, uuid, bigint, uuid
) to service_role;

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
declare
  v_expense_id uuid;
begin
  v_expense_id := public.create_expense_with_participants(
    p_group_id,
    p_title,
    p_amount_cents,
    p_paid_by_member_id,
    p_participant_ids,
    p_participant_shares,
    p_expense_date,
    p_notes
  );

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
  v_new_participant_ids uuid[];
  v_previous_payer_name text;
  v_new_payer_name text;
  v_new_date date := coalesce(p_expense_date, current_date);
  v_new_notes text := nullif(btrim(p_notes), '');
  v_changes text[] := array[]::text[];
  v_result text;
begin
  select * into v_previous
  from public.expenses
  where id = p_expense_id and group_id = p_group_id;

  select coalesce(array_agg(member_id order by member_id), array[]::uuid[])
  into v_previous_participant_ids
  from public.expense_participants
  where expense_id = p_expense_id;

  select coalesce(array_agg(member_id order by member_id), array[]::uuid[])
  into v_new_participant_ids
  from unnest(p_participant_ids) as participant(member_id);

  v_result := public.update_expense_with_participants(
    p_group_id,
    p_expense_id,
    p_expected_updated_at,
    p_title,
    p_amount_cents,
    p_paid_by_member_id,
    p_participant_ids,
    p_participant_shares,
    p_expense_date,
    p_notes
  );

  if v_result <> 'updated' then
    return v_result;
  end if;

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
  end if;
  if v_previous.expense_date is distinct from v_new_date then
    v_changes := array_append(v_changes, 'date');
  end if;
  if v_previous.notes is distinct from v_new_notes then
    v_changes := array_append(v_changes, 'notes');
  end if;

  if cardinality(v_changes) = 0 then
    return v_result;
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

  return v_result;
end;
$$;

create or replace function public.delete_expense(
  p_group_id uuid,
  p_expense_id uuid,
  p_expected_updated_at timestamptz,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense public.expenses%rowtype;
  v_result text;
begin
  select * into v_expense
  from public.expenses
  where id = p_expense_id and group_id = p_group_id;

  v_result := public.delete_expense(
    p_group_id,
    p_expense_id,
    p_expected_updated_at
  );

  if v_result = 'deleted' then
    perform public.record_group_activity(
      p_group_id,
      p_actor_user_id,
      'expense.deleted',
      p_expense_id,
      jsonb_build_object(
        'title', v_expense.title,
        'amountCents', v_expense.amount_cents
      )
    );
  end if;

  return v_result;
end;
$$;

revoke all on function public.create_expense_with_participants(
  uuid, text, bigint, uuid, uuid[], bigint[], date, text
) from service_role;
revoke all on function public.update_expense_with_participants(
  uuid, uuid, timestamptz, text, bigint, uuid, uuid[], bigint[], date, text
) from service_role;
revoke all on function public.delete_expense(uuid, uuid, timestamptz)
  from service_role;

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

revoke all on function public.delete_expense(uuid, uuid, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_expense(uuid, uuid, timestamptz, uuid)
  to service_role;
