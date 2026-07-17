alter table public.groups
  add column access_mode text not null default 'public',
  add constraint groups_access_mode_check
    check (access_mode in ('public', 'private'));

comment on column public.groups.access_mode is
  'Public groups keep unlisted-link access; private groups require an authenticated membership.';

create or replace function public.current_group_role(p_group_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select membership.role
  from public.group_memberships as membership
  where membership.group_id = p_group_id
    and membership.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.can_view_private_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_group_role(p_group_id) is not null;
$$;

create or replace function public.can_contribute_to_private_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_group_role(p_group_id) in ('owner', 'member');
$$;

create or replace function public.owns_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_group_role(p_group_id) = 'owner';
$$;

revoke all on function public.current_group_role(uuid)
  from public, anon;
revoke all on function public.can_view_private_group(uuid)
  from public, anon;
revoke all on function public.can_contribute_to_private_group(uuid)
  from public, anon;
revoke all on function public.owns_group(uuid)
  from public, anon;

grant execute on function public.current_group_role(uuid) to authenticated;
grant execute on function public.can_view_private_group(uuid) to authenticated;
grant execute on function public.can_contribute_to_private_group(uuid) to authenticated;
grant execute on function public.owns_group(uuid) to authenticated;

-- Public share links are resolved and validated by the Next.js server. They do
-- not receive direct PostgREST access because a table-wide public RLS policy
-- would make unlisted groups enumerable without their share token.
revoke all on table
  public.groups,
  public.members,
  public.expenses,
  public.expense_participants,
  public.settlement_payments,
  public.profiles,
  public.group_memberships,
  public.group_invitations
from anon;

grant select, insert on public.groups to authenticated;
grant update (access_mode) on public.groups to authenticated;
grant select, insert, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.expense_participants to authenticated;
grant select, insert, update, delete on public.settlement_payments to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.group_memberships to authenticated;
grant select, insert, update, delete on public.group_invitations to authenticated;

create policy groups_authenticated_select
on public.groups for select to authenticated
using ((select public.can_view_private_group(id)));

create policy groups_authenticated_insert
on public.groups for insert to authenticated
with check (created_by_user_id = (select auth.uid()));

create policy groups_owner_update
on public.groups for update to authenticated
using ((select public.owns_group(id)))
with check ((select public.owns_group(id)));

create policy members_authenticated_select
on public.members for select to authenticated
using ((select public.can_view_private_group(group_id)));

create policy members_owner_insert
on public.members for insert to authenticated
with check ((select public.owns_group(group_id)));

create policy members_owner_update
on public.members for update to authenticated
using ((select public.owns_group(group_id)))
with check ((select public.owns_group(group_id)));

create policy members_owner_delete
on public.members for delete to authenticated
using ((select public.owns_group(group_id)));

create policy expenses_authenticated_select
on public.expenses for select to authenticated
using ((select public.can_view_private_group(group_id)));

create policy expenses_contributor_insert
on public.expenses for insert to authenticated
with check ((select public.can_contribute_to_private_group(group_id)));

create policy expenses_contributor_update
on public.expenses for update to authenticated
using ((select public.can_contribute_to_private_group(group_id)))
with check ((select public.can_contribute_to_private_group(group_id)));

create policy expenses_contributor_delete
on public.expenses for delete to authenticated
using ((select public.can_contribute_to_private_group(group_id)));

create policy expense_participants_authenticated_select
on public.expense_participants for select to authenticated
using (
  exists (
    select 1 from public.expenses as expense
    where expense.id = expense_id
      and (select public.can_view_private_group(expense.group_id))
  )
);

create policy expense_participants_contributor_insert
on public.expense_participants for insert to authenticated
with check (
  exists (
    select 1 from public.expenses as expense
    where expense.id = expense_id
      and (select public.can_contribute_to_private_group(expense.group_id))
  )
);

create policy expense_participants_contributor_update
on public.expense_participants for update to authenticated
using (
  exists (
    select 1 from public.expenses as expense
    where expense.id = expense_id
      and (select public.can_contribute_to_private_group(expense.group_id))
  )
)
with check (
  exists (
    select 1 from public.expenses as expense
    where expense.id = expense_id
      and (select public.can_contribute_to_private_group(expense.group_id))
  )
);

create policy expense_participants_contributor_delete
on public.expense_participants for delete to authenticated
using (
  exists (
    select 1 from public.expenses as expense
    where expense.id = expense_id
      and (select public.can_contribute_to_private_group(expense.group_id))
  )
);

create policy settlement_payments_authenticated_select
on public.settlement_payments for select to authenticated
using ((select public.can_view_private_group(group_id)));

create policy settlement_payments_contributor_insert
on public.settlement_payments for insert to authenticated
with check ((select public.can_contribute_to_private_group(group_id)));

create policy settlement_payments_contributor_update
on public.settlement_payments for update to authenticated
using ((select public.can_contribute_to_private_group(group_id)))
with check ((select public.can_contribute_to_private_group(group_id)));

create policy settlement_payments_contributor_delete
on public.settlement_payments for delete to authenticated
using ((select public.can_contribute_to_private_group(group_id)));

create policy group_memberships_member_select
on public.group_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.owns_group(group_id))
);

create policy group_memberships_owner_insert
on public.group_memberships for insert to authenticated
with check (
  (select public.owns_group(group_id))
  and role in ('member', 'viewer')
);

create policy group_memberships_owner_update
on public.group_memberships for update to authenticated
using (
  (select public.owns_group(group_id))
  and role <> 'owner'
)
with check (
  (select public.owns_group(group_id))
  and role in ('member', 'viewer')
);

create policy group_memberships_owner_delete
on public.group_memberships for delete to authenticated
using (
  (select public.owns_group(group_id))
  and role <> 'owner'
);

create policy group_invitations_owner_select
on public.group_invitations for select to authenticated
using ((select public.owns_group(group_id)));

create policy group_invitations_owner_insert
on public.group_invitations for insert to authenticated
with check (
  (select public.owns_group(group_id))
  and invited_by_user_id = (select auth.uid())
);

create policy group_invitations_owner_update
on public.group_invitations for update to authenticated
using ((select public.owns_group(group_id)))
with check ((select public.owns_group(group_id)));

create policy group_invitations_owner_delete
on public.group_invitations for delete to authenticated
using ((select public.owns_group(group_id)));

create policy profiles_account_select
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy profiles_account_update
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));
