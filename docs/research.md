# Research log

Dated research behind dependency and provider choices. Each detailed log lists its sources (with access
dates), what could and could not be verified, and open uncertainties. Exa was used for discovery; official
documentation was read for confirmation (some hosts were unreachable from the build sandbox — noted in the logs).

| Date       | Topic                                                       | Log                                                         |
| ---------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| 2026-11-21 | Supabase, Cloudflare, frontend packages, maps/geocoding     | [platform-2026-11-21.md](research/platform-2026-11-21.md)   |
| 2026-11-21 | Indian nutrition datasets, licensing, optional AI providers | [nutrition-2026-11-21.md](research/nutrition-2026-11-21.md) |

## Decisions taken from the research

| Area             | Choice                                                                     | Fallback / note                                                             |
| ---------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Auth email       | No confirmation emails; invite links for pairing                           | Optional free SMTP later ([ADR 0002](decisions/0002-auth-without-email.md)) |
| Hosting          | Cloudflare Pages                                                           | Workers static assets ([ADR 0003](decisions/0003-cloudflare-pages.md))      |
| Table exposure   | Explicit `GRANT`s on every table (`auto_expose_new_tables = false`)        | Matches Supabase's 2026-10-30 default                                       |
| TypeScript       | 6.0.x                                                                      | 7.x is not yet supported by typescript-eslint                               |
| Router           | wouter (~2.4 KB gzip measured)                                             | react-router declarative mode                                               |
| Validation       | Hand-written env check on the startup path; Zod only inside feature chunks | Full Zod cost 22.7 KB gzip when it was on the startup path                  |
| Food catalog     | Katori dataset (CC BY 4.0), UK CoFID 2021 (OGL v3.0), USDA FDC (CC0)       | Custom foods; IFCT 2017 and INDB are **not** redistributable                |
| Barcodes         | Open Food Facts at runtime only (ODbL, attribution)                        | Manual entry from the label                                                 |
| Optional food AI | Cloudflare Workers AI (free daily Neurons, no retention)                   | Gemini free tier only with explicit opt-in (inputs may be human-reviewed)   |
| Map              | MapLibre GL (lazy route) + OpenFreeMap tiles (keyless)                     | Style URL configurable; saved places always listed as text                  |
| Place search     | Photon (komoot public instance), debounced, ≥3 chars                       | Manual coordinates / tap-on-map                                             |
| Country shapes   | Natural Earth 110m (public domain)                                         | —                                                                           |
