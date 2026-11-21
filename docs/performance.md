# Performance

Budget: initial-route JavaScript ≤ 180 KB gzip (PRD §13.1). Feature pages are separate lazy chunks; map and
chart code must never be part of the startup bundle.

## Measurements

| Date       | Startup JS (gzip) | Notes                                                    |
| ---------- | ----------------- | -------------------------------------------------------- |
| 2026-11-21 | 161.1 KB          | Zod on the startup path for env validation               |
| 2026-11-21 | **138.7 KB**      | Replaced startup Zod with a two-field hand-written check |

Breakdown of the startup bundle (analysis build with vendor groups, gzip): react + react-dom 68.3 KB,
supabase-js 56.3 KB, app code 10.6 KB, wouter 2.4 KB, lucide icons 2.4 KB. CSS 6.6 KB.

## Known opportunities

- supabase-js bundles realtime, storage and functions clients we do not use yet. Importing
  `@supabase/auth-js` + `@supabase/postgrest-js` directly could save roughly 15–25 KB gzip; deferred until the
  realtime decision for lists is made.
- Lighthouse / Core Web Vitals have not been measured yet (planned after the main features land).
