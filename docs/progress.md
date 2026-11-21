# Progress and handoff

_Last updated: 2026-11-21._

## Where things are

The project lives in `together/` inside the `practice` repository until it moves to its own repository
([ADR 0001](decisions/0001-project-location.md)). Work happens on branch `claude/cloud-foundation-setup-jtqxg9`.

| Phase                                                                   | Status                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------- |
| 0. Foundation (tooling, design tokens, shell, PWA shell, CI file, docs) | done                                           |
| 1. Auth + household pairing + RLS                                       | done (integration + E2E green)                 |
| 2. Money                                                                | not started                                    |
| 3. Lists                                                                | not started                                    |
| 4. Nutrition                                                            | not started (datasets chosen)                  |
| 5. Weight & goals                                                       | not started                                    |
| 6. Optional food AI                                                     | not started (provider chosen)                  |
| 7. Travel map                                                           | not started (providers chosen)                 |
| 8. Dashboard polish, deploy                                             | not started; deploy needs the owner's accounts |

## Needs a human (browser/accounts)

1. Create the new GitHub repository and move `together/` there (see ADR 0001) so CI runs.
2. Create the Supabase project and Cloudflare Pages project (README → Deploying).
3. Disable Supabase sign-ups after both partners have accounts.

## Resume

```bash
cd together
npm ci
npm run db:start && npx supabase status -o env   # fill .env.local from API_URL + PUBLISHABLE_KEY
npm run test && npm run test:integration && npm run test:e2e
npm run dev
```
