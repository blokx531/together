-- Nutrition: food catalog, custom foods, meals with snapshotted items, and day completeness.
--
-- * Catalog foods (owner_user_id null) come from openly licensed datasets; each row names its source
--   and licence (food_sources). Custom foods belong to a user and may be shared with the household.
-- * Every food has an explicit basis: kcal (and optional macros) per 100 g, per 100 ml, or per serving.
-- * A logged item copies ("snapshots") the food's name, basis and values. Editing or deleting a food
--   later never changes past meals. kcal of an item is a generated column: quantity / basis × value.
-- * Provenance separates measured (label), derived (dataset/recipe) and estimated (guess/AI) values.

create extension if not exists "uuid-ossp" with schema extensions;

-- array_to_string is only STABLE in general, but for text[] it does not depend on any setting, so
-- this wrapper is safe to declare IMMUTABLE for use in a generated column.
create function private.food_search_text(name text, variant text, aliases text[])
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(name || ' ' || coalesce(variant, '') || ' ' || pg_catalog.array_to_string(aliases, ' '));
$$;

grant execute on function private.food_search_text(text, text, text[]) to authenticated;

create table public.food_sources (
  id text primary key,
  name text not null,
  license text not null,
  url text not null,
  attribution text not null
);

insert into public.food_sources (id, name, license, url, attribution) values
  ('katori', 'Katori Indian food nutrition dataset', 'CC BY 4.0', 'https://getkatori.com/data',
   'Data: Katori Indian food nutrition dataset, getkatori.com/data (CC BY 4.0)'),
  ('cofid-2021', 'McCance and Widdowson''s Composition of Foods Integrated Dataset 2021 (UK)', 'Open Government Licence v3.0',
   'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid',
   'Contains public sector information licensed under the Open Government Licence v3.0.'),
  ('user', 'Added by you', 'Private', '', 'Entered by a household member');

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.food_sources (id),
  source_ref text,
  owner_user_id uuid references public.profiles (user_id) on delete cascade,
  -- Custom foods can be shared with the household (null = only the owner sees it).
  household_id uuid references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  variant text check (char_length(variant) <= 40),
  aliases text[] not null default '{}',
  basis_unit text not null check (basis_unit in ('g', 'ml', 'serving')),
  basis_amount numeric not null,
  kcal_per_basis numeric(7, 2) not null check (kcal_per_basis >= 0),
  protein_g_per_basis numeric(6, 2) check (protein_g_per_basis >= 0),
  carbs_g_per_basis numeric(6, 2) check (carbs_g_per_basis >= 0),
  fat_g_per_basis numeric(6, 2) check (fat_g_per_basis >= 0),
  provenance text not null check (provenance in ('measured', 'derived', 'estimated')),
  search_text text generated always as (private.food_search_text(name, variant, aliases)) stored,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foods_basis_amount check (
    (basis_unit in ('g', 'ml') and basis_amount = 100) or (basis_unit = 'serving' and basis_amount = 1)
  ),
  -- Energy density cannot exceed pure fat (900 kcal/100 g); a single serving is capped generously.
  constraint foods_kcal_plausible check (
    (basis_unit = 'serving' and kcal_per_basis <= 5000) or (basis_unit <> 'serving' and kcal_per_basis <= 900)
  ),
  constraint foods_catalog_or_custom check ((owner_user_id is null) = (source_id <> 'user')),
  constraint foods_catalog_ref unique (source_id, source_ref)
);

create index foods_owner_idx on public.foods (owner_user_id);

create trigger foods_set_updated_at before update on public.foods
  for each row execute function private.set_updated_at();

create table public.food_servings (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 60),
  -- In the food's basis unit: grams, millilitres or servings.
  amount numeric(8, 2) not null check (amount > 0 and amount <= 5000),
  position smallint not null default 0,
  unique (food_id, label)
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (user_id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  local_date date not null check (local_date between date '2000-01-01' and date '2100-01-01'),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snacks', 'custom')),
  custom_label text not null default '' check (char_length(custom_label) <= 30),
  visibility text not null check (visibility in ('private', 'household')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meals_custom_label check ((meal_type = 'custom') = (custom_label <> '')),
  constraint meals_one_per_slot unique (owner_user_id, local_date, meal_type, custom_label)
);

create index meals_household_date_idx on public.meals (household_id, local_date);

create trigger meals_set_updated_at before update on public.meals
  for each row execute function private.set_updated_at();

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  -- Snapshot of the food at logging time.
  food_name text not null check (char_length(food_name) between 1 and 80),
  food_variant text,
  source_label text not null,
  provenance text not null check (provenance in ('measured', 'derived', 'estimated')),
  basis_unit text not null check (basis_unit in ('g', 'ml', 'serving')),
  basis_amount numeric not null check (basis_amount > 0),
  kcal_per_basis numeric(7, 2) not null check (kcal_per_basis >= 0),
  protein_g_per_basis numeric(6, 2),
  carbs_g_per_basis numeric(6, 2),
  fat_g_per_basis numeric(6, 2),
  -- What was eaten, in the basis unit (e.g. 80 g for two 40 g rotis).
  quantity numeric(8, 2) not null check (quantity > 0 and quantity <= 10000),
  -- How the user expressed it, for display ("2 × 1 medium roti (40 g)").
  serving_label text,
  serving_count numeric(6, 2) check (serving_count > 0),
  kcal numeric(8, 2) generated always as (round(quantity / basis_amount * kcal_per_basis, 2)) stored,
  protein_g numeric(7, 2) generated always as (round(quantity / basis_amount * protein_g_per_basis, 2)) stored,
  carbs_g numeric(7, 2) generated always as (round(quantity / basis_amount * carbs_g_per_basis, 2)) stored,
  fat_g numeric(7, 2) generated always as (round(quantity / basis_amount * fat_g_per_basis, 2)) stored,
  client_request_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_items_meal_idx on public.meal_items (meal_id);

create trigger meal_items_set_updated_at before update on public.meal_items
  for each row execute function private.set_updated_at();

-- A meal with no items is meaningless; remove it when its last item goes.
create function private.delete_empty_meal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.meals m
  where m.id = old.meal_id and not exists (select 1 from public.meal_items i where i.meal_id = old.meal_id);
  return null;
end;
$$;

revoke all on function private.delete_empty_meal() from public;

create trigger meal_items_delete_empty_meal after delete on public.meal_items
  for each row execute function private.delete_empty_meal();

-- "I logged everything I ate this day." Days without this are shown as possibly incomplete.
create table public.nutrition_days (
  owner_user_id uuid not null references public.profiles (user_id) on delete cascade,
  local_date date not null,
  is_complete boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, local_date)
);

create trigger nutrition_days_set_updated_at before update on public.nutrition_days
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------------

alter table public.food_sources enable row level security;
alter table public.foods enable row level security;
alter table public.food_servings enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.nutrition_days enable row level security;

grant select on public.food_sources to authenticated;
create policy "food_sources: readable" on public.food_sources for select to authenticated using (true);

grant select, delete on public.foods to authenticated;
grant insert (source_id, owner_user_id, household_id, name, variant, aliases, basis_unit, basis_amount,
  kcal_per_basis, protein_g_per_basis, carbs_g_per_basis, fat_g_per_basis, provenance)
  on public.foods to authenticated;
grant update (household_id, name, variant, aliases, kcal_per_basis, protein_g_per_basis, carbs_g_per_basis,
  fat_g_per_basis, provenance, archived_at)
  on public.foods to authenticated;

create policy "foods: catalog, own, and household-shared" on public.foods
  for select to authenticated
  using (
    owner_user_id is null
    or owner_user_id = (select auth.uid())
    or (household_id is not null and private.is_household_member(household_id))
  );

create policy "foods: create own custom" on public.foods
  for insert to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and source_id = 'user'
    and (household_id is null or private.is_household_member(household_id))
  );

create policy "foods: owner edits" on public.foods
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()) and (household_id is null or private.is_household_member(household_id)));

create policy "foods: owner deletes" on public.foods
  for delete to authenticated
  using (owner_user_id = (select auth.uid()));

grant select, insert, delete on public.food_servings to authenticated;

create policy "food_servings: follow the food" on public.food_servings
  for select to authenticated
  using (exists (select 1 from public.foods f where f.id = food_id));

create policy "food_servings: owner adds" on public.food_servings
  for insert to authenticated
  with check (exists (select 1 from public.foods f where f.id = food_id and f.owner_user_id = (select auth.uid())));

create policy "food_servings: owner removes" on public.food_servings
  for delete to authenticated
  using (exists (select 1 from public.foods f where f.id = food_id and f.owner_user_id = (select auth.uid())));

grant select, delete on public.meals to authenticated;
grant insert (owner_user_id, household_id, local_date, meal_type, custom_label, visibility, note) on public.meals to authenticated;
grant update (local_date, meal_type, custom_label, visibility, note) on public.meals to authenticated;

create policy "meals: own, or partner's shared" on public.meals
  for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (visibility = 'household' and private.is_household_member(household_id))
  );

create policy "meals: create own" on public.meals
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()) and private.is_household_member(household_id));

create policy "meals: owner edits" on public.meals
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()) and private.is_household_member(household_id));

create policy "meals: owner deletes" on public.meals
  for delete to authenticated
  using (owner_user_id = (select auth.uid()));

grant select, delete on public.meal_items to authenticated;
grant insert (meal_id, food_id, food_name, food_variant, source_label, provenance, basis_unit, basis_amount,
  kcal_per_basis, protein_g_per_basis, carbs_g_per_basis, fat_g_per_basis, quantity, serving_label,
  serving_count, client_request_id)
  on public.meal_items to authenticated;
grant update (quantity, serving_label, serving_count) on public.meal_items to authenticated;

create policy "meal_items: follow the meal" on public.meal_items
  for select to authenticated
  using (exists (select 1 from public.meals m where m.id = meal_id));

create policy "meal_items: owner adds" on public.meal_items
  for insert to authenticated
  with check (exists (select 1 from public.meals m where m.id = meal_id and m.owner_user_id = (select auth.uid())));

create policy "meal_items: owner edits" on public.meal_items
  for update to authenticated
  using (exists (select 1 from public.meals m where m.id = meal_id and m.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.meals m where m.id = meal_id and m.owner_user_id = (select auth.uid())));

create policy "meal_items: owner deletes" on public.meal_items
  for delete to authenticated
  using (exists (select 1 from public.meals m where m.id = meal_id and m.owner_user_id = (select auth.uid())));

grant select on public.nutrition_days to authenticated;
grant insert (owner_user_id, local_date, is_complete) on public.nutrition_days to authenticated;
grant update (is_complete) on public.nutrition_days to authenticated;

create policy "nutrition_days: self and partner read" on public.nutrition_days
  for select to authenticated
  using (private.is_self_or_partner(owner_user_id));

create policy "nutrition_days: self writes" on public.nutrition_days
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

create policy "nutrition_days: self updates" on public.nutrition_days
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- RPCs (SECURITY INVOKER: RLS applies to every statement)
-- ---------------------------------------------------------------------------------------------

create function private.ensure_meal(
  p_local_date date, p_meal_type text, p_custom_label text, p_visibility text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_household uuid := private.current_household_id();
  meal_id uuid;
begin
  if caller is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if caller_household is null then
    raise exception 'NOT_IN_HOUSEHOLD' using errcode = 'P0001';
  end if;
  insert into public.meals (owner_user_id, household_id, local_date, meal_type, custom_label, visibility)
  values (caller, caller_household, p_local_date, p_meal_type, coalesce(p_custom_label, ''), p_visibility)
  on conflict (owner_user_id, local_date, meal_type, custom_label) do nothing
  returning id into meal_id;
  if meal_id is null then
    select m.id into meal_id from public.meals m
    where m.owner_user_id = caller and m.local_date = p_local_date
      and m.meal_type = p_meal_type and m.custom_label = coalesce(p_custom_label, '');
  end if;
  return meal_id;
end;
$$;

revoke all on function private.ensure_meal(date, text, text, text) from public;
grant execute on function private.ensure_meal(date, text, text, text) to authenticated;

-- Logs a catalog or custom food. The food's values are copied server-side from a row the caller can
-- read, so a client cannot claim catalog provenance for made-up numbers. Idempotent per request id.
create function public.log_food(
  p_client_request_id uuid,
  p_local_date date,
  p_meal_type text,
  p_custom_label text,
  p_visibility text,
  p_food_id uuid,
  p_quantity numeric,
  p_serving_label text,
  p_serving_count numeric
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing uuid;
  target_meal uuid;
  food public.foods%rowtype;
  source public.food_sources%rowtype;
  item_id uuid;
begin
  select i.id into existing from public.meal_items i where i.client_request_id = p_client_request_id;
  if existing is not null then
    return existing;
  end if;

  select * into food from public.foods where id = p_food_id;
  if not found then
    raise exception 'FOOD_NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into source from public.food_sources where id = food.source_id;

  target_meal := private.ensure_meal(p_local_date, p_meal_type, p_custom_label, p_visibility);

  insert into public.meal_items (
    meal_id, food_id, food_name, food_variant, source_label, provenance, basis_unit, basis_amount,
    kcal_per_basis, protein_g_per_basis, carbs_g_per_basis, fat_g_per_basis, quantity, serving_label,
    serving_count, client_request_id
  ) values (
    target_meal, food.id, food.name, food.variant, source.name, food.provenance, food.basis_unit, food.basis_amount,
    food.kcal_per_basis, food.protein_g_per_basis, food.carbs_g_per_basis, food.fat_g_per_basis, p_quantity,
    nullif(btrim(coalesce(p_serving_label, '')), ''), p_serving_count, p_client_request_id
  )
  on conflict (client_request_id) do nothing
  returning id into item_id;

  if item_id is null then
    select i.id into item_id from public.meal_items i where i.client_request_id = p_client_request_id;
  end if;
  return item_id;
end;
$$;

-- Copies all items of one meal into another slot (e.g. "same as yesterday's breakfast"). The copied
-- items keep their original snapshots. p_request_id makes the whole copy idempotent.
create function public.copy_meal(
  p_source_meal_id uuid,
  p_target_date date,
  p_target_meal_type text,
  p_target_custom_label text,
  p_request_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_meal public.meals%rowtype;
  target_meal uuid;
begin
  select * into source_meal from public.meals where id = p_source_meal_id and owner_user_id = auth.uid();
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  target_meal := private.ensure_meal(p_target_date, p_target_meal_type, p_target_custom_label, source_meal.visibility);
  insert into public.meal_items (
    meal_id, food_id, food_name, food_variant, source_label, provenance, basis_unit, basis_amount,
    kcal_per_basis, protein_g_per_basis, carbs_g_per_basis, fat_g_per_basis, quantity, serving_label,
    serving_count, client_request_id
  )
  select
    target_meal, i.food_id, i.food_name, i.food_variant, i.source_label, i.provenance, i.basis_unit, i.basis_amount,
    i.kcal_per_basis, i.protein_g_per_basis, i.carbs_g_per_basis, i.fat_g_per_basis, i.quantity, i.serving_label,
    i.serving_count,
    -- Deterministic per (request, source item) so a retried copy inserts nothing new.
    extensions.uuid_generate_v5(p_request_id, i.id::text)
  from public.meal_items i
  where i.meal_id = p_source_meal_id
  on conflict (client_request_id) do nothing;
  return target_meal;
end;
$$;

-- Moves a meal to another day/slot, merging into an existing meal there if needed.
create function public.move_meal(
  p_meal_id uuid,
  p_target_date date,
  p_target_meal_type text,
  p_target_custom_label text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_meal public.meals%rowtype;
  target_meal uuid;
begin
  select * into source_meal from public.meals where id = p_meal_id and owner_user_id = auth.uid();
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  target_meal := private.ensure_meal(p_target_date, p_target_meal_type, p_target_custom_label, source_meal.visibility);
  if target_meal = p_meal_id then
    return target_meal;
  end if;
  update public.meal_items set meal_id = target_meal where meal_id = p_meal_id;
  delete from public.meals where id = p_meal_id;
  return target_meal;
end;
$$;

grant update (meal_id) on public.meal_items to authenticated;

create function public.set_day_complete(p_local_date date, p_is_complete boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.nutrition_days (owner_user_id, local_date, is_complete)
  values (auth.uid(), p_local_date, p_is_complete)
  on conflict (owner_user_id, local_date) do update set is_complete = excluded.is_complete;
$$;

revoke all on function public.log_food(uuid, date, text, text, text, uuid, numeric, text, numeric) from public, anon;
revoke all on function public.copy_meal(uuid, date, text, text, uuid) from public, anon;
revoke all on function public.move_meal(uuid, date, text, text) from public, anon;
revoke all on function public.set_day_complete(date, boolean) from public, anon;
grant execute on function public.log_food(uuid, date, text, text, text, uuid, numeric, text, numeric) to authenticated;
grant execute on function public.copy_meal(uuid, date, text, text, uuid) to authenticated;
grant execute on function public.move_meal(uuid, date, text, text) to authenticated;
grant execute on function public.set_day_complete(date, boolean) to authenticated;
