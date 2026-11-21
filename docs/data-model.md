# Data model

All tables live in `public`, have RLS enabled, and are granted to `authenticated` explicitly (the `anon` role
has no table privileges). Helper functions used by policies live in the non-exposed `private` schema and are
`SECURITY DEFINER` with an empty `search_path`. Migrations: `supabase/migrations/`.

## Ownership vocabulary

| Term                       | Meaning                                                        |
| -------------------------- | -------------------------------------------------------------- |
| owner (`owner_user_id`)    | The person who created/owns a personal record                  |
| household (`household_id`) | The shared space a record belongs to                           |
| readable by                | Who may `SELECT` it (enforced by RLS)                          |
| writable by                | Who may `INSERT/UPDATE/DELETE` it (RLS + column grants + RPCs) |

## Households (migration `20261121000100_households.sql`)

| Table                   | Key columns                                                                         | Constraints                                                                  | Readable by                               | Writable by                                              |
| ----------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `profiles`              | `user_id` PK → `auth.users`, `display_name`, `time_zone`, `default_meal_visibility` | name 1–40 chars; time zone must exist in `pg_timezone_names` (trigger)       | self and partner                          | self; only name, time zone, meal default (column grants) |
| `households`            | `id`, `name`, `created_by`                                                          | name 1–60 chars                                                              | members                                   | members (name only); created via `create_household()`    |
| `household_members`     | (`household_id`, `user_id`) PK, `role`                                              | one household per user (unique); **max two members** (trigger with row lock) | members                                   | nobody directly; RPCs only                               |
| `household_invitations` | `id`, `token_hash` (unique), `expires_at`, `redeemed_*`, `revoked_at`               | redeemed consistency check                                                   | members (all columns except `token_hash`) | RPCs only                                                |

Profiles are created by the `on_auth_user_created` trigger from the sign-up `display_name`. No email address
is stored in `public`.

### RPCs

| Function                              | Rules                                                                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create_household(name)`              | Caller must not already be in a household; creates household + owner membership atomically                                                                                                 |
| `create_household_invitation()`       | Caller must be a member and the household must have fewer than two members; revokes any outstanding invite; returns a 256-bit hex token once (only its SHA-256 is stored); expires in 72 h |
| `preview_household_invitation(token)` | Signed-in only; returns household + inviter names for a live token, else no rows                                                                                                           |
| `accept_household_invitation(token)`  | Locks the invite row; rejects unknown/revoked/used (`INVITE_INVALID`), expired (`INVITE_EXPIRED`), already-member (`ALREADY_IN_HOUSEHOLD`), full (`HOUSEHOLD_FULL`)                        |
| `revoke_household_invitation(id)`     | Only for an open invite of the caller's household                                                                                                                                          |

### Policy helpers

| Helper                                      | Answers                                          |
| ------------------------------------------- | ------------------------------------------------ |
| `private.current_household_id()`            | The caller's household id (or null)              |
| `private.is_household_member(household_id)` | Is the caller a member of that household?        |
| `private.is_self_or_partner(user_id)`       | Is that user the caller or the caller's partner? |

## Money (migration `20261121000200_money.sql`)

| Table               | Key columns                                                                                                                                                                                                                                               | Constraints                                                                                                        | Readable by                                              | Writable by                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `expenses`          | `household_id`, `created_by`, `payer_user_id`, `scope` (personal/shared), `visibility` (private/household), `split_method`, `amount_paise` bigint, `currency` (INR), `category`, `spent_on` date, `client_request_id` (unique), `version`, `voided_at/by` | amount 1 paisa – ₹10 crore; shared ⇒ household-visible; personal ⇔ method `personal`; category list                | members, except private personal expenses (creator only) | create as self via `save_expense`; shared: either member; personal: creator only; never deleted (void) |
| `expense_splits`    | (`expense_id`, `user_id`) PK, `share_paise`, `percent_basis_points`                                                                                                                                                                                       | share ≥ 0; **sum = amount** (deferred constraint trigger); users must be members; personal = one row for the payer | follows the expense                                      | follows the expense (RPC replaces all rows atomically)                                                 |
| `expense_revisions` | `expense_id`, `changed_by`, `change` (update/void/restore), `previous` jsonb                                                                                                                                                                              | written only by trigger                                                                                            | follows the expense                                      | nobody                                                                                                 |
| `settlements`       | `from_user_id`, `to_user_id`, `amount_paise`, `settled_on`, `client_request_id` (unique), `voided_at/by`                                                                                                                                                  | distinct people, both members                                                                                      | members                                                  | create as self via `record_settlement`; void via `set_settlement_voided`                               |

`version` is bumped by trigger on every update; `save_expense`/`set_expense_voided` require the version the
client loaded (`STALE_EXPENSE` otherwise). `voided_by` is always set to the caller by trigger (cannot be spoofed).

### Money RPCs (all `SECURITY INVOKER`, so RLS still applies to every statement)

| Function                                  | Behaviour                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `save_expense(...)`                       | Create (idempotent per `p_client_request_id`, including concurrent duplicates) or update with optimistic concurrency; replaces splits in the same transaction |
| `set_expense_voided(id, version, voided)` | Void or restore; balances exclude voided expenses                                                                                                             |
| `record_settlement(...)`                  | Idempotent per request id                                                                                                                                     |
| `set_settlement_voided(id, voided)`       | Void or restore a settlement                                                                                                                                  |
| `household_balances()`                    | Per member: paid − shares on live shared expenses + settlements paid − settlements received. Sums to zero                                                     |

### Calculation rules

- Equal and percentage splits allocate in integer paise; the leftover paisa goes to the larger fractional
  remainder, ties to the payer (`src/features/expenses/domain/splits.ts`). The database only checks that the
  shares add up; the allocation choice is the user's.
- Spending analytics (`domain/analytics.ts`) sum visible, non-voided expenses once each; settlements are never
  an input. "Paid" and "share" per person are shown separately.
- Refunds/negative amounts are not supported in v1: correct an expense by editing or deleting it.

## Lists (migration `20261121000300_lists.sql`)

| Table        | Key columns                                                                                                                                           | Constraints                                                                                                   | Readable by                   | Writable by                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `lists`      | `household_id`, `owner_user_id`, `visibility`, `kind` (todo/grocery/watch/ideas/packing/custom), `title`, `emoji`, `archived_at`, `client_request_id` | title 1–60 chars                                                                                              | owner; members if `household` | create as owner; edit if readable; **visibility only by owner** (trigger); delete only by owner (cascades items) |
| `list_items` | `list_id`, `created_by`, `text`, `note`, `is_done`, `done_at/by`, `position` (text, `COLLATE "C"`), `details` jsonb, `revision`, `client_request_id`  | `details` validated per list kind by trigger (known keys, types, http(s) links, assignee is a member); ≤ 2 KB | follows the list              | follows the list; `created_by`, `done_by`, `revision` set by trigger                                             |

- **Ordering:** fractional-index keys (`fractional-indexing`, CC0). Moving an item writes only that item.
- **Concurrency:** text/note/details edits are sent with `.eq('revision', loaded)`; zero updated rows means a
  conflict (`STALE_ITEM`) and the UI refetches instead of overwriting. Ticking is an absolute intent and applies
  regardless of revision. Duplicate inserts are dropped via `client_request_id` (`upsert … ignoreDuplicates`).

## Nutrition (migrations `…0400_nutrition.sql`, `…0500_food_catalog.sql`)

| Table            | Key columns                                                                                                                                                                                                                          | Constraints                                                                             | Readable by                                       | Writable by                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------- |
| `food_sources`   | `id`, `license`, `attribution`                                                                                                                                                                                                       | reference data                                                                          | everyone signed in                                | migrations only                             |
| `foods`          | `source_id`, `source_ref`, `owner_user_id` (null = catalog), `household_id` (custom food shared), `basis_unit` (g/ml/serving), `basis_amount` (100 or 1), `kcal_per_basis`, macros, `provenance`, `aliases`, generated `search_text` | kcal ≤ 900/100 g, ≤ 5000/serving; catalog ⇔ no owner; unique (`source_id`,`source_ref`) | catalog: all; custom: owner, or members if shared | owner only (custom); catalog via migrations |
| `food_servings`  | `food_id`, `label`, `amount` (in basis units)                                                                                                                                                                                        | amount > 0                                                                              | follows the food                                  | food owner                                  |
| `meals`          | `owner_user_id`, `household_id`, `local_date`, `meal_type`, `custom_label`, `visibility`                                                                                                                                             | one per (owner, date, type, label)                                                      | owner; partner if `household`                     | owner                                       |
| `meal_items`     | snapshot of the food (`food_name`, `basis_*`, `kcal_per_basis`, macros, `source_label`, `provenance`), `quantity`, `serving_label/count`, **generated** `kcal`/macros, `client_request_id`                                           | quantity > 0; meal deleted when its last item goes                                      | follows the meal                                  | meal owner (portion only)                   |
| `nutrition_days` | (`owner_user_id`, `local_date`), `is_complete`                                                                                                                                                                                       | —                                                                                       | self and partner                                  | self                                        |

- **Snapshots:** `log_food` copies the food's values server-side from a row the caller can read, so history never
  changes when a food is edited and a client cannot claim catalog provenance for invented numbers.
- **Calculation:** `kcal = round(quantity / basis_amount × kcal_per_basis, 2)` (generated column); the client preview
  uses the same formula (`domain/calories.ts`). Day totals are sums of items; macro totals are hidden unless every
  item has them.
- **RPCs:** `log_food` (idempotent), `copy_meal` (idempotent via uuid v5 of request id + item id), `move_meal` (merges),
  `set_day_complete`, `my_daily_intake(from, to)` (days with no food are absent, never zero).

## Weight & goals (migration `…0600_weight_goals.sql`)

| Table                    | Key columns                                                                                                                                                                 | Readable by                       | Writable by                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------- |
| `energy_profiles`        | `formula_sex`, `birth_date`, `height_cm`, `activity_level`, `maintenance_mode` (formula/manual), `maintenance_kcal_manual`, `daily_intake_target_kcal`, `weight_visibility` | **self only**                     | self                                              |
| `weight_goals`           | `goal_type`, `start_weight_kg`, `start_date`, `target_weight_kg`, `target_date`, `effective_from` (versioned; newest wins)                                                  | self; partner if weight is shared | self (insert only — history is never overwritten) |
| `weight_entries`         | `local_date` (unique per user), `weight_kg` 20–350                                                                                                                          | self; partner if shared           | self (`record_weight` corrects same-day entries)  |
| `weight_entry_revisions` | previous value of every correction/deletion (trigger)                                                                                                                       | self                              | trigger only                                      |

`partner_weight_shared()` tells a partner only whether sharing is on. Energy maths lives in
`src/features/weight-goals/domain/` (Mifflin-St Jeor × activity factor; deficit = maintenance − eaten; remaining to
target = target − eaten; intake projection at ~7,700 kcal/kg using complete days only; observed trend needs ≥ 3
weigh-ins over ≥ 14 days).

## Travel (migration `…0700_travel.sql`)

| Table           | Key columns                                                                                                                                                                                          | Constraints                                          | Readable by                | Writable by                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------- | -------------------------- |
| `places`        | `household_id`, `created_by`, `visibility`, `name`, `locality`, `region`, `country_code` (ISO-2), `latitude`/`longitude`, `source` (manual/photon), `source_ref`, `is_wishlist`, `client_request_id` | coordinates in range                                 | creator; members if shared | creator; members if shared |
| `visits`        | `place_id`, `started_on`, `ended_on` (null = single day), `note`, `client_request_id`                                                                                                                | end ≥ start                                          | follows the place          | follows the place          |
| `visit_members` | (`visit_id`, `user_id`)                                                                                                                                                                              | members only; private place ⇒ creator only (trigger) | follows the visit          | follows the visit          |

"Visited" = at least one visit; "wishlist" is a separate flag; "together" = a visit listing both people. RPCs:
`create_place` (place + optional first visit, idempotent) and `add_visit` (visit + visitors, idempotent).
