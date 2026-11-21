-- Lists: one list platform with typed presets (to-do, grocery, watch, ideas, packing, custom).
--
-- * A list is private to its owner or shared with the household; items inherit access from their list.
-- * Item order is a fractional index (`position`, byte-ordered with COLLATE "C"), so moving one item
--   never rewrites its neighbours and concurrent moves cannot corrupt the order.
-- * `revision` increases on every change; text edits are conditional on the revision the client saw,
--   so one partner never silently overwrites the other's edit.
-- * Type-specific details live in a small validated jsonb object rather than many nullable columns.

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_user_id uuid not null references public.profiles (user_id) on delete cascade,
  visibility text not null check (visibility in ('private', 'household')),
  kind text not null check (kind in ('todo', 'grocery', 'watch', 'ideas', 'packing', 'custom')),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  emoji text not null default '' check (char_length(emoji) <= 8),
  description text check (char_length(description) <= 300),
  archived_at timestamptz,
  client_request_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lists_household_idx on public.lists (household_id);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  created_by uuid references public.profiles (user_id) on delete set null,
  text text not null check (char_length(btrim(text)) between 1 and 200),
  note text check (char_length(note) <= 1000),
  is_done boolean not null default false,
  done_at timestamptz,
  done_by uuid references public.profiles (user_id) on delete set null,
  position text collate "C" not null check (position ~ '^[0-9A-Za-z]+$'),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 2048),
  revision integer not null default 1,
  client_request_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index list_items_list_position_idx on public.list_items (list_id, position);

-- ---------------------------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------------------------

create function private.lists_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.visibility <> old.visibility and old.owner_user_id <> auth.uid() then
    raise exception 'ONLY_OWNER_CHANGES_VISIBILITY' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger lists_before_update before update on public.lists
  for each row execute function private.lists_before_update();

-- Validates `details` against the parent list's kind: only known keys, with the right types.
create function private.validate_list_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent public.lists%rowtype;
  allowed text[];
  key text;
  assignee uuid;
begin
  select * into parent from public.lists where id = new.list_id;

  allowed := case parent.kind
    when 'grocery' then array['quantity', 'unit', 'pricePaise']
    when 'todo' then array['dueOn', 'assigneeId']
    when 'watch' then array['rating', 'link']
    when 'ideas' then array['link']
    else array[]::text[]
  end;

  for key in select jsonb_object_keys(new.details) loop
    if not key = any (allowed) then
      raise exception 'INVALID_ITEM_DETAILS' using errcode = 'P0001';
    end if;
  end loop;

  if (new.details ? 'quantity' and (jsonb_typeof(new.details -> 'quantity') <> 'number' or (new.details ->> 'quantity')::numeric <= 0 or (new.details ->> 'quantity')::numeric > 100000))
     or (new.details ? 'unit' and (jsonb_typeof(new.details -> 'unit') <> 'string' or char_length(new.details ->> 'unit') > 12))
     or (new.details ? 'pricePaise' and (jsonb_typeof(new.details -> 'pricePaise') <> 'number' or (new.details ->> 'pricePaise')::numeric < 0 or (new.details ->> 'pricePaise')::numeric > 10000000000 or (new.details ->> 'pricePaise')::numeric % 1 <> 0))
     or (new.details ? 'dueOn' and (jsonb_typeof(new.details -> 'dueOn') <> 'string' or (new.details ->> 'dueOn') !~ '^\d{4}-\d{2}-\d{2}$'))
     or (new.details ? 'rating' and (jsonb_typeof(new.details -> 'rating') <> 'number' or (new.details ->> 'rating') !~ '^[1-5]$'))
     or (new.details ? 'link' and (jsonb_typeof(new.details -> 'link') <> 'string' or (new.details ->> 'link') !~ '^https?://' or char_length(new.details ->> 'link') > 500))
  then
    raise exception 'INVALID_ITEM_DETAILS' using errcode = 'P0001';
  end if;

  if new.details ? 'dueOn' then
    perform (new.details ->> 'dueOn')::date; -- rejects impossible dates such as 2026-02-30
  end if;

  if new.details ? 'assigneeId' then
    if jsonb_typeof(new.details -> 'assigneeId') <> 'string' then
      raise exception 'INVALID_ITEM_DETAILS' using errcode = 'P0001';
    end if;
    assignee := (new.details ->> 'assigneeId')::uuid;
    if not private.is_member_of(parent.household_id, assignee) then
      raise exception 'ASSIGNEE_NOT_MEMBER' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.list_id <> old.list_id then
      raise exception 'ITEM_CANNOT_CHANGE_LIST' using errcode = 'P0001';
    end if;
    new.revision := old.revision + 1;
    new.updated_at := now();
    if new.is_done and not old.is_done then
      new.done_at := now();
      new.done_by := auth.uid();
    elsif not new.is_done then
      new.done_at := null;
      new.done_by := null;
    else
      new.done_at := old.done_at;
      new.done_by := old.done_by;
    end if;
  else
    new.created_by := auth.uid();
    new.revision := 1;
    if new.is_done then
      new.done_at := now();
      new.done_by := auth.uid();
    else
      new.done_at := null;
      new.done_by := null;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.validate_list_item() from public;

create trigger list_items_validate before insert or update on public.list_items
  for each row execute function private.validate_list_item();

-- ---------------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------------

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

grant select, delete on public.lists to authenticated;
grant insert (household_id, owner_user_id, visibility, kind, title, emoji, description, client_request_id)
  on public.lists to authenticated;
grant update (visibility, title, emoji, description, archived_at) on public.lists to authenticated;

create policy "lists: read own and shared" on public.lists
  for select to authenticated
  using (
    private.is_household_member(household_id)
    and (visibility = 'household' or owner_user_id = (select auth.uid()))
  );

create policy "lists: create as owner" on public.lists
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()) and private.is_household_member(household_id));

create policy "lists: edit own and shared" on public.lists
  for update to authenticated
  using (
    private.is_household_member(household_id)
    and (visibility = 'household' or owner_user_id = (select auth.uid()))
  )
  with check (
    private.is_household_member(household_id)
    and (visibility = 'household' or owner_user_id = (select auth.uid()))
  );

create policy "lists: owner deletes" on public.lists
  for delete to authenticated
  using (owner_user_id = (select auth.uid()) and private.is_household_member(household_id));

grant select, delete on public.list_items to authenticated;
grant insert (list_id, text, note, is_done, position, details, client_request_id) on public.list_items to authenticated;
grant update (text, note, is_done, position, details) on public.list_items to authenticated;

create policy "list_items: follow the list (read)" on public.list_items
  for select to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id));

create policy "list_items: follow the list (insert)" on public.list_items
  for insert to authenticated
  with check (exists (select 1 from public.lists l where l.id = list_id));

create policy "list_items: follow the list (update)" on public.list_items
  for update to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id))
  with check (exists (select 1 from public.lists l where l.id = list_id));

create policy "list_items: follow the list (delete)" on public.list_items
  for delete to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id));
