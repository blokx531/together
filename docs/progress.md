# Progress and handoff

_Last updated: 2026-11-21 (cloud session, built without a laptop or browser access to provider dashboards)._

## Where things are

The project lives in `together/` inside the `practice` repository until it moves to its own repository
([ADR 0001](decisions/0001-project-location.md)). Branch: `claude/cloud-foundation-setup-jtqxg9`.

| Phase                        | Status                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Foundation                | done — tooling, design tokens (light/dark), shell, PWA shell + manifest, CI file, docs                                                                        |
| 1. Auth + pairing            | done — email/password, two-person household, single-use hashed invite links, RLS everywhere                                                                   |
| 2. Money                     | done — exact paise splits, balances in SQL, settlements, void/undo, audit, idempotency, CSV export                                                            |
| 3. Lists                     | done — presets, private/shared, typed details, fractional ordering, conflict-safe edits, search, archive                                                      |
| 4. Nutrition                 | done — licensed catalog (179 foods), aliases, servings, custom foods, snapshots, partner view, copy day, completeness                                         |
| 5. Weight & goals            | done — maintenance (formula or manual), intake target, versioned goals, audited weigh-ins, chart, sharing                                                     |
| 6. Optional food AI          | **not built** — provider chosen (Cloudflare Workers AI; Gemini opt-in fallback). Needs a Cloudflare account + a Worker; manual logging is complete without it |
| 7. Travel                    | done — places/visits/visitors, wishlist, filters, stats, lazy MapLibre map with list fallback, Photon search + manual coordinates                             |
| 8. Dashboard, export, polish | done — Home cards for every module, JSON data export, performance measured. **Deploy not done** (needs accounts)                                              |

## Needs a human (laptop + browser)

1. **GitHub access:** pushes from the cloud session were refused (Claude GitHub App not authorised for
   `blokx531/practice`). Fix at https://claude.ai/customize/connectors (reconnect GitHub) and/or install the app at
   https://github.com/apps/claude/installations/select_target, then push the branch.
2. **Move to its own repository:** create an empty repo (e.g. `together`), then from `practice`:
   `git subtree split --prefix together -b together-main && git push <new-remote> together-main:main`. CI starts
   running there.
3. **Supabase:** create a free project; Auth → turn **off** "Confirm email"; `npx supabase link --project-ref <ref>`
   and `npx supabase db push` (applies all migrations, including the food catalog).
4. **Cloudflare Pages:** connect the repo, build `npm run build`, output `dist`, env `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable key only). Add the Pages URL in Supabase → Auth → URL configuration.
5. Both partners sign up; one creates the space and sends the invite link; then turn **off** sign-ups in Supabase.
6. Check from a real network: map tiles load on World, place search returns results, Lighthouse on the live URL.

## Next engineering steps (in order)

1. Optional food AI (Phase 6): Cloudflare Worker proxy that verifies the Supabase JWT (JWKS), rate-limits, calls
   Workers AI for text parsing / photo recognition, validates output with a strict schema, and returns _candidates_
   for the user to review — never auto-saves. Add a local rule-based parser for "2 rotis, 1 katori dal" as the
   no-AI fallback.
2. Barcode lookup via Open Food Facts (runtime only, attribution, 15 req/min).
3. Account/household leave and deletion flow (expenses intentionally block deleting a profile that appears in
   shared money history; design the hand-over before enabling deletion).
4. Automated accessibility audit (axe) and console-error assertions in E2E.
5. Consider importing `@supabase/auth-js` + `@supabase/postgrest-js` directly to trim ~20 KB from startup.

## Resume locally

```bash
cd together
npm ci
npm run db:start                     # Docker required
npx supabase status -o env           # copy API_URL + PUBLISHABLE_KEY into .env.local (see .env.example)
npm run test && npm run test:integration
npx playwright install chromium      # once
npm run test:e2e
npm run dev                          # http://127.0.0.1:5173
```
