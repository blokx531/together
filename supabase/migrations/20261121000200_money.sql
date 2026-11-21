-- Money: expenses with exact splits, settlements, balances and an audit trail.
--
-- Invariants (enforced here, independent of any client):
--   * Amounts are integer paise, 1 paisa to ₹10 crore, currency INR only (no implicit FX in v1).
--   * The splits of an expense sum exactly to its amount (deferred constraint trigger, checked at commit).
--   * Payer and every split participant are members of the expense's household.
--   * A personal expense is paid by its creator and allocated 100% to them, so it never affects balances.
--     Only personal expenses may be private; anything involving the partner is household-visible.
--   * Expenses and settlements are voided, never deleted; every change to an expense is recorded.
--   * Creating an expense or settlement is idempotent per client_request_id (double taps, retries).

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references public.profiles (user_id),
  payer_user_id uuid not null references public.profiles (user_id),
  scope text not null check (scope in ('personal', 'shared')),
  visibility text not null check (visibility in ('private', 'household')),
  split_method text not null
    check (split_method in ('personal', 'equal', 'exact', 'percent', 'payer_only', 'other_only')),
  amount_paise bigint not null check (amount_paise between 1 and 10000000000),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  category text not null check (category in (
    'groceries', 'restaurants', 'travel', 'rent', 'shopping', 'subscriptions',
    'transport', 'entertainment', 'bills', 'health', 'miscellaneous'
  )),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  note text check (char_length(note) <= 500),
  spent_on date not null check (spent_on between date '2000-01-01' and date '2100-01-01'),
  client_request_id uuid not null unique,
  version integer not null default 1,
  voided_at timestamptz,
  voided_by uuid references public.profiles (user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_shared_is_household_visible check (scope = 'personal' or visibility = 'household'),
  constraint expenses_personal_method check ((scope = 'personal') = (split_method = 'personal')),
  constraint expenses_void_consistency check (voided_at is not null or voided_by is null)
);

create index expenses_household_spent_on_idx on public.expenses (household_id, spent_on desc);

create table public.expense_splits (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id),
  share_paise bigint not null check (share_paise >= 0),
  -- Only for split_method = 'percent': the share the user entered, in basis points (1% = 100).
  percent_basis_points integer check (percent_basis_points between 0 and 10000),
  primary key (expense_id, user_id)
);

create index expense_splits_user_idx on public.expense_splits (user_id);

create table public.expense_revisions (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  changed_by uuid references public.profiles (user_id) on delete set null,
  change text not null check (change in ('update', 'void', 'restore')),
  -- The expense row and its splits as they were before the change.
  previous jsonb not null,
  created_at timestamptz not null default now()
);

create index expense_revisions_expense_idx on public.expense_revisions (expense_id, created_at desc);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references public.profiles (user_id),
  from_user_id uuid not null references public.profiles (user_id),
  to_user_id uuid not null references public.profiles (user_id),
  amount_paise bigint not null check (amount_paise between 1 and 10000000000),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  settled_on date not null check (settled_on between date '2000-01-01' and date '2100-01-01'),
  note text check (char_length(note) <= 500),
  client_request_id uuid not null unique,
  voided_at timestamptz,
  voided_by uuid references public.profiles (user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlements_distinct_people check (from_user_id <> to_user_id),
  constraint settlements_void_consistency check (voided_at is not null or voided_by is null)
);

create index settlements_household_settled_on_idx on public.settlements (household_id, settled_on desc);

-- ---------------------------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------------------------

create function private.is_member_of(target_household_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = target_user_id
  );
$$;

revoke all on function private.is_member_of(uuid, uuid) from public;

create function private.check_expense_integrity(target_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expense public.expenses%rowtype;
  split_total bigint;
  split_count integer;
begin
  select * into expense from public.expenses where id = target_expense_id;
  if not found then
    return; -- removed together with its household
  end if;

  select coalesce(sum(share_paise), 0), count(*) into split_total, split_count
    from public.expense_splits where expense_id = target_expense_id;

  if split_total <> expense.amount_paise then
    raise exception 'SPLITS_DO_NOT_SUM' using errcode = 'P0001';
  end if;
  if not private.is_member_of(expense.household_id, expense.payer_user_id) then
    raise exception 'PAYER_NOT_MEMBER' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.expense_splits s
    where s.expense_id = target_expense_id and not private.is_member_of(expense.household_id, s.user_id)
  ) then
    raise exception 'SPLIT_USER_NOT_MEMBER' using errcode = 'P0001';
  end if;
  if expense.scope = 'personal' and (
    expense.payer_user_id <> expense.created_by
    or split_count <> 1
    or not exists (
      select 1 from public.expense_splits s
      where s.expense_id = target_expense_id and s.user_id = expense.payer_user_id
    )
  ) then
    raise exception 'PERSONAL_EXPENSE_INVALID' using errcode = 'P0001';
  end if;
end;
$$;

create function private.expenses_integrity_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_expense_integrity(new.id);
  return null;
end;
$$;

create function private.expense_splits_integrity_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_expense_integrity(coalesce(new.expense_id, old.expense_id));
  return null;
end;
$$;

create constraint trigger expenses_integrity
  after insert or update on public.expenses
  deferrable initially deferred
  for each row execute function private.expenses_integrity_trigger();

create constraint trigger expense_splits_integrity
  after insert or update or delete on public.expense_splits
  deferrable initially deferred
  for each row execute function private.expense_splits_integrity_trigger();

-- Versioning, void attribution and the audit trail.
create function private.expenses_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  if old.voided_at is null and new.voided_at is not null then
    new.voided_by := auth.uid();
  elsif new.voided_at is null then
    new.voided_by := null;
  else
    new.voided_by := old.voided_by;
  end if;
  return new;
end;
$$;

create trigger expenses_before_update before update on public.expenses
  for each row execute function private.expenses_before_update();

create function private.expenses_record_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.expense_revisions (expense_id, changed_by, change, previous)
  values (
    old.id,
    auth.uid(),
    case
      when old.voided_at is null and new.voided_at is not null then 'void'
      when old.voided_at is not null and new.voided_at is null then 'restore'
      else 'update'
    end,
    jsonb_build_object(
      'expense', to_jsonb(old),
      'splits', coalesce(
        (select jsonb_agg(to_jsonb(s) order by s.user_id) from public.expense_splits s where s.expense_id = old.id),
        '[]'::jsonb
      )
    )
  );
  return null;
end;
$$;

create trigger expenses_record_revision after update on public.expenses
  for each row execute function private.expenses_record_revision();

create function private.settlements_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_member_of(new.household_id, new.from_user_id)
     or not private.is_member_of(new.household_id, new.to_user_id) then
    raise exception 'SETTLEMENT_USER_NOT_MEMBER' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    if old.voided_at is null and new.voided_at is not null then
      new.voided_by := auth.uid();
    elsif new.voided_at is null then
      new.voided_by := null;
    else
      new.voided_by := old.voided_by;
    end if;
  end if;
  return new;
end;
$$;

create trigger settlements_guard before insert or update on public.settlements
  for each row execute function private.settlements_guard();

revoke all on function private.check_expense_integrity(uuid) from public;
revoke all on function private.expenses_integrity_trigger() from public;
revoke all on function private.expense_splits_integrity_trigger() from public;
revoke all on function private.expenses_record_revision() from public;
revoke all on function private.settlements_guard() from public;

-- ---------------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------------

alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.expense_revisions enable row level security;
alter table public.settlements enable row level security;

grant select on public.expenses to authenticated;
grant insert (
  household_id, created_by, payer_user_id, scope, visibility, split_method, amount_paise,
  category, title, note, spent_on, client_request_id
) on public.expenses to authenticated;
grant update (
  payer_user_id, scope, visibility, split_method, amount_paise, category, title, note, spent_on, voided_at
) on public.expenses to authenticated;

create policy "expenses: members read household-visible and own private" on public.expenses
  for select to authenticated
  using (
    private.is_household_member(household_id)
    and (visibility = 'household' or created_by = (select auth.uid()))
  );

create policy "expenses: members create as themselves" on public.expenses
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.is_household_member(household_id)
  );

-- Shared expenses can be corrected by either partner; personal ones only by their creator.
create policy "expenses: edit shared or own" on public.expenses
  for update to authenticated
  using (
    private.is_household_member(household_id)
    and (scope = 'shared' or created_by = (select auth.uid()))
  )
  with check (
    private.is_household_member(household_id)
    and (scope = 'shared' or created_by = (select auth.uid()))
  );

grant select, insert, delete on public.expense_splits to authenticated;

create policy "expense_splits: follow the expense" on public.expense_splits
  for select to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id));

create policy "expense_splits: add to editable expense" on public.expense_splits
  for insert to authenticated
  with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and (e.scope = 'shared' or e.created_by = (select auth.uid()))
    )
  );

create policy "expense_splits: remove from editable expense" on public.expense_splits
  for delete to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and (e.scope = 'shared' or e.created_by = (select auth.uid()))
    )
  );

grant select on public.expense_revisions to authenticated;

create policy "expense_revisions: follow the expense" on public.expense_revisions
  for select to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id));

grant select on public.settlements to authenticated;
grant insert (household_id, created_by, from_user_id, to_user_id, amount_paise, settled_on, note, client_request_id)
  on public.settlements to authenticated;
grant update (voided_at) on public.settlements to authenticated;

create policy "settlements: members read" on public.settlements
  for select to authenticated
  using (private.is_household_member(household_id));

create policy "settlements: members record as themselves" on public.settlements
  for insert to authenticated
  with check (created_by = (select auth.uid()) and private.is_household_member(household_id));

create policy "settlements: members void" on public.settlements
  for update to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

-- ---------------------------------------------------------------------------------------------
-- RPCs (SECURITY INVOKER: every statement still passes the RLS policies above)
-- ---------------------------------------------------------------------------------------------

-- Explains why an update matched no row: not visible, not editable by the caller, or changed since
-- the caller loaded it (optimistic concurrency via `version`).
create function private.raise_expense_write_failure(target_expense_id uuid)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  expense public.expenses%rowtype;
begin
  select * into expense from public.expenses where id = target_expense_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if expense.scope = 'personal' and expense.created_by <> auth.uid() then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  raise exception 'STALE_EXPENSE' using errcode = 'P0001';
end;
$$;

revoke all on function private.raise_expense_write_failure(uuid) from public;
grant execute on function private.raise_expense_write_failure(uuid) to authenticated;

-- Creates (p_expense_id omitted) or updates an expense and replaces its splits in one transaction.
-- p_splits: [{"user_id": uuid, "share_paise": int, "percent_basis_points": int|null}, ...]
create function public.save_expense(
  p_client_request_id uuid,
  p_payer_user_id uuid,
  p_scope text,
  p_visibility text,
  p_split_method text,
  p_amount_paise bigint,
  p_category text,
  p_title text,
  p_note text,
  p_spent_on date,
  p_splits jsonb,
  p_expense_id uuid default null,
  p_expected_version integer default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_household uuid := private.current_household_id();
  saved_id uuid;
begin
  if caller is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if caller_household is null then
    raise exception 'NOT_IN_HOUSEHOLD' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_splits) is distinct from 'array' or jsonb_array_length(p_splits) = 0 then
    raise exception 'SPLITS_REQUIRED' using errcode = 'P0001';
  end if;

  if p_expense_id is null then
    select id into saved_id from public.expenses where client_request_id = p_client_request_id;
    if saved_id is not null then
      return saved_id; -- duplicate submission: already saved
    end if;
    begin
      insert into public.expenses (
        household_id, created_by, payer_user_id, scope, visibility, split_method, amount_paise,
        category, title, note, spent_on, client_request_id
      ) values (
        caller_household, caller, p_payer_user_id, p_scope, p_visibility, p_split_method, p_amount_paise,
        p_category, btrim(p_title), nullif(btrim(coalesce(p_note, '')), ''), p_spent_on, p_client_request_id
      )
      returning id into saved_id;
    exception when unique_violation then
      select id into saved_id from public.expenses where client_request_id = p_client_request_id;
      if saved_id is null then
        raise;
      end if;
      return saved_id; -- a concurrent duplicate won the race
    end;
  else
    update public.expenses set
      payer_user_id = p_payer_user_id,
      scope = p_scope,
      visibility = p_visibility,
      split_method = p_split_method,
      amount_paise = p_amount_paise,
      category = p_category,
      title = btrim(p_title),
      note = nullif(btrim(coalesce(p_note, '')), ''),
      spent_on = p_spent_on
    where id = p_expense_id and version = p_expected_version and voided_at is null
    returning id into saved_id;

    if saved_id is null then
      perform private.raise_expense_write_failure(p_expense_id);
    end if;
    delete from public.expense_splits where expense_id = saved_id;
  end if;

  insert into public.expense_splits (expense_id, user_id, share_paise, percent_basis_points)
  select saved_id, (s ->> 'user_id')::uuid, (s ->> 'share_paise')::bigint, (s ->> 'percent_basis_points')::integer
  from jsonb_array_elements(p_splits) as s;

  return saved_id;
end;
$$;

create function public.set_expense_voided(p_expense_id uuid, p_expected_version integer, p_voided boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.expenses
    set voided_at = case when p_voided then now() else null end
    where id = p_expense_id
      and version = p_expected_version
      and (voided_at is null) = p_voided;
  if not found then
    perform private.raise_expense_write_failure(p_expense_id);
  end if;
end;
$$;

create function public.record_settlement(
  p_client_request_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_amount_paise bigint,
  p_settled_on date,
  p_note text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_household uuid := private.current_household_id();
  saved_id uuid;
begin
  if caller is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if caller_household is null then
    raise exception 'NOT_IN_HOUSEHOLD' using errcode = 'P0001';
  end if;

  select id into saved_id from public.settlements where client_request_id = p_client_request_id;
  if saved_id is not null then
    return saved_id;
  end if;
  begin
    insert into public.settlements (
      household_id, created_by, from_user_id, to_user_id, amount_paise, settled_on, note, client_request_id
    ) values (
      caller_household, caller, p_from_user_id, p_to_user_id, p_amount_paise, p_settled_on,
      nullif(btrim(coalesce(p_note, '')), ''), p_client_request_id
    )
    returning id into saved_id;
  exception when unique_violation then
    select id into saved_id from public.settlements where client_request_id = p_client_request_id;
    if saved_id is null then
      raise;
    end if;
  end;
  return saved_id;
end;
$$;

create function public.set_settlement_voided(p_settlement_id uuid, p_voided boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.settlements
    set voided_at = case when p_voided then now() else null end
    where id = p_settlement_id and (voided_at is null) = p_voided;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
end;
$$;

-- Net position per member: paid − shares on shared expenses + settlements paid − settlements received.
-- Positive = is owed money; negative = owes. Across the household the values sum to zero.
create function public.household_balances()
returns table (
  user_id uuid,
  paid_paise bigint,
  share_paise bigint,
  settlements_paid_paise bigint,
  settlements_received_paise bigint,
  net_paise bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with household as (
    select private.current_household_id() as id
  ),
  live_shared as (
    select e.* from public.expenses e, household h
    where e.household_id = h.id and e.scope = 'shared' and e.voided_at is null
  ),
  paid as (
    select payer_user_id as member, sum(amount_paise) as total from live_shared group by payer_user_id
  ),
  shares as (
    select s.user_id as member, sum(s.share_paise) as total
    from public.expense_splits s join live_shared e on e.id = s.expense_id
    group by s.user_id
  ),
  live_settlements as (
    select st.* from public.settlements st, household h
    where st.household_id = h.id and st.voided_at is null
  ),
  sent as (
    select from_user_id as member, sum(amount_paise) as total from live_settlements group by from_user_id
  ),
  received as (
    select to_user_id as member, sum(amount_paise) as total from live_settlements group by to_user_id
  )
  select
    m.user_id,
    coalesce(p.total, 0)::bigint,
    coalesce(sh.total, 0)::bigint,
    coalesce(se.total, 0)::bigint,
    coalesce(r.total, 0)::bigint,
    (coalesce(p.total, 0) - coalesce(sh.total, 0) + coalesce(se.total, 0) - coalesce(r.total, 0))::bigint
  from public.household_members m
  join household h on h.id = m.household_id
  left join paid p on p.member = m.user_id
  left join shares sh on sh.member = m.user_id
  left join sent se on se.member = m.user_id
  left join received r on r.member = m.user_id
  order by m.joined_at;
$$;

revoke all on function public.save_expense(uuid, uuid, text, text, text, bigint, text, text, text, date, jsonb, uuid, integer) from public, anon;
revoke all on function public.set_expense_voided(uuid, integer, boolean) from public, anon;
revoke all on function public.record_settlement(uuid, uuid, uuid, bigint, date, text) from public, anon;
revoke all on function public.set_settlement_voided(uuid, boolean) from public, anon;
revoke all on function public.household_balances() from public, anon;
grant execute on function public.save_expense(uuid, uuid, text, text, text, bigint, text, text, text, date, jsonb, uuid, integer) to authenticated;
grant execute on function public.set_expense_voided(uuid, integer, boolean) to authenticated;
grant execute on function public.record_settlement(uuid, uuid, uuid, bigint, date, text) to authenticated;
grant execute on function public.set_settlement_voided(uuid, boolean) to authenticated;
grant execute on function public.household_balances() to authenticated;
grant execute on function private.is_member_of(uuid, uuid) to authenticated;
