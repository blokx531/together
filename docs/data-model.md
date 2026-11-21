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
