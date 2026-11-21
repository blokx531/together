# Architecture

```
Browser (PWA)                                   Supabase (free tier)
┌───────────────────────────────────────┐       ┌──────────────────────────────────────┐
│ src/app      routing, shell, gates    │       │ Auth (email + password)              │
│ src/features/<name>                   │ HTTPS │ PostgREST  ── RLS on every table ──┐ │
│   pages/ components/   (UI)           │──────▶│ RPC: SECURITY DEFINER functions    │ │
│   data/    adapters (supabase-js)     │       │ Postgres 17: constraints, triggers ◀┘ │
│   domain/  pure TS (math, rules)      │       └──────────────────────────────────────┘
│ src/shared   ui/ lib/ types/          │
│ sw.js        offline shell only       │       Cloudflare Pages: serves dist/ (static)
└───────────────────────────────────────┘
```

## Boundaries

- **Feature slices** (`src/features/*`) own their UI, data adapters and domain logic. Other code imports a
  feature only through its `index.ts` (enforced by ESLint `no-restricted-imports`). `src/app` may import
  page modules directly so each page is its own lazily loaded chunk.
- **Domain code** is pure TypeScript: no React, network, clock or randomness. Time and ids are passed in.
- **Data adapters** are the only place that calls Supabase. They map rows into domain types and convert
  errors into `AppError` (`src/shared/lib/appError.ts`) with a `kind` and, for deliberate database errors,
  a machine-readable `code` (e.g. `INVITE_EXPIRED`) that features translate into copy.
- **Authority:** Postgres is the authority for permissions (RLS), integrity (constraints, triggers) and
  money balances (SQL functions). The client never decides who may see or change a record.

## Request flow (example: accept an invite)

`AcceptInvitation` (UI) → `acceptInvitation()` adapter → `rpc('accept_household_invitation')` →
SQL function derives the caller from `auth.uid()`, locks the invitation row, validates it, inserts the
membership (capacity trigger enforces two members) → errors come back as `INVITE_*` codes → UI copy.

## Gates in the app shell

`SessionProvider` (auth state) → signed out: sign-in / sign-up routes → signed in: `HouseholdGate` loads
profile + membership; without a household it shows onboarding (create space or accept a pending invite).
Inside the gate, `useHousehold()` provides `me`, `partner`, `householdId` and the user's time zone.

## Data fetching

See [ADR 0004](decisions/0004-data-fetching.md): `useResource` per view, `useAsyncAction` for mutations,
idempotent writes in the database.

## PWA

`pwa/sw.js` is emitted at build time by `scripts/vite-service-worker-plugin.ts` with a content-derived cache
version. It precaches only the HTML shell and entry assets, caches other hashed assets on first use, serves
the cached shell when offline, and never touches cross-origin (Supabase) requests, so personal data is not
cached by the service worker. Offline **writes** are not supported (no conflict strategy yet); failed writes
show an error and keep the form contents.

## Why these libraries

| Library               | Why                                           | Size (gzip, measured)     |
| --------------------- | --------------------------------------------- | ------------------------- |
| react, react-dom      | Required by the contract                      | ~68 KB                    |
| @supabase/supabase-js | Auth + PostgREST client                       | ~56 KB                    |
| wouter                | Tiny router with hooks                        | ~2.4 KB                   |
| lucide-react          | Consistent tree-shaken icons                  | ~2.4 KB for current icons |
| zod                   | Runtime validation inside feature chunks only | loaded on demand          |
