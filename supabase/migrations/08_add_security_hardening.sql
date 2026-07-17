-- Server Actions are the only supported mutation boundary. Authenticated
-- browser clients retain RLS-filtered reads (and self-profile updates), but
-- cannot bypass server validation, authorization, auditing, or rate limits.
revoke insert, update, delete on public.groups from authenticated;
revoke update (access_mode) on public.groups from authenticated;
revoke insert, update, delete on public.members from authenticated;
revoke insert, update, delete on public.expenses from authenticated;
revoke insert, update, delete on public.expense_participants from authenticated;
revoke insert, update, delete on public.settlement_payments from authenticated;
revoke insert, update, delete on public.group_memberships from authenticated;
revoke insert, update, delete on public.group_invitations from authenticated;

revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- These tables are private operational data. Browser roles receive no grants;
-- service_role is used only by server-only application modules.
create table public.security_rate_limits (
  action text not null,
  identifier_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null,
  updated_at timestamptz not null default now(),

  constraint security_rate_limits_pkey
    primary key (action, identifier_hash),
  constraint security_rate_limits_action_length_check
    check (char_length(action) between 1 and 80),
  constraint security_rate_limits_identifier_hash_check
    check (identifier_hash ~ '^[a-f0-9]{64}$'),
  constraint security_rate_limits_request_count_check
    check (request_count > 0)
);

create index security_rate_limits_updated_at_idx
  on public.security_rate_limits (updated_at);

alter table public.security_rate_limits enable row level security;
revoke all on table public.security_rate_limits from public, anon, authenticated;

create table public.security_audit_log (
  id bigint generated always as identity primary key,
  event_type text not null,
  outcome text not null,
  actor_user_id uuid,
  group_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint security_audit_log_actor_user_id_fkey
    foreign key (actor_user_id) references auth.users (id) on delete set null,
  constraint security_audit_log_group_id_fkey
    foreign key (group_id) references public.groups (id) on delete set null,
  constraint security_audit_log_event_type_length_check
    check (char_length(event_type) between 1 and 100),
  constraint security_audit_log_outcome_check
    check (outcome in ('allowed', 'denied', 'rate_limited', 'replayed')),
  constraint security_audit_log_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create index security_audit_log_created_at_idx
  on public.security_audit_log (created_at desc);

create index security_audit_log_actor_created_at_idx
  on public.security_audit_log (actor_user_id, created_at desc)
  where actor_user_id is not null;

create index security_audit_log_group_created_at_idx
  on public.security_audit_log (group_id, created_at desc)
  where group_id is not null;

alter table public.security_audit_log enable row level security;
revoke all on table public.security_audit_log from public, anon, authenticated;

create or replace function public.consume_security_rate_limit(
  p_action text,
  p_identifier_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window interval;
  v_record public.security_rate_limits%rowtype;
begin
  if p_action is null or char_length(p_action) not between 1 and 80
    or p_identifier_hash is null
    or p_identifier_hash !~ '^[a-f0-9]{64}$'
    or p_limit is null or p_limit not between 1 and 10000
    or p_window_seconds is null
    or p_window_seconds not between 1 and 604800 then
    raise exception 'invalid_rate_limit_configuration';
  end if;

  v_window := make_interval(secs => p_window_seconds);

  -- Keep operational state bounded without retaining long-lived request
  -- identifiers. The supporting index makes this cleanup incremental.
  delete from public.security_rate_limits
  where updated_at < v_now - interval '8 days';

  insert into public.security_rate_limits (
    action,
    identifier_hash,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_action, p_identifier_hash, v_now, 1, v_now)
  on conflict (action, identifier_hash) do update
  set
    window_started_at = case
      when public.security_rate_limits.window_started_at + v_window <= v_now
        then v_now
      else public.security_rate_limits.window_started_at
    end,
    request_count = case
      when public.security_rate_limits.window_started_at + v_window <= v_now
        then 1
      else public.security_rate_limits.request_count + 1
    end,
    updated_at = v_now
  returning * into v_record;

  allowed := v_record.request_count <= p_limit;
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      1,
      ceil(extract(epoch from (
        v_record.window_started_at + v_window - v_now
      )))::integer
    )
  end;

  return next;
end;
$$;

revoke all on function public.consume_security_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_security_rate_limit(text, text, integer, integer)
  to service_role;

-- Enforce group identity at the database boundary for every relationship that
-- uses caller-supplied UUIDs. This also protects future authenticated clients.
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
  elsif tg_table_name = 'group_memberships' and new.member_id is not null then
    select member.group_id into v_group_id
    from public.members as member
    where member.id = new.member_id;

    if v_group_id is distinct from new.group_id then
      raise exception 'membership_group_mismatch';
    end if;
  elsif tg_table_name = 'group_invitations' and new.invited_member_id is not null then
    select member.group_id into v_group_id
    from public.members as member
    where member.id = new.invited_member_id;

    if v_group_id is distinct from new.group_id then
      raise exception 'invitation_group_mismatch';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_same_group_relationships()
  from public, anon, authenticated;

create trigger expenses_enforce_same_group
before insert or update of group_id, paid_by_member_id on public.expenses
for each row execute function public.enforce_same_group_relationships();

create trigger expense_participants_enforce_same_group
before insert or update of expense_id, member_id on public.expense_participants
for each row execute function public.enforce_same_group_relationships();

create trigger settlement_payments_enforce_same_group
before insert or update of group_id, from_member_id, to_member_id
on public.settlement_payments
for each row execute function public.enforce_same_group_relationships();

create trigger group_memberships_enforce_same_group
before insert or update of group_id, member_id on public.group_memberships
for each row execute function public.enforce_same_group_relationships();

create trigger group_invitations_enforce_same_group
before insert or update of group_id, invited_member_id on public.group_invitations
for each row execute function public.enforce_same_group_relationships();

comment on table public.security_rate_limits is
  'Hashed, server-only identifiers used for atomic sensitive-action throttling.';
comment on table public.security_audit_log is
  'Minimal server-only authorization and invitation security events; no tokens or email addresses.';
