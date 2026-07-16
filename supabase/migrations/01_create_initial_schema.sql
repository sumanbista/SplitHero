create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  share_token text not null,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint groups_name_length_check
    check (char_length(btrim(name)) between 1 and 80),
  constraint groups_share_token_not_blank_check
    check (char_length(btrim(share_token)) > 0),
  constraint groups_share_token_key unique (share_token)
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  name text not null,
  user_id uuid,
  created_at timestamptz not null default now(),

  constraint members_group_id_fkey
    foreign key (group_id) references public.groups (id) on delete cascade,
  constraint members_name_length_check
    check (char_length(btrim(name)) between 1 and 50)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  title text not null,
  amount_cents bigint not null,
  paid_by_member_id uuid not null,
  expense_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expenses_group_id_fkey
    foreign key (group_id) references public.groups (id) on delete cascade,
  constraint expenses_paid_by_member_id_fkey
    foreign key (paid_by_member_id)
      references public.members (id) on delete restrict,
  constraint expenses_title_length_check
    check (char_length(btrim(title)) between 1 and 100),
  constraint expenses_amount_cents_positive_check
    check (amount_cents > 0),
  constraint expenses_notes_length_check
    check (char_length(notes) <= 1000)
);

create table public.expense_participants (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null,
  member_id uuid not null,
  share_cents bigint not null,
  created_at timestamptz not null default now(),

  constraint expense_participants_expense_id_fkey
    foreign key (expense_id)
      references public.expenses (id) on delete cascade,
  constraint expense_participants_member_id_fkey
    foreign key (member_id)
      references public.members (id) on delete restrict,
  constraint expense_participants_share_cents_nonnegative_check
    check (share_cents >= 0),
  constraint expense_participants_expense_id_member_id_key
    unique (expense_id, member_id)
);

create table public.settlement_payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  from_member_id uuid not null,
  to_member_id uuid not null,
  amount_cents bigint not null,
  payment_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),

  constraint settlement_payments_group_id_fkey
    foreign key (group_id) references public.groups (id) on delete cascade,
  constraint settlement_payments_from_member_id_fkey
    foreign key (from_member_id)
      references public.members (id) on delete restrict,
  constraint settlement_payments_to_member_id_fkey
    foreign key (to_member_id)
      references public.members (id) on delete restrict,
  constraint settlement_payments_amount_cents_positive_check
    check (amount_cents > 0),
  constraint settlement_payments_distinct_members_check
    check (from_member_id <> to_member_id),
  constraint settlement_payments_notes_length_check
    check (char_length(notes) <= 1000)
);

create unique index members_group_id_normalized_name_key
  on public.members (group_id, lower(btrim(name)));

create index members_group_id_created_at_idx
  on public.members (group_id, created_at);

create index expenses_group_id_expense_date_created_at_idx
  on public.expenses (group_id, expense_date desc, created_at desc);

create index expenses_paid_by_member_id_idx
  on public.expenses (paid_by_member_id);

create index expense_participants_member_id_idx
  on public.expense_participants (member_id);

create index settlement_payments_group_id_payment_date_created_at_idx
  on public.settlement_payments (
    group_id,
    payment_date desc,
    created_at desc
  );

create index settlement_payments_from_member_id_idx
  on public.settlement_payments (from_member_id);

create index settlement_payments_to_member_id_idx
  on public.settlement_payments (to_member_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger groups_set_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

-- Browser clients have no direct access until explicit policies are added in
-- the later authentication and access-control work.
alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_participants enable row level security;
alter table public.settlement_payments enable row level security;
