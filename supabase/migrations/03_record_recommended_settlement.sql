create or replace function public.record_recommended_settlement_payment(
  p_group_id uuid,
  p_from_member_id uuid,
  p_to_member_id uuid,
  p_amount_cents bigint
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_sender_balance bigint;
  v_receiver_balance bigint;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Settlement amount must be positive.';
  end if;

  if p_from_member_id = p_to_member_id then
    raise exception 'Settlement members must be different.';
  end if;

  perform 1
  from public.groups
  where id = p_group_id
  for update;

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
  values (
    p_group_id,
    p_from_member_id,
    p_to_member_id,
    p_amount_cents
  )
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

revoke all on function public.record_recommended_settlement_payment(
  uuid, uuid, uuid, bigint
) from public, anon, authenticated;

grant execute on function public.record_recommended_settlement_payment(
  uuid, uuid, uuid, bigint
) to service_role;
