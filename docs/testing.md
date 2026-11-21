# Testing

| Layer                                | Tool                                  | Location              | Needs                                    |
| ------------------------------------ | ------------------------------------- | --------------------- | ---------------------------------------- |
| Unit / UI                            | Vitest + Testing Library (jsdom)      | `src/**/*.test.ts(x)` | nothing                                  |
| Integration (RLS, constraints, RPCs) | Vitest + supabase-js + `pg`           | `tests/integration/`  | local Supabase (`npm run db:start`)      |
| End-to-end                           | Playwright (Pixel 7 + desktop Chrome) | `tests/e2e/`          | local Supabase + `.env.local` + Chromium |

Integration tests create real users through the local Auth admin API, sign in with a password, and call the REST API
exactly like the app does. A superuser `pg` connection is used only for fixture manipulation (e.g. expiring an invite).
Both refuse non-local hosts. E2E tests run the **production build** via `vite preview`, use role/label selectors and
Playwright's auto-waiting (no sleeps), and create fresh synthetic accounts (`*@example.test`) per test.

## Latest results (actual runs, 2026-11-21, in the cloud build container)

| Suite                                                       | Result                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| `npm run format:check`, `npm run lint`, `npm run typecheck` | clean                                                                   |
| `npm run test`                                              | 146 passed (16 files)                                                   |
| `npm run test:integration`                                  | 69 passed (5 files: households, money, lists, nutrition+weight, travel) |
| `npm run test:e2e`                                          | 46 passed (23 scenarios × mobile and desktop viewports)                 |
| `npm run build`                                             | passes; startup JS 137.5 KB gzip                                        |

## PRD browser scenarios (§15.2)

| #   | Scenario                                             | Covered by                                                                                  |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Sign-up/in, reload, sign-out, expired session        | `auth-and-pairing.spec.ts`                                                                  |
| 2   | Invite second account, shared household              | `auth-and-pairing.spec.ts` (+ reused-link rejection)                                        |
| 3   | A adds a shared meal; B sees entries and total       | `food.spec.ts`                                                                              |
| 4   | Independent food + serving changes                   | `food.spec.ts` (portion edit persists after reload)                                         |
| 5   | B enters weight + goal; chart; privacy               | `food.spec.ts` (private by default, explicit sharing)                                       |
| 6   | ₹1,200 groceries 50/50 → B owes ₹600                 | `money.spec.ts`                                                                             |
| 7   | B settles ₹600 → zero; spending unchanged            | `money.spec.ts`                                                                             |
| 8   | Both add/check grocery items; reload both            | `lists.spec.ts` (+ stale edit refused)                                                      |
| 9   | Stamp a city, open details, filter by visitor        | `world.spec.ts`                                                                             |
| 10  | Third account denied                                 | integration suites (every table) + `auth-and-pairing.spec.ts`                               |
| 11  | Optional AI failure                                  | **n/a — AI not built**; manual logging is the only path and is fully tested                 |
| 12  | Offline, repeated clicks, stale edits, invalid input | `money.spec.ts` (offline + retry once, double tap, invalid amount), `lists.spec.ts` (stale) |
| 13  | PWA manifest / install                               | `pwa.spec.ts` (manifest, icons, offline shell)                                              |
| 14  | Mobile emulation + desktop                           | every spec runs on both projects; other engines not installed                               |
| 15  | Keyboard, names, contrast, overflow                  | role/label selectors throughout; **no automated contrast/overflow audit yet**               |
| 16  | Console errors, failed requests                      | not asserted automatically yet                                                              |

## Bugs found by tests and fixed (with regression tests)

- The expense list's initial filter used `'all'` for a field that expected `null`, hiding every expense
  (`analytics.test.ts` → "shows every expense with the default filter").
- Saving the energy profile used an upsert that also tried to update `user_id`, which column grants forbid, so the
  save failed with "no access". Fixed with update-then-insert (`nutrition.test.ts` regression test).

## Not covered yet

- Live map tiles (OpenFreeMap) and place search (Photon): both hosts are blocked from the build sandbox; the code's
  failure paths are tested, the happy path needs a check from a real network.
- WebKit/Firefox, an automated accessibility audit (axe), Lighthouse.
