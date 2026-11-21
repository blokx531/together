-- Travel: places (visited and/or wishlist), visits with dates, and who actually went.
--
-- * A place is private to its creator or shared with the household.
-- * "Visited" means the place has at least one visit; "wishlist" is a separate flag, so a wish never
--   counts as a visit. A visit is "together" only when both members are recorded as having gone.
-- * Coordinates are stored with the label so saved places work without any external lookup.

create table public.places (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references public.profiles (user_id) on delete cascade,
  visibility text not null check (visibility in ('private', 'household')),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  locality text check (char_length(locality) <= 120),
  region text check (char_length(region) <= 120),
  country_code char(2) check (country_code ~ '^[A-Z]{2}$'),
  country_name text check (char_length(country_name) <= 80),
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  source text not null check (source in ('manual', 'photon')),
  source_ref text check (char_length(source_ref) <= 80),
  is_wishlist boolean not null default false,
  note text check (char_length(note) <= 1000),
  client_request_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index places_household_idx on public.places (household_id);

create trigger places_set_updated_at before update on public.places
  for each row execute function private.set_updated_at();

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  created_by uuid references public.profiles (user_id) on delete set null,
  started_on date not null check (started_on between date '1900-01-01' and date '2100-01-01'),
  ended_on date,
  note text check (char_length(note) <= 1000),
  client_request_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visits_dates check (ended_on is null or ended_on >= started_on)
);

create index visits_place_idx on public.visits (place_id);

create trigger visits_set_updated_at before update on public.visits
  for each row execute function private.set_updated_at();

create table public.visit_members (
  visit_id uuid not null references public.visits (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  primary key (visit_id, user_id)
);

-- Who went must belong to the household, and a private place can only record its creator.
create function private.check_visit_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  place public.places%rowtype;
begin
  select p.* into place from public.places p join public.visits v on v.place_id = p.id where v.id = new.visit_id;
  if not private.is_member_of(place.household_id, new.user_id) then
    raise exception 'VISITOR_NOT_MEMBER' using errcode = 'P0001';
  end if;
  if place.visibility = 'private' and new.user_id <> place.created_by then
    raise exception 'PRIVATE_PLACE_SINGLE_VISITOR' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.check_visit_member() from public;

create trigger visit_members_check before insert or update on public.visit_members
  for each row execute function private.check_visit_member();

alter table public.places enable row level security;
alter table public.visits enable row level security;
alter table public.visit_members enable row level security;

grant select, delete on public.places to authenticated;
grant insert (household_id, created_by, visibility, name, locality, region, country_code, country_name, latitude,
  longitude, source, source_ref, is_wishlist, note, client_request_id) on public.places to authenticated;
grant update (name, locality, region, country_code, country_name, latitude, longitude, is_wishlist, note)
  on public.places to authenticated;

create policy "places: own and shared" on public.places
  for select to authenticated
  using (private.is_household_member(household_id) and (visibility = 'household' or created_by = (select auth.uid())));

create policy "places: create as self" on public.places
  for insert to authenticated
  with check (created_by = (select auth.uid()) and private.is_household_member(household_id));

create policy "places: edit own and shared" on public.places
  for update to authenticated
  using (private.is_household_member(household_id) and (visibility = 'household' or created_by = (select auth.uid())))
  with check (private.is_household_member(household_id) and (visibility = 'household' or created_by = (select auth.uid())));

create policy "places: delete own and shared" on public.places
  for delete to authenticated
  using (private.is_household_member(household_id) and (visibility = 'household' or created_by = (select auth.uid())));

grant select, delete on public.visits to authenticated;
grant insert (place_id, created_by, started_on, ended_on, note, client_request_id) on public.visits to authenticated;
grant update (started_on, ended_on, note) on public.visits to authenticated;

create policy "visits: follow the place (read)" on public.visits
  for select to authenticated using (exists (select 1 from public.places p where p.id = place_id));
create policy "visits: follow the place (insert)" on public.visits
  for insert to authenticated with check (created_by = (select auth.uid()) and exists (select 1 from public.places p where p.id = place_id));
create policy "visits: follow the place (update)" on public.visits
  for update to authenticated
  using (exists (select 1 from public.places p where p.id = place_id))
  with check (exists (select 1 from public.places p where p.id = place_id));
create policy "visits: follow the place (delete)" on public.visits
  for delete to authenticated using (exists (select 1 from public.places p where p.id = place_id));

grant select, insert, delete on public.visit_members to authenticated;

create policy "visit_members: follow the visit (read)" on public.visit_members
  for select to authenticated using (exists (select 1 from public.visits v where v.id = visit_id));
create policy "visit_members: follow the visit (insert)" on public.visit_members
  for insert to authenticated with check (exists (select 1 from public.visits v where v.id = visit_id));
create policy "visit_members: follow the visit (delete)" on public.visit_members
  for delete to authenticated using (exists (select 1 from public.visits v where v.id = visit_id));

-- Records a visit and who went, atomically. Idempotent per request id. No end date = a single day.
create function public.add_visit(
  p_client_request_id uuid,
  p_place_id uuid,
  p_started_on date,
  p_member_ids uuid[],
  p_ended_on date default null,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  visit_id uuid;
begin
  if coalesce(cardinality(p_member_ids), 0) = 0 then
    raise exception 'VISITORS_REQUIRED' using errcode = 'P0001';
  end if;
  select v.id into visit_id from public.visits v where v.client_request_id = p_client_request_id;
  if visit_id is not null then
    return visit_id;
  end if;
  insert into public.visits (place_id, created_by, started_on, ended_on, note, client_request_id)
  values (p_place_id, auth.uid(), p_started_on, p_ended_on, nullif(btrim(coalesce(p_note, '')), ''), p_client_request_id)
  returning id into visit_id;
  insert into public.visit_members (visit_id, user_id)
  select visit_id, member from unnest(p_member_ids) as member;
  return visit_id;
end;
$$;

-- Creates a place, optionally with its first visit, in one transaction. Idempotent per request id.
create function public.create_place(
  p_client_request_id uuid,
  p_name text,
  p_locality text,
  p_region text,
  p_country_code text,
  p_country_name text,
  p_latitude numeric,
  p_longitude numeric,
  p_source text,
  p_source_ref text,
  p_visibility text,
  p_is_wishlist boolean,
  p_visit_started_on date default null,
  p_visit_ended_on date default null,
  p_visit_member_ids uuid[] default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  place_id uuid;
  caller_household uuid := private.current_household_id();
begin
  if caller_household is null then
    raise exception 'NOT_IN_HOUSEHOLD' using errcode = 'P0001';
  end if;
  select p.id into place_id from public.places p where p.client_request_id = p_client_request_id;
  if place_id is not null then
    return place_id;
  end if;
  insert into public.places (
    household_id, created_by, visibility, name, locality, region, country_code, country_name, latitude, longitude,
    source, source_ref, is_wishlist, client_request_id
  ) values (
    caller_household, auth.uid(), p_visibility, btrim(p_name), nullif(btrim(coalesce(p_locality, '')), ''),
    nullif(btrim(coalesce(p_region, '')), ''), nullif(upper(btrim(coalesce(p_country_code, ''))), ''),
    nullif(btrim(coalesce(p_country_name, '')), ''), p_latitude, p_longitude, p_source,
    nullif(btrim(coalesce(p_source_ref, '')), ''), p_is_wishlist, p_client_request_id
  )
  returning id into place_id;

  if p_visit_started_on is not null then
    perform public.add_visit(
      p_client_request_id => extensions.uuid_generate_v5(p_client_request_id, 'first-visit'),
      p_place_id => place_id,
      p_started_on => p_visit_started_on,
      p_member_ids => p_visit_member_ids,
      p_ended_on => p_visit_ended_on
    );
  end if;
  return place_id;
end;
$$;

revoke all on function public.add_visit(uuid, uuid, date, uuid[], date, text) from public, anon;
revoke all on function public.create_place(uuid, text, text, text, text, text, numeric, numeric, text, text, text, boolean, date, date, uuid[]) from public, anon;
grant execute on function public.add_visit(uuid, uuid, date, uuid[], date, text) to authenticated;
grant execute on function public.create_place(uuid, text, text, text, text, text, numeric, numeric, text, text, text, boolean, date, date, uuid[]) to authenticated;
