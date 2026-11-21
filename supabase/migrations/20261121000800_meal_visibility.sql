-- New accounts opt in to sharing. Keep existing profile preferences and meal history intact.
alter table public.profiles alter column default_meal_visibility set default 'private';

-- All callers (log, copy, and move) must agree with an existing meal's visibility. Lock the
-- destination until the item write commits so a concurrent visibility edit cannot change it
-- between this check and the write.
create or replace function private.ensure_meal(
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
  meal_visibility text;
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
  if meal_id is not null then
    return meal_id;
  end if;

  select m.id, m.visibility into meal_id, meal_visibility
  from public.meals m
  where m.owner_user_id = caller and m.local_date = p_local_date
    and m.meal_type = p_meal_type and m.custom_label = coalesce(p_custom_label, '')
  for no key update;

  if not found or meal_visibility is distinct from p_visibility then
    raise exception 'STALE_MEAL_VISIBILITY' using errcode = 'P0001';
  end if;
  return meal_id;
end;
$$;
