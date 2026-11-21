# Progress and handoff

_Last updated on 2026-11-21 while preparing the release-hardening pull request from `e569f80`._

## Start here

The original PRD is in the chat attachments. Its attached `AGENTS.md` is byte-identical to the
committed contract. This slice covers explicit Food sharing (PRD §§4.2 and 5), test isolation
(§15), and export completeness (§§12.4 and 18). The existing stack and cost target still apply.

## This slice

- [Meal visibility migration](../supabase/migrations/20261121000800_meal_visibility.sql) defaults new
  profiles to private. Existing meals and account preferences are preserved. Log, copy, and move
  reject a conflicting destination audience. The [Add food sheet](../src/features/nutrition/components/AddFoodSheet.tsx)
  shows the saved audience of an existing slot and refreshes after a conflict without discarding the portion.
- [Playwright](../playwright.config.ts) validates Vite's production-mode backend configuration
  before startup, then builds and serves a separate preview with those validated settings.
  Integration tests share the loopback check and invoke the local CLI through the Windows shim when needed.
- [JSON export](../src/features/settings/data/exportData.ts) iterates every visible page in primary-key
  order, including composite keys. It stops with an error if the available count changes during pagination.
  The archive is still version 1 and is read through the caller's RLS.

## Next pickup

1. Run the updated database integration and Playwright suites with a disposable Supabase stack,
   including the new visibility and large-export regressions. Verify CLI logical backup and restore
   with synthetic accounts in a fresh disposable target.
2. Follow the release checklist. Apply migration `…0800` before the new frontend is made live.
   Do the preview smoke test with two test accounts before entering personal records.
3. Continue the PRD backlog after the core release. Saved recipes, favorites, and edit/move controls
   for whole meals remain open. The current daily copy calls one transaction per meal.

## What the previous agent built

The standalone repository contains seven commits. `ccba8d9` added the app foundation and pairing,
`edc7b04` added Money, `5223440` added Lists, `3bc681a` added Food and Weight & goals, `7c9f228`
added World, and `4b33d9c` added JSON export, PWA/session tests, and handoff docs. `e569f80` updated
the CI and docs after the repository move. See [ADR 0001](decisions/0001-project-location.md).

| Area              | Implementation and entry points                                                                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation        | [App routes](../src/app/App.tsx) gate sessions and households before rendering the responsive shell. [Shared hooks](../src/shared/lib/) manage resource loads and mutations. [PWA worker](../pwa/sw.js) caches the shell and assets for offline startup. |
| Auth and pairing  | [Auth](../src/features/auth/) and [Household](../src/features/household/) implement email/password, onboarding, and hashed single-use invitations for a maximum of two members. Migration `…0100` establishes membership helpers, grants, and RLS.       |
| Money             | [Expenses](../src/features/expenses/) implements integer-paise splits, monthly spending, CSV, and settlements. Migration `…0200` computes balances, validates atomic writes, and records corrections.                                                    |
| Lists             | [Lists](../src/features/lists/) implements private/shared presets, typed item details, search, and fractional ordering. Migration `…0300` provides policies and revisions used to reject stale item text edits.                                          |
| Food              | [Nutrition](../src/features/nutrition/) implements manual logging, 179 catalog foods, custom foods, portion editing, partner views, copy day, and completeness. Migrations `…0400` and `…0500` handle snapshots, calculations, and catalog seed data.    |
| Weight and goals  | [Weight goals](../src/features/weight-goals/) implements weigh-ins, versioned goals, maintenance estimates, trends, and optional sharing. Migration `…0600` enforces privacy and audits weight changes.                                                  |
| World             | [Travel](../src/features/travel/) implements places, visits and visitors, wishlist, filters, manual coordinates, Photon search, and lazy MapLibre. Migration `…0700` handles saved places and visits.                                                    |
| Home and settings | [Dashboard](../src/features/dashboard/) composes feature summaries. [Settings](../src/features/settings/) manages profile, timezone, password, invite access, and JSON download.                                                                         |

Read [AGENTS.md](../AGENTS.md) before implementation. [Architecture](architecture.md),
[Data model](data-model.md), and [Testing](testing.md) describe the feature boundaries, schema, and suites.

## Verification

- This slice passed typecheck, ESLint, formatting with `--end-of-line auto` for the Windows checkout,
  all 156 unit tests across 18 files, and the production build. The configured preview's entry JS
  was 137.47 kB gzip. The Playwright CLI refused a hosted backend and accepted a loopback endpoint.
- All eight migrations applied in disposable PostgreSQL 18.7 with synthetic Auth identities. The
  upgrade preserved existing settings, defaulted new accounts to private, preserved idempotent writes,
  rejected conflicting log/copy/move calls, and enforced partner and outsider RLS in the checks run.
- Edge on phone and desktop viewports passed the Food audience and conflict/retry smoke with controlled
  API responses. The checked-in PWA manifest and offline-shell tests passed all four browser cases
  through the dedicated Playwright preview using Edge.
- Full-stack integration stopped at local Supabase setup because this Windows workspace lacks Docker
  and the native CLI binary. The authenticated Playwright journeys and CLI backup/restore rehearsal
  require separate verification. The pull request's GitHub Actions run is the full-stack gate for
  this slice.

### Baseline before this slice

- [CI for e569f80](https://github.com/blokx531/together/actions/runs/44875430067) completed successfully
  with Node 22 on Ubuntu. The install, formatting, lint, type check, unit tests, disposable Supabase
  integration tests, and Playwright steps all passed. Playwright runs the production build.
- [Testing](testing.md) records the previous agent's counts as 146 unit/UI, 69 database integration,
  and 46 browser test cases. Those counts are from the previous cloud session.
- On Windows with Node 24, app and tooling type checks, ESLint, all 146 unit/UI tests, and the Vite
  build passed. The entry JS chunk was 137.42 kB gzip. The food catalog generator reproduced the
  committed SQL seed exactly. The clone has no Docker, WSL, or `.env.local`, so database and browser
  suites were verified through CI.
- A cached `npm ci --offline` installed frontend tooling after the online install stalled fetching the
  optional native Supabase CLI package. Install the CLI package online before starting the local stack.
- The default Windows Git checkout uses CRLF. The standard Prettier check flagged those line endings.
  The same check with `--end-of-line auto` passed, and the edited handoff passed the standard check.
- GitHub reported `main` is unprotected and returned no GitHub deployment records. The previous
  handoff reports the hosted release pending. Provider dashboards and a live app URL are unverified.

## Release checklist

1. Protect `main` and require the CI check before enabling production deploys.
2. Create the Supabase free project. Turn off email confirmation as recorded in
   [ADR 0002](decisions/0002-auth-without-email.md). Link the intended project and push migrations
   with `npx supabase link --project-ref <ref>` and `npx supabase db push`.
3. Connect Cloudflare Pages to the repo, build with `npm run build`, and serve `dist`. Provide
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Add the Pages site URL and redirects to
   Supabase Auth. See [README](../README.md#deploying-needs-a-browser-and-accounts--not-automated-yet).
4. Verify the two accounts and invite flow. Turn off new sign-ups after both partners have joined.
5. Verify OpenFreeMap tiles, Photon place search, PWA installation, and mobile Lighthouse on the
   live URL. Test account recovery and keep a verified private backup.

## Later work

- Phase 6 food AI has a researched provider choice (Cloudflare Workers AI, with Gemini as an
  opt-in fallback). Start with a local parser for entries such as “2 rotis, 1 katori dal”. If adding
  a Worker, verify the Supabase session, rate-limit it, validate candidate output, require user
  confirmation, and apply the retention and opt-in rules in [AGENTS.md](../AGENTS.md).
- Add Open Food Facts barcode lookup at runtime with attribution. Recheck the current usage terms.
- Add saved recipes with versioning that preserves old meal snapshots, as specified in [AGENTS.md](../AGENTS.md).
- Design account/household leave and deletion around shared money history before enabling deletion.
- Add automated accessibility, console error, and failed-request coverage to browser tests.
- Test list ordering when two partners append from the same starting position. [Quick add](../src/features/lists/pages/ListDetailPage.tsx)
  derives the same key for both, and [moving an item](../src/features/lists/domain/ordering.ts) can
  then ask fractional indexing for a key between equal bounds.
- Repair or remove `npm run size`, which references a missing `scripts/report-bundle-size.mjs`.
  Revisit the smaller Supabase client imports if startup approaches its bundle budget.

## Resume locally

Use Node 22+ and a running Docker installation. Keep the E2E build pointed at the disposable stack.

```bash
npm ci
npm run db:start
npx supabase status -o env
# Copy API_URL and PUBLISHABLE_KEY into .env.local using .env.example.
npm run test
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run dev
```

Update this file as work progresses. Record the baseline commit, the change, the checks actually run,
and the first unresolved action so the next agent can resume from here.
