# Together

A private, installable web app (PWA) for two partners: food and calories (Indian food first),
weight goals, personal and shared money with exact splits, shared lists, and a travel map.

- **Frontend:** React 19 + Vite 8 + strict TypeScript + Tailwind CSS 4, routed with `wouter`.
- **Backend:** Supabase (Auth + Postgres). Every table has Row Level Security; multi-row writes go
  through Postgres functions. There is no custom server.
- **Hosting:** Cloudflare Pages (static). An optional Pages Function may proxy AI requests later.
- **Cost target:** ₹0/month on free tiers. See [`docs/cost-and-quotas.md`](docs/cost-and-quotas.md).

`AGENTS.md` is the binding engineering contract for anyone (human or AI) changing this code.

## What it does

- **Home:** today's calories, this month's spending and balance, busiest lists, travel summary.
- **Food:** search 179 licensed foods (Indian dishes from the Katori dataset, staples from UK CoFID) with Indian
  spellings (roti/chapati, dal/daal…), household servings (katori, plate, piece), custom foods from labels or
  estimates, per-meal privacy, partner's shared diary, "same as yesterday", day-complete flag, energy balance
  against an estimated or manual maintenance value. **Weight & goals:** versioned goals, weekly weigh-ins (audited),
  measured vs. estimated chart, optional sharing.
- **Money:** personal and shared expenses in integer paise, equal/custom/percentage splits with exact rounding,
  net balance computed in Postgres, settlements that never count as spending, filters, CSV export.
- **Lists:** to-do, groceries (quick add "Atta 5 kg"), watchlist, ideas, packing, custom; private or shared;
  reorder; edits never silently overwrite your partner's.
- **World:** stamp visited places (who went, when), wishlist, Mine/Partner/Together filters, map (lazy-loaded).
- **Settings:** profile, time zone, invite link, password, JSON export of your data.

## Prerequisites

- Node.js 22+ and npm
- Docker (for the local Supabase stack used in development and tests)

## Local development

```bash
npm ci
npm run db:start            # starts Postgres + Auth + REST locally and applies migrations
npx supabase status -o env  # prints API_URL and PUBLISHABLE_KEY for the next step
cp .env.example .env.local  # then fill VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                 # http://127.0.0.1:5173
```

Local auth has email confirmation turned off, so sign-up signs you in immediately. Use two
different browsers (or a private window) to act as both partners.

Useful database commands:

| Command            | What it does                                                     |
| ------------------ | ---------------------------------------------------------------- |
| `npm run db:reset` | Recreates the local database from `supabase/migrations`          |
| `npm run db:types` | Regenerates `src/shared/types/database.ts` from the local schema |
| `npm run db:stop`  | Stops the local stack                                            |

## Quality gates

| Command                    | Scope                                                          |
| -------------------------- | -------------------------------------------------------------- |
| `npm run format:check`     | Prettier                                                       |
| `npm run lint`             | ESLint with type-aware rules, React hooks and jsx-a11y         |
| `npm run typecheck`        | `tsc` for app and tooling                                      |
| `npm run test`             | Vitest unit/UI tests (no network)                              |
| `npm run test:integration` | RLS, constraints and RPCs against the **local** Supabase stack |
| `npm run test:e2e`         | Playwright on the production build, phone + desktop viewports  |
| `npm run build`            | Typecheck + production build                                   |

Integration and E2E tests require loopback Supabase endpoints. E2E reads the production-mode Vite
settings, normally from `.env.local`, and starts its own preview on port 4173. For E2E, install Chromium
once with `npx playwright install chromium`.

## Deploying (needs a browser and accounts — not automated yet)

1. **Supabase:** create a free project. In _Authentication → Sign In / Providers_, keep Email
   enabled and turn **off** "Confirm email" (see [ADR 0002](docs/decisions/0002-auth-without-email.md)).
   Link and push migrations: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
2. **Cloudflare Pages:** connect the repository, build command `npm run build`, output `dist`,
   environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable key
   only — never the secret key).
3. Add the Pages URL to Supabase _Authentication → URL Configuration_ (Site URL + redirect URLs).
4. Both partners sign up; one creates the space and sends the invite link to the other.
5. Turn **off** "Allow new users to sign up" in Supabase once both accounts exist.

## Documentation

- [Architecture](docs/architecture.md) · [Data model](docs/data-model.md) ·
  [Privacy & permissions](docs/privacy-and-permissions.md)
- [Research log](docs/research.md) · [Cost & quotas](docs/cost-and-quotas.md)
- [Testing](docs/testing.md) · [Performance](docs/performance.md) · [Progress & handoff](docs/progress.md)
- [Decision records](docs/decisions/)
