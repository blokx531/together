-- Hosted projects can still grant broad public-table access by default. Remove those grants
-- from browser roles and restore the explicit table and column privileges of migrations 0100–0700.
-- Keep the service role and row-level security policies intact.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

revoke all on table
  public.profiles,
  public.households,
  public.household_members,
  public.household_invitations,
  public.expenses,
  public.expense_splits,
  public.expense_revisions,
  public.settlements,
  public.lists,
  public.list_items,
  public.food_sources,
  public.foods,
  public.food_servings,
  public.meals,
  public.meal_items,
  public.nutrition_days,
  public.energy_profiles,
  public.weight_goals,
  public.weight_entries,
  public.weight_entry_revisions,
  public.places,
  public.visits,
  public.visit_members
from public, anon, authenticated;

-- households
grant select on public.profiles to authenticated;
grant update (display_name, time_zone, default_meal_visibility) on public.profiles to authenticated;
grant select on public.households to authenticated;
grant update (name) on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select (id, household_id, created_by, expires_at, redeemed_by, redeemed_at, revoked_at, created_at)
  on public.household_invitations to authenticated;

-- money
grant select on public.expenses to authenticated;
grant insert (
  household_id, created_by, payer_user_id, scope, visibility, split_method, amount_paise,
  category, title, note, spent_on, client_request_id
) on public.expenses to authenticated;
grant update (
  payer_user_id, scope, visibility, split_method, amount_paise, category, title, note, spent_on, voided_at
) on public.expenses to authenticated;
grant select, insert, delete on public.expense_splits to authenticated;
grant select on public.expense_revisions to authenticated;
grant select on public.settlements to authenticated;
grant insert (household_id, created_by, from_user_id, to_user_id, amount_paise, settled_on, note, client_request_id)
  on public.settlements to authenticated;
grant update (voided_at) on public.settlements to authenticated;

-- lists
grant select, delete on public.lists to authenticated;
grant insert (household_id, owner_user_id, visibility, kind, title, emoji, description, client_request_id)
  on public.lists to authenticated;
grant update (visibility, title, emoji, description, archived_at) on public.lists to authenticated;
grant select, delete on public.list_items to authenticated;
grant insert (list_id, text, note, is_done, position, details, client_request_id) on public.list_items to authenticated;
grant update (text, note, is_done, position, details) on public.list_items to authenticated;

-- nutrition
grant select on public.food_sources to authenticated;
grant select, delete on public.foods to authenticated;
grant insert (source_id, owner_user_id, household_id, name, variant, aliases, basis_unit, basis_amount,
  kcal_per_basis, protein_g_per_basis, carbs_g_per_basis, fat_g_per_basis, provenance)
  on public.foods to authenticated;
grant update (household_id, name, variant, aliases, kcal_per_basis, protein_g_per_basis, carbs_g_per_basis,
  fat_g_per_basis, provenance, archived_at)
  on public.foods to authenticated;
grant select, insert, delete on public.food_servings to authenticated;
grant select, delete on public.meals to authenticated;
grant insert (owner_user_id, household_id, local_date, meal_type, custom_label, visibility, note) on public.meals to authenticated;
grant update (local_date, meal_type, custom_label, visibility, note) on public.meals to authenticated;
grant select, delete on public.meal_items to authenticated;
grant insert (meal_id, food_id, food_name, food_variant, source_label, provenance, basis_unit, basis_amount,
  kcal_per_basis, protein_g_per_basis, carbs_g_per_basis, fat_g_per_basis, quantity, serving_label,
  serving_count, client_request_id)
  on public.meal_items to authenticated;
grant update (quantity, serving_label, serving_count) on public.meal_items to authenticated;
grant select on public.nutrition_days to authenticated;
grant insert (owner_user_id, local_date, is_complete) on public.nutrition_days to authenticated;
grant update (is_complete) on public.nutrition_days to authenticated;
grant update (meal_id) on public.meal_items to authenticated;

-- weight goals
grant select on public.energy_profiles to authenticated;
grant insert (user_id, formula_sex, birth_date, height_cm, activity_level, maintenance_mode,
  maintenance_kcal_manual, daily_intake_target_kcal, weight_visibility) on public.energy_profiles to authenticated;
grant update (formula_sex, birth_date, height_cm, activity_level, maintenance_mode,
  maintenance_kcal_manual, daily_intake_target_kcal, weight_visibility) on public.energy_profiles to authenticated;
grant select on public.weight_goals to authenticated;
grant insert (user_id, goal_type, start_weight_kg, start_date, target_weight_kg, target_date, effective_from)
  on public.weight_goals to authenticated;
grant select, delete on public.weight_entries to authenticated;
grant insert (user_id, local_date, weight_kg, note, client_request_id) on public.weight_entries to authenticated;
grant update (weight_kg, note) on public.weight_entries to authenticated;
grant select on public.weight_entry_revisions to authenticated;

-- travel
grant select, delete on public.places to authenticated;
grant insert (household_id, created_by, visibility, name, locality, region, country_code, country_name, latitude,
  longitude, source, source_ref, is_wishlist, note, client_request_id) on public.places to authenticated;
grant update (name, locality, region, country_code, country_name, latitude, longitude, is_wishlist, note)
  on public.places to authenticated;
grant select, delete on public.visits to authenticated;
grant insert (place_id, created_by, started_on, ended_on, note, client_request_id) on public.visits to authenticated;
grant update (started_on, ended_on, note) on public.visits to authenticated;
grant select, insert, delete on public.visit_members to authenticated;
