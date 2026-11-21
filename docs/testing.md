# Testing

| Layer                                | Tool                                  | Location              | Needs                                    |
| ------------------------------------ | ------------------------------------- | --------------------- | ---------------------------------------- |
| Unit / UI                            | Vitest + Testing Library (jsdom)      | `src/**/*.test.ts(x)` | nothing                                  |
| Integration (RLS, constraints, RPCs) | Vitest + supabase-js + `pg`           | `tests/integration/`  | local Supabase (`npm run db:start`)      |
| End-to-end                           | Playwright (Pixel 7 + desktop Chrome) | `tests/e2e/`          | local Supabase + `.env.local` + Chromium |

Integration tests create real users through the local Auth admin API, sign in with password, and call the REST
API exactly like the app does. A superuser `pg` connection is used only for fixture manipulation (for example,
moving an invitation's expiry into the past). Both refuse non-local hosts.

E2E tests run the **production build** via `vite preview`, use role/label selectors and Playwright's
auto-waiting (no sleeps), and create fresh synthetic accounts per test (`*@example.test`).

## Latest results

Recorded from actual runs; update this table whenever the suites change.

| Date       | Suite                      | Result                                   |
| ---------- | -------------------------- | ---------------------------------------- |
| 2026-11-21 | `npm run test`             | 51 passed (8 files)                      |
| 2026-11-21 | `npm run test:integration` | 18 passed (1 file)                       |
| 2026-11-21 | `npm run test:e2e`         | 10 passed (5 scenarios × mobile/desktop) |

## Not yet covered

- Expired-session handling in the browser (token refresh failure) — planned with the money slice.
- Offline/slow-network E2E scenarios.
- Non-Chromium engines (WebKit is not installed in the build sandbox).
