-- Weight goals, weigh-ins and the energy profile used for maintenance (TDEE) estimates.
--
-- Privacy: body measurements, weigh-ins and goals are private by default. A user may share weigh-ins
-- and goals with their partner (profile.weight_visibility = 'household'). The energy profile (birth
-- date, height, sex used by the formula) is never readable by anyone else.
-- History: goals are versioned (a new row per change, newest effective_from wins); weigh-ins are one
-- per day, and every correction or deletion is kept in weight_entry_revisions.

create table public.energy_profiles (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  -- Mifflin-St Jeor needs a sex term; it is asked explicitly, never inferred, and is optional.
  formula_sex text check (formula_sex in ('male', 'female')),
  birth_date date check (birth_date between date '1900-01-01' and date '2100-01-01'),
  height_cm numeric(5, 1) check (height_cm between 100 and 250),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  maintenance_mode text not null default 'manual' check (maintenance_mode in ('formula', 'manual')),
  maintenance_kcal_manual integer check (maintenance_kcal_manual between 800 and 6000),
  daily_intake_target_kcal integer check (daily_intake_target_kcal between 800 and 6000),
  weight_visibility text not null default 'private' check (weight_visibility in ('private', 'household')),
  updated_at timestamptz not null default now()
);

create trigger energy_profiles_set_updated_at before update on public.energy_profiles
  for each row execute function private.set_updated_at();

create table public.weight_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  goal_type text not null check (goal_type in ('lose', 'gain', 'maintain')),
  start_weight_kg numeric(5, 2) not null check (start_weight_kg between 20 and 350),
  start_date date not null,
  target_weight_kg numeric(5, 2) check (target_weight_kg between 20 and 350),
  target_date date,
  effective_from date not null,
  created_at timestamptz not null default now(),
  constraint weight_goals_target_direction check (
    goal_type = 'maintain'
    or target_weight_kg is null
    or (goal_type = 'lose' and target_weight_kg < start_weight_kg)
    or (goal_type = 'gain' and target_weight_kg > start_weight_kg)
  ),
  constraint weight_goals_target_after_start check (target_date is null or target_date > start_date)
);

create index weight_goals_user_idx on public.weight_goals (user_id, effective_from desc, created_at desc);

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  local_date date not null check (local_date between date '2000-01-01' and date '2100-01-01'),
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 350),
  note text check (char_length(note) <= 300),
  client_request_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_date)
);

create table public.weight_entry_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  weight_entry_id uuid not null,
  change text not null check (change in ('update', 'delete')),
  previous jsonb not null,
  created_at timestamptz not null default now()
);

create function private.weight_entries_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.weight_entry_revisions (user_id, weight_entry_id, change, previous)
  values (old.user_id, old.id, lower(tg_op), to_jsonb(old));
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    return new;
  end if;
  return old;
end;
$$;

revoke all on function private.weight_entries_audit() from public;

create trigger weight_entries_audit before update or delete on public.weight_entries
  for each row execute function private.weight_entries_audit();

-- Can the caller see target_user_id's weigh-ins and goals?
create function private.can_read_weight(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id = (select auth.uid())
    or (
      private.is_self_or_partner(target_user_id)
      and exists (
        select 1 from public.energy_profiles ep
        where ep.user_id = target_user_id and ep.weight_visibility = 'household'
      )
    );
$$;

revoke all on function private.can_read_weight(uuid) from public;
grant execute on function private.can_read_weight(uuid) to authenticated;

alter table public.energy_profiles enable row level security;
alter table public.weight_goals enable row level security;
alter table public.weight_entries enable row level security;
alter table public.weight_entry_revisions enable row level security;

grant select on public.energy_profiles to authenticated;
grant insert (user_id, formula_sex, birth_date, height_cm, activity_level, maintenance_mode,
  maintenance_kcal_manual, daily_intake_target_kcal, weight_visibility) on public.energy_profiles to authenticated;
grant update (formula_sex, birth_date, height_cm, activity_level, maintenance_mode,
  maintenance_kcal_manual, daily_intake_target_kcal, weight_visibility) on public.energy_profiles to authenticated;

create policy "energy_profiles: self only" on public.energy_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "energy_profiles: self creates" on public.energy_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "energy_profiles: self updates" on public.energy_profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Partners may learn only whether weight is shared (needed to show the partner's chart).
create function public.partner_weight_shared()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id and theirs.user_id <> mine.user_id
    join public.energy_profiles ep on ep.user_id = theirs.user_id
    where mine.user_id = (select auth.uid()) and ep.weight_visibility = 'household'
  );
$$;

revoke all on function public.partner_weight_shared() from public, anon;
grant execute on function public.partner_weight_shared() to authenticated;

grant select on public.weight_goals to authenticated;
grant insert (user_id, goal_type, start_weight_kg, start_date, target_weight_kg, target_date, effective_from)
  on public.weight_goals to authenticated;

create policy "weight_goals: self, or partner if shared" on public.weight_goals
  for select to authenticated using (private.can_read_weight(user_id));
create policy "weight_goals: self creates" on public.weight_goals
  for insert to authenticated with check (user_id = (select auth.uid()));

grant select, delete on public.weight_entries to authenticated;
grant insert (user_id, local_date, weight_kg, note, client_request_id) on public.weight_entries to authenticated;
grant update (weight_kg, note) on public.weight_entries to authenticated;

create policy "weight_entries: self, or partner if shared" on public.weight_entries
  for select to authenticated using (private.can_read_weight(user_id));
create policy "weight_entries: self creates" on public.weight_entries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "weight_entries: self corrects" on public.weight_entries
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "weight_entries: self deletes" on public.weight_entries
  for delete to authenticated using (user_id = (select auth.uid()));

grant select on public.weight_entry_revisions to authenticated;
create policy "weight_entry_revisions: self only" on public.weight_entry_revisions
  for select to authenticated using (user_id = (select auth.uid()));

-- One weigh-in per day: logging again for the same day is an explicit correction (audited).
create function public.record_weight(p_client_request_id uuid, p_local_date date, p_weight_kg numeric, p_note text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  entry_id uuid;
begin
  if caller is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  select id into entry_id from public.weight_entries where client_request_id = p_client_request_id;
  if entry_id is not null then
    return entry_id;
  end if;
  insert into public.weight_entries (user_id, local_date, weight_kg, note, client_request_id)
  values (caller, p_local_date, p_weight_kg, nullif(btrim(coalesce(p_note, '')), ''), p_client_request_id)
  on conflict (user_id, local_date) do update
    set weight_kg = excluded.weight_kg, note = excluded.note
  returning id into entry_id;
  return entry_id;
end;
$$;

revoke all on function public.record_weight(uuid, date, numeric, text) from public, anon;
grant execute on function public.record_weight(uuid, date, numeric, text) to authenticated;

-- Daily calories eaten by the caller, with the "day complete" flag, for energy-balance charts.
-- Days with no logged food are absent (never reported as zero intake).
create function public.my_daily_intake(p_from date, p_to date)
returns table (local_date date, kcal numeric, is_complete boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.local_date, sum(i.kcal), coalesce(bool_or(d.is_complete), false)
  from public.meals m
  join public.meal_items i on i.meal_id = m.id
  left join public.nutrition_days d on d.owner_user_id = m.owner_user_id and d.local_date = m.local_date
  where m.owner_user_id = auth.uid() and m.local_date >= p_from and m.local_date < p_to
  group by m.local_date
  order by m.local_date;
$$;

revoke all on function public.my_daily_intake(date, date) from public, anon;
grant execute on function public.my_daily_intake(date, date) to authenticated;
