# Cost and quotas

Target: **₹0 per month**. Free tiers are not guarantees; limits below were read from provider documentation on
2026-11-21 (see the [research log](research.md) for sources). Re-check them when upgrading dependencies or if a
provider emails about plan changes.

| Provider                  | Used for                          | Free limits that matter                                                                                            | What happens at the limit                                                               | Our expected use                                   | Last verified |
| ------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------- |
| Supabase (Free)           | Auth, Postgres, RLS               | 500 MB database, 5 GB egress/month, 50k MAU, 2 free projects, **no backups**, pauses after ~7 days of low activity | Service restrictions; paused project can be resumed from the dashboard for up to 1 year | 2 users; text records only (well under 50 MB/year) | 2026-11-21    |
| Supabase Auth email       | (not used)                        | Built-in SMTP: team members only, ~2/hour                                                                          | Emails rejected                                                                         | None — see ADR 0002                                | 2026-11-21    |
| Cloudflare Pages (Free)   | Static hosting                    | 500 builds/month, 20,000 files, 25 MiB/file; static requests free and unlimited                                    | Builds queue/fail; site keeps serving the last deploy                                   | A few builds per week                              | 2026-11-21    |
| Cloudflare Workers (Free) | Optional AI proxy (not built yet) | 100,000 requests/day, 10 ms CPU/request                                                                            | Error 1027 until 00:00 UTC; manual logging unaffected                                   | < 100 requests/day                                 | 2026-11-21    |
| GitHub Actions            | CI                                | ~2,000 Linux minutes/month on private repos (Free)                                                                 | Jobs stop until the next cycle                                                          | ~8 min per run                                     | 2026-11-21    |
| OpenFreeMap               | Map tiles (planned)               | Keyless, no published request cap, no SLA                                                                          | Map area blank; place list still works                                                  | Map opened occasionally                            | 2026-11-21    |
| Photon (komoot)           | Place search (planned)            | Fair use, no published cap                                                                                         | Search fails; manual pin entry still works                                              | A few searches per trip                            | 2026-11-21    |

## Controls

- No service with a payment method is required or configured. No paid API is called from the client.
- The app stores no photos yet. If photo features are added, they must be compressed client-side and capped
  (see `AGENTS.md` §6).
- **Pausing:** daily use by two people is normally enough activity. If the owner gets Supabase's pause warning
  email, opening the app (or the dashboard) once resumes activity; a paused project is restored via
  _Dashboard → Resume project_.
- **Backups:** the Free plan has none. Use the in-app export (planned in Settings) or
  `npx supabase db dump --linked -f backup.sql` from a laptop, and store dumps privately (they contain personal data).
