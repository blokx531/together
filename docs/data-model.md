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
