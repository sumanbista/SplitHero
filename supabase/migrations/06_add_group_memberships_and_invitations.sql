create table public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  user_id uuid not null,
  member_id uuid,
  role text not null default 'member',
  created_at timestamptz not null default now(),

  constraint group_memberships_group_id_fkey
    foreign key (group_id) references public.groups (id) on delete cascade,
  constraint group_memberships_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade,
  constraint group_memberships_member_id_fkey
    foreign key (member_id) references public.members (id) on delete restrict,
  constraint group_memberships_role_check
    check (role in ('owner', 'member', 'viewer')),
  constraint group_memberships_group_id_user_id_key
    unique (group_id, user_id)
);

create unique index group_memberships_member_id_key
  on public.group_memberships (member_id)
  where member_id is not null;

create index group_memberships_user_id_created_at_idx
  on public.group_memberships (user_id, created_at desc);

create index group_memberships_group_id_created_at_idx
  on public.group_memberships (group_id, created_at);

create unique index members_group_id_user_id_key
  on public.members (group_id, user_id)
  where user_id is not null;

alter table public.members
  add constraint members_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;

create table public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  email text not null,
  token_hash text not null,
  role text not null default 'member',
  invited_member_id uuid,
  invited_by_user_id uuid not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_by_user_id uuid,
  responded_at timestamptz,
  created_at timestamptz not null default now(),

  constraint group_invitations_group_id_fkey
    foreign key (group_id) references public.groups (id) on delete cascade,
  constraint group_invitations_invited_member_id_fkey
    foreign key (invited_member_id) references public.members (id) on delete restrict,
  constraint group_invitations_invited_by_user_id_fkey
    foreign key (invited_by_user_id) references auth.users (id) on delete cascade,
  constraint group_invitations_accepted_by_user_id_fkey
    foreign key (accepted_by_user_id) references auth.users (id) on delete set null,
  constraint group_invitations_email_normalized_check
    check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  constraint group_invitations_token_hash_key unique (token_hash),
  constraint group_invitations_role_check
    check (role in ('member', 'viewer')),
  constraint group_invitations_status_check
    check (status in ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  constraint group_invitations_expiry_check
    check (expires_at > created_at),
  constraint group_invitations_response_check
    check (
      (status = 'pending' and responded_at is null and accepted_by_user_id is null)
      or (status = 'accepted' and responded_at is not null and accepted_by_user_id is not null)
      or (status in ('declined', 'expired', 'revoked') and responded_at is not null)
    )
);

create unique index group_invitations_group_id_pending_email_key
  on public.group_invitations (group_id, email)
  where status = 'pending';

create unique index group_invitations_invited_member_pending_key
  on public.group_invitations (invited_member_id)
  where invited_member_id is not null and status = 'pending';

create index group_invitations_email_status_expires_at_idx
  on public.group_invitations (email, status, expires_at desc);

create index group_invitations_group_id_created_at_idx
  on public.group_invitations (group_id, created_at desc);

create index group_invitations_invited_member_id_idx
  on public.group_invitations (invited_member_id)
  where invited_member_id is not null;

create index group_invitations_invited_by_user_id_idx
  on public.group_invitations (invited_by_user_id);

create index group_invitations_accepted_by_user_id_idx
  on public.group_invitations (accepted_by_user_id)
  where accepted_by_user_id is not null;

alter table public.group_memberships enable row level security;
alter table public.group_invitations enable row level security;

insert into public.group_memberships (group_id, user_id, role)
select id, created_by_user_id, 'owner'
from public.groups
where created_by_user_id is not null
on conflict (group_id, user_id) do update set role = 'owner';

create or replace function public.create_owner_group_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by_user_id is not null then
    insert into public.group_memberships (group_id, user_id, role)
    values (new.id, new.created_by_user_id, 'owner')
    on conflict (group_id, user_id) do update set role = 'owner';
  end if;

  return new;
end;
$$;

revoke all on function public.create_owner_group_membership()
  from public, anon, authenticated;

create trigger groups_create_owner_membership
after insert on public.groups
for each row execute function public.create_owner_group_membership();

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

  return query
    select groups.share_token from public.groups as groups
    where groups.id = invitation.group_id;
end;
$$;

revoke all on function public.accept_group_invitation(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.accept_group_invitation(uuid, uuid, text)
  to service_role;

comment on table public.group_memberships is
  'Authenticated account access records; separate from expense participants.';
comment on column public.group_memberships.member_id is
  'Optional link to the existing expense participant whose history belongs to this account.';
comment on column public.group_invitations.token_hash is
  'SHA-256 digest of the invitation secret; the raw token is never stored.';
