-- Together: profiles, households (exactly two members in v1), invitations, and RLS helpers.
--
-- Conventions used by every migration in this project:
--   * Every client-facing table has RLS enabled and explicit per-command policies.
--   * New tables are NOT auto-exposed (see supabase/config.toml `auto_expose_new_tables = false`);
--     privileges are granted explicitly, column by column where writes must be limited.
--   * The `anon` role gets no table privileges at all.
--   * Multi-row or authority-sensitive writes go through SECURITY DEFINER functions that derive the
--     caller from auth.uid() and never trust a client-supplied user or household id.
--   * Helper functions used inside policies live in the non-exposed `private` schema.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.assert_valid_time_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'INVALID_TIME_ZONE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Profiles: one per auth user, created by trigger. No email address is stored here, so partner
-- views never expose emails.
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  time_zone text not null default 'Asia/Kolkata',
  default_meal_visibility text not null default 'household'
    check (default_meal_visibility in ('private', 'household')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger profiles_valid_time_zone before insert or update of time_zone on public.profiles
  for each row execute function private.assert_valid_time_zone();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    left(coalesce(nullif(requested_name, ''), split_part(coalesce(new.email, 'Friend'), '@', 1)), 40)
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- Households and membership
-- ---------------------------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_by uuid references public.profiles (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger households_set_updated_at before update on public.households
  for each row execute function private.set_updated_at();

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  -- v1: a person belongs to at most one household.
  constraint household_members_one_household_per_user unique (user_id)
);

-- v1 households hold exactly two people. Enforced here (not only in the RPC) so no code path can
-- add a third member. The household row is locked to serialise concurrent joins.
create function private.enforce_household_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_members constant integer := 2;
  member_count integer;
begin
  perform 1 from public.households where id = new.household_id for update;
  select count(*) into member_count from public.household_members where household_id = new.household_id;
  if member_count >= max_members then
    raise exception 'HOUSEHOLD_FULL' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger household_members_capacity before insert on public.household_members
  for each row execute function private.enforce_household_capacity();

-- Invitations are single-use, expiring, revocable. Only a SHA-256 hash of the token is stored;
-- the plaintext token is returned once to the inviter and never persisted.
create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references public.profiles (user_id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  redeemed_by uuid references public.profiles (user_id) on delete set null,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint household_invitations_redeemed_consistency
    check (redeemed_by is null or redeemed_at is not null)
);

create index household_invitations_household_idx on public.household_invitations (household_id);

-- ---------------------------------------------------------------------------------------------
-- RLS helper functions. SECURITY DEFINER avoids recursive policy evaluation on
-- household_members; each function only answers a yes/no question about the current caller.
-- ---------------------------------------------------------------------------------------------

create function private.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.household_members where user_id = (select auth.uid());
$$;

create function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = (select auth.uid())
  );
$$;

-- True when target_user_id is the caller or the caller's household partner.
create function private.is_self_or_partner(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id = (select auth.uid())
    or exists (
      select 1
      from public.household_members mine
      join public.household_members theirs on theirs.household_id = mine.household_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = target_user_id
    );
$$;

revoke all on function private.current_household_id() from public;
revoke all on function private.is_household_member(uuid) from public;
revoke all on function private.is_self_or_partner(uuid) from public;
grant execute on function private.current_household_id() to authenticated;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_self_or_partner(uuid) to authenticated;
revoke all on function private.handle_new_user() from public;
revoke all on function private.enforce_household_capacity() from public;

-- ---------------------------------------------------------------------------------------------
-- RLS policies and privileges
-- ---------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;

grant select on public.profiles to authenticated;
grant update (display_name, time_zone, default_meal_visibility) on public.profiles to authenticated;

create policy "profiles: read self and partner" on public.profiles
  for select to authenticated
  using (private.is_self_or_partner(user_id));

create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select on public.households to authenticated;
grant update (name) on public.households to authenticated;

create policy "households: members read" on public.households
  for select to authenticated
  using (private.is_household_member(id));

create policy "households: members rename" on public.households
  for update to authenticated
  using (private.is_household_member(id))
  with check (private.is_household_member(id));

grant select on public.household_members to authenticated;

create policy "household_members: members read" on public.household_members
  for select to authenticated
  using (private.is_household_member(household_id));

-- token_hash is deliberately not readable by clients.
grant select (id, household_id, created_by, expires_at, redeemed_by, redeemed_at, revoked_at, created_at)
  on public.household_invitations to authenticated;

create policy "household_invitations: members read" on public.household_invitations
  for select to authenticated
  using (private.is_household_member(household_id));

-- ---------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------

create function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  new_household_id uuid;
begin
  if caller is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if exists (select 1 from public.household_members where user_id = caller) then
    raise exception 'ALREADY_IN_HOUSEHOLD' using errcode = 'P0001';
  end if;

  insert into public.households (name, created_by)
  values (btrim(household_name), caller)
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, caller, 'owner');

  return new_household_id;
end;
$$;

create function private.hash_invitation_token(token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.sha256(pg_catalog.convert_to(token, 'UTF8'));
$$;

revoke all on function private.hash_invitation_token(text) from public;

-- Creates a fresh invitation and revokes any outstanding one, so at most one link is live.
create function public.create_household_invitation()
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_lifetime constant interval := interval '72 hours';
  caller uuid := auth.uid();
  caller_household uuid;
  member_count integer;
  plaintext_token text;
begin
  if caller is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  select hm.household_id into caller_household from public.household_members hm where hm.user_id = caller;
  if caller_household is null then
    raise exception 'NOT_IN_HOUSEHOLD' using errcode = 'P0001';
  end if;

  select count(*) into member_count from public.household_members hm where hm.household_id = caller_household;
  if member_count >= 2 then
    raise exception 'HOUSEHOLD_FULL' using errcode = 'P0001';
  end if;

  update public.household_invitations hi
    set revoked_at = now()
    where hi.household_id = caller_household and hi.redeemed_at is null and hi.revoked_at is null;

  plaintext_token := encode(extensions.gen_random_bytes(32), 'hex');

  return query
    insert into public.household_invitations as hi (household_id, created_by, token_hash, expires_at)
    values (caller_household, caller, private.hash_invitation_token(plaintext_token), now() + invitation_lifetime)
    returning hi.id, plaintext_token, hi.expires_at;
end;
$$;

create function public.revoke_household_invitation(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.household_invitations
    set revoked_at = now()
    where id = target_invitation_id
      and revoked_at is null
      and redeemed_at is null
      and household_id = private.current_household_id();
  if not found then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;
end;
$$;

-- Lets a signed-in invitee see who invited them before accepting. Reveals nothing without the
-- (256-bit, single-use) token.
create function public.preview_household_invitation(invitation_token text)
returns table (household_name text, inviter_name text, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  return query
    select h.name, p.display_name, hi.expires_at
    from public.household_invitations hi
    join public.households h on h.id = hi.household_id
    join public.profiles p on p.user_id = hi.created_by
    where hi.token_hash = private.hash_invitation_token(invitation_token)
      and hi.redeemed_at is null
      and hi.revoked_at is null
      and hi.expires_at > now();
end;
$$;

create function public.accept_household_invitation(invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  invitation public.household_invitations%rowtype;
begin
  if caller is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  select * into invitation
    from public.household_invitations
    where token_hash = private.hash_invitation_token(invitation_token)
    for update;

  if not found or invitation.revoked_at is not null or invitation.redeemed_at is not null then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;
  if invitation.expires_at <= now() then
    raise exception 'INVITE_EXPIRED' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.household_members where user_id = caller) then
    raise exception 'ALREADY_IN_HOUSEHOLD' using errcode = 'P0001';
  end if;

  -- Capacity is re-checked by the household_members trigger under a row lock.
  insert into public.household_members (household_id, user_id, role)
  values (invitation.household_id, caller, 'member');

  update public.household_invitations
    set redeemed_at = now(), redeemed_by = caller
    where id = invitation.id;

  return invitation.household_id;
end;
$$;

revoke all on function public.create_household(text) from public, anon;
revoke all on function public.create_household_invitation() from public, anon;
revoke all on function public.revoke_household_invitation(uuid) from public, anon;
revoke all on function public.preview_household_invitation(text) from public, anon;
revoke all on function public.accept_household_invitation(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_household_invitation() to authenticated;
grant execute on function public.revoke_household_invitation(uuid) to authenticated;
grant execute on function public.preview_household_invitation(text) to authenticated;
grant execute on function public.accept_household_invitation(text) to authenticated;
