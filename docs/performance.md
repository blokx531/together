# Performance

Budget (PRD §13.1): startup JavaScript ≤ 180 KB gzip; map, charts and other heavy features load only when opened;
LCP < 2.5 s, CLS < 0.1, INP < 200 ms on representative mobile conditions.

## Bundle (production build, 2026-11-21)

| Chunk                                                        | gzip                       | Loaded when                                                |
| ------------------------------------------------------------ | -------------------------- | ---------------------------------------------------------- |
| `index` (React, supabase-js, router, shell, auth, household) | **137.5 KB**               | always (startup)                                           |
| `index.css`                                                  | 7.6 KB                     | always                                                     |
| `HomePage`                                                   | 1.9 KB                     | Home                                                       |
| `FoodPage` + `nutritionApi`                                  | 6.7 + 2.5 KB               | Food                                                       |
| `ProgressPage` + `energy`                                    | 6.0 + 1.8 KB               | Weight & goals                                             |
| `MoneyPage` + `balance`                                      | 7.6 + 1.8 KB               | Money                                                      |
| `ListsPage`, `ListDetailPage`, `listsApi`                    | 2.1, 4.5, 4.1 KB           | Lists                                                      |
| `schemas` (zod/mini)                                         | 7.6 KB                     | Lists / World (validation of jsonb and external responses) |
| `WorldPage` + `places`                                       | 5.1 + 1.5 KB               | World                                                      |
| `TravelMap` (MapLibre GL 6)                                  | **293.5 KB** + 10.3 KB CSS | World only, after the page renders                         |
| `SettingsPage`                                               | 2.5 KB                     | Settings                                                   |

Evidence that the map is lazy: `tests/e2e/world.spec.ts` → "map code loads only on the World page" records every
script request on Home, Food, Money and Lists and asserts no `TravelMap`/MapLibre chunk is fetched, then asserts it
is fetched on World.

History: startup JS went from 161.1 KB to 137.5 KB by replacing Zod on the startup path (env validation) with a
hand-written check; Zod is used as `zod/mini` inside feature chunks only.

## Measured page load (2026-11-21)

Production build via `vite preview`, Playwright Chromium emulating a Pixel 7, CPU throttled 4×, network ~"slow 4G"
(150 ms RTT, 1.6 Mbps down). Page: `/sign-in` (the first page a signed-out visitor sees). 3 runs.

| Metric                           | Result        |
| -------------------------------- | ------------- |
| First / Largest Contentful Paint | 1.30 – 1.32 s |
| Cumulative Layout Shift          | 0             |
| Transferred                      | 145 KB        |

**Not measured yet:** a Lighthouse report (running Lighthouse was not permitted in the build sandbox) and INP on
signed-in pages. Run `npx lighthouse <url> --form-factor=mobile` against the deployed site from a laptop.

## Why each large dependency is there

| Dependency                                | gzip           | Why                                                    |
| ----------------------------------------- | -------------- | ------------------------------------------------------ |
| react + react-dom                         | ~68 KB         | UI runtime (required by the contract)                  |
| @supabase/supabase-js                     | ~56 KB         | Auth + PostgREST client                                |
| maplibre-gl                               | ~293 KB (lazy) | Interactive world map; only on World                   |
| zod/mini                                  | ~7.6 KB (lazy) | Runtime validation of jsonb and external API responses |
| wouter, lucide-react, fractional-indexing | ~2–3 KB each   | Routing, icons (tree-shaken), list ordering            |

## Known opportunities

- supabase-js bundles realtime/storage/functions clients that are unused. Importing `@supabase/auth-js` and
  `@supabase/postgrest-js` directly could save ~15–25 KB gzip on startup.
- The Money page loads the month's expenses and the balance separately (two requests in parallel); fine for two
  people.
