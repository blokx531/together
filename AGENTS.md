# Engineering Contract — Private Two-Person Life Tracker

> This file is binding guidance for every AI coding agent working in this repository. Read it before making changes. If an instruction conflicts with a user-approved feature specification, pause and document the conflict rather than silently choosing. Do not claim completion without evidence.

## 0. Mission and constraints

Build a secure, accessible, fast, maintainable **installable web app (PWA)** for exactly two people, with optional future expansion. It tracks personal/shared nutrition, weight goals, personal/shared expenses and settlements, flexible lists, and visited places. Primary users are in India; defaults should support INR, Indian food, metric units, and `Asia/Kolkata` while permitting a user-selected timezone.

**Recurring operating cost target: ₹0.** The core app MUST work without any paid API or AI service. Third-party free tiers are constraints, not guarantees. If a free tier, quota, key, or network service fails, core manual workflows must still work. Do not purchase, upgrade, add billing details, or introduce services that require payment without explicit authorization.

Priorities, in order: data security and integrity; functional correctness; maintainability; accessibility/usability; performance; polish. Do not sacrifice higher priorities to meet lower ones.

## 1. Technology decisions

- Use React, TypeScript, Vite, and Tailwind CSS for the frontend, with Supabase Auth/PostgreSQL for persistent data and Cloudflare Pages for static deployment. Use Cloudflare Workers/Pages Functions **only** for server-side operations such as securely proxying an optional AI request.
- Use a small, stable, well-maintained dependency set. Evaluate library maturity, license, bundle size, runtime support, maintenance, and long-term cost before adding dependencies. Explain why a new dependency is needed in the change summary.
- Commit a lockfile and use reproducible installs (`npm ci`, or the package-manager equivalent). Do not automatically upgrade unrelated packages as part of a feature change.
- Keep runtime configuration in environment variables validated at startup. Provide `.env.example` with placeholders, not secrets. Never commit tokens, passwords, real user data, or production database dumps.
- Use one application and database with separate personal/shared ownership rules; do not use microservices, unnecessary monorepos, custom state-management frameworks, or elaborate abstraction layers.

## 2. Architecture and boundaries

Organize code by **feature / vertical slice**, not one giant `components/`, `hooks/`, `utils/`, or `services/` directory. Suggested organization (adjust only with documented reason):

```
src/
  app/                    # App composition, providers, routing
  features/
    auth/
    dashboard/
    nutrition/
    weight-goals/
    expenses/
    lists/
    travel/
  shared/
    ui/                   # Truly reusable primitives
    lib/                  # Cross-feature infrastructure
    types/                # Cross-feature contracts only
  styles/
supabase/
  migrations/
  seed.sql                # Non-sensitive synthetic data only
tests/
  e2e/
  fixtures/
docs/
  architecture.md
  data-model.md
  decisions/
```

Each significant feature may have `components/`, `hooks/`, `schemas/`, `data/`, `domain/`, and `tests/`. Create folders only when there is a real need; avoid ceremony for a one-file feature.

Enforce dependency direction:

`UI -> feature application logic -> feature domain + data adapter -> infrastructure`

- **Domain logic** contains pure TypeScript calculations and invariants: no React, browser globals, network calls, Supabase client, clocks, or random state. Inject time/IDs when needed.
- **Data adapters** own database/API queries and map external records into typed domain objects. UI code must not contain raw SQL or scattered, repeated Supabase query implementations.
- **UI** renders data, handles interaction, and calls clearly named application actions. Do not mix financial math, nutrition calculation, database queries, and markup in one component.
- Do not import another feature's internals. Shared behavior should be exposed through a small explicit public interface or moved to `shared/` only when truly cross-cutting.
- Prefer simple composition and explicit data flow. No hidden global state when local or feature-scoped state is adequate.
- Maintain an architecture diagram and an ADR (`docs/decisions/`) when a choice is significant or hard to reverse.

## 3. TypeScript and style rules

- Set `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, and `noFallthroughCasesInSwitch: true` (adapt where library constraints require an explicit documented exception).
- No unchecked `any`, `// @ts-ignore`, non-null assertions (`!`) or blind type casts. A narrowly scoped exception requires a reason and an issue/reference. Prefer `unknown` plus validation at boundaries.
- Define explicit types for public function contracts and exported application interfaces. Generate database types from the actual schema. Do not manually duplicate a database schema in multiple locations without a reason.
- Validate external inputs **at runtime** with Zod or equivalent: user forms, imported CSV, API responses, AI output, URL parameters, and server requests. TypeScript does not validate runtime JSON.
- Enable ESLint, type-aware rules where appropriate, Prettier, and import organization. Format automatically; no subjective formatting debates. Do not disable lint rules globally to hide problems.
- Naming: `PascalCase` React components/types; `camelCase` functions/variables; descriptive boolean predicates (`isLoading`, `canEdit`); `SCREAMING_SNAKE_CASE` actual constants; predictable files such as `calculateNetBalance.ts`.
- One function should have one clear purpose. Prefer early returns, small pure functions, and readable expressions. Don't compress business logic into clever one-liners.
- Avoid magic numbers/strings: centralize named constants with units and explanations. Avoid arbitrary file/function length limits; refactor on cohesion and complexity, not line count alone.
- Comments explain **why**, constraints, assumptions, and non-obvious edge cases—not what self-explanatory code does. Public non-obvious calculations require documentation of their units and assumptions.
- Delete dead code and unused exports. No commented-out implementations, placeholder functions, TODO-based fake completion, or copy-pasted near-identical logic.

## 4. React and UI rules

- Functional components and hooks only. Keep state as local as possible, and derive values instead of duplicating them in state.
- Form state and server state must have clear ownership; use an appropriate server-state library only if it solves demonstrated caching/invalidation issues. Don't introduce state libraries solely for fashion.
- All asynchronous views must have proper loading, empty, success, error, and retry states. Every mutation must provide clear feedback. Disable repeat submission when appropriate, but also make backend writes idempotent where needed.
- Accessible by default: semantic HTML, labels, visible keyboard focus, correct tab order, sufficient contrast, responsive layouts, useful error messages, and reduced-motion support. Do not replace buttons with clickable `div`s.
- Use shared design tokens for typography, spacing, radii, colours, and elevation. Avoid one-off arbitrary styling when a token exists. Extract components only when reuse or conceptual clarity warrants it.
- Mobile-first PWA: useful touch targets, fast initial load, offline shell fallback, sensible image compression, lazy loading of maps/charts, and safe install behavior.
- Never claim offline **write** support until a tested conflict-resolution strategy exists. Connectivity failure must not silently discard a user's entry.

## 5. Database integrity and migrations

- PostgreSQL is authoritative for persisted records. Every table has a stable primary key and appropriate `created_at` / `updated_at` timestamps. Use foreign keys, NOT NULL, unique constraints, CHECK constraints, and indexes based on real query patterns.
- Schema changes MUST be versioned migrations checked into git. Never hand-edit production tables outside migrations. Test migrations from a clean database and, where relevant, from the previous schema. Document irreversible/destructive migrations and a safe rollout/backup plan.
- Ensure foreign-key and uniqueness rules reflect product semantics (memberships, invite redemption, expense splits, settlements, list ownership, and visits). Use transactions or appropriately scoped PostgreSQL functions for writes affecting multiple dependent records.
- Assign explicit ownership to personal records (`owner_user_id`) and shared records (`household_id`). The household membership model is separate from an ordinary profile.
- Never trust frontend-supplied owner or household IDs as proof of authorization. Server/database policies enforce access independently.
- Store raw facts once and derive totals and charts from them where practical. If a cached aggregate becomes necessary, document invalidation rules and reconciliation tests.
- Build data export in human-readable CSV/JSON; test restore strategy and verify how to safely delete all associated account data. Do not assume the free hosting plan provides reliable backups.

## 6. Security and privacy — mandatory release blocker

- Enable and test Supabase Row Level Security (RLS) for **every client-accessible table**. Default deny. Write explicit SELECT, INSERT, UPDATE, DELETE rules for the correct owner or household membership, including correct `WITH CHECK` behavior for writes.
- A member can view/edit only records authorized by product rules. Private notes and individual personal entries must not accidentally become household-visible. Shared access is explicit; no insecure global read policy.
- Test unauthorized access with a *second* signed-in user and with unauthenticated requests; UI hiding does not count as security.
- Use only approved publishable/anon keys in the client. Never expose a Supabase secret/service-role key or AI API key in frontend source, build artifacts, network requests, or logs. Backend functions must independently authenticate users and apply request limits; do not trust client-submitted user IDs.
- Validate input on both client and authoritative server boundary. Use parametrized database calls; avoid building SQL from strings. Apply safe output rendering; do not interpolate untrusted HTML.
- Keep nutrition/weight records, financial records, and photos private. Restrict storage buckets; use access-controlled or expiring URLs. Redact PII, meal photos, secrets, and tokens from diagnostics.
- Never send personal records or images to external AI providers without a clear opt-in and visible disclosure. Offer manual entry if a user declines. Define retention/deletion policy and ensure a photo can be deleted.
- Never log financial identifiers, full session tokens, or sensitive user data. Do not leave test credentials in code.

## 7. Finance domain rules (INR, two-person splitting)

- All monetary values use **integer paise** (or a proven exact-decimal type); never use JavaScript binary floating point as the authoritative money type. Format to rupees only for presentation.
- Each expense records amount, currency (`INR` by default), payer, beneficiaries/splits, category, date, ownership, and optional note. An expense is distinct from a repayment/settlement.
- The split amounts MUST sum exactly to the expense amount. For unequal percentage/equal splits where paise remain, use a documented deterministic rounding/allocation algorithm so no paise disappear or appear.
- Owed balances are derived from who paid, each person's allocated share, and settlements. Settlements reduce obligations but **are not new spending**; exclude them from category spending charts.
- Use appropriate transactions and/or idempotency keys for expense creation, edit, deletion, and settlements. A double tap, retry, or reconnect must not double-count a transfer.
- Reversals, edits, deletion, and historical records must not silently alter the wrong person's balances. Prefer auditable correction semantics for money-critical actions.
- Date and reporting period boundaries are explicit (user-selected timezone, default `Asia/Kolkata`). Prevent mismatches between UTC timestamps and local calendar days.
- Tests MUST cover: equal split with odd paise; unequal percentages; one person paying fully; both people paying in separate expenses; repayments; edit/delete; duplicate submission; large amounts; and month boundaries.

## 8. Nutrition and weight domain rules

- Distinguish **measured** values (scale weight, nutrition label), **database-derived** values (recipe ingredients), and **AI-estimated** values (photo/description). Store source, serving basis, quantity, units, and estimate/provenance. Never represent an AI estimate as an exact fact.
- Define conversion and precision rules for grams, millilitres, servings, kcal, kg, and lb (if enabled). Avoid implicit conversions and magic portion sizes. Recipe versions should not silently rewrite old meal history.
- The food database must work for common Indian foods and support manual correction, saved recipes, and custom portions. Check dataset licensing and attribution before import.
- Photo analysis is OPTIONAL: AI returns validated candidate food items, proposed portions, and uncertainty; **the user confirms or edits before saving**. Handle nonfood images, multiple dishes, no quota, timeout, provider errors, and ambiguous preparation methods.
- Daily consumed calories are derived from logged portions. Estimated calorie balance uses an explicitly named maintenance/TDEE model, with documented input assumptions; the UI must distinguish it from observed weight change. Never infer a medically precise deficit from a photo alone.
- Goals and projections must show trends, not promise guaranteed weight change. Use actual weekly weigh-ins to contextualize projections; keep logged measurements immutable unless the user intentionally corrects them.
- Tests MUST cover: missing meals, food quantities, portion edits, midnight boundaries, estimate versus measured source, goal change, outlier weigh-in, insufficient weigh-in data, and failure of optional AI.

## 9. Lists, travel, and collaborative updates

- Lists have clear owner/household visibility, typed list items, stable ordering, and optional subtype-specific metadata. A movie list and grocery list may reuse list primitives, but avoid forcing unrelated workflows into one giant conditional component.
- Each travel place has stable coordinates/geographic identifier, label, user attribution, visit date(s), and visibility. A wishlist location is not a completed visit; a shared trip is not automatically proof both members visited.
- Prevent duplicate writes by stable request IDs or uniqueness constraints where appropriate. Handle concurrent updates explicitly: refetch/merge/optimistic concurrency with a revision or `updated_at` check; never silently overwrite someone else's change.
- Map and optional external lookup failure must not prevent users from viewing or adding a previously saved location.

## 10. Dates, numbers, and external services

- Persist instants in UTC; store `date`-only values for calendar-day events such as a recorded meal day or a weekly weigh-in date when appropriate. Convert at presentation/query boundaries using the user's timezone, initially `Asia/Kolkata`.
- Never parse/display ambiguous date strings using ad hoc logic. Test leap days, daylight-saving changes if another timezone is supported, and near-midnight inputs.
- Define API and DB payloads explicitly. Handle timeouts, errors, rate limits, and invalid responses. Limit retries, use exponential backoff with jitter where appropriate, and never blindly retry non-idempotent writes.
- All third-party APIs (AI, nutrition search, geocoding/map sources) are accessed behind narrow adapters. Have deterministic local/manual fallback. Never design a core feature so it stops functioning when a free API quota is exceeded.

## 11. Testing — evidence, not a promise

Use Vitest for pure domain tests, React Testing Library for meaningful UI behavior, and Playwright for end-to-end journeys. Use isolated test data and mock external AI/providers rather than relying on network responses in the test suite.

**Test pyramid:**
1. Unit tests for calculations, parsing, validators, permissions helpers, and state transitions.
2. Integration tests against a local/test database for migrations, RLS, multi-row atomic writes, and actual query adapters.
3. End-to-end tests for the most important user flows on mobile-sized viewport and desktop.

**Mandatory critical flows:**
- Two accounts join the intended shared space; outsider and unauthenticated user cannot read or modify private/shared records.
- User A logs a meal; both can see it only if its visibility settings permit it; calorie total is correct.
- User B records a weigh-in and goal change; projected data updates without corrupting history.
- User A creates a shared expense; balances are exact; user B settles; spending totals do not count the settlement.
- Both users interact with a checklist; updates persist and concurrent edits do not disappear.
- A visited location persists correctly and appears on the intended map layer.
- Service outage, offline state, invalid input, retries, duplicated submissions, and expired session fail safely.

Tests must assert behavior and persisted outcomes, not merely that components render. No arbitrary sleeps in E2E tests; use stable role-based selectors and Playwright's automatic waiting. Make tests deterministic and independently repeatable.

Do not invent test success. Run the tests and report actual results. A bug fix must include a regression test that would have failed before the fix.

## 12. Continuous quality gates

Provide and maintain project scripts for:

```
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run build
```

Use these as contractual targets; implement script names honestly, with no no-op placeholders. For a small change, run impacted checks locally. Before merging or deploying, run the complete relevant suite in CI; tests that require a test database must run against a designated disposable database, **never production**.

A feature is **NOT DONE** if:
- Any required check is failing or skipped without an explicit approved exception.
- There is an unresolved TypeScript error, lint error, dead code, debug log, secret, or known data leak.
- Loading, error, empty, permission, or retry cases are missing.
- Necessary tests, migration, security policy, or documentation have not been updated.
- The implementation only works with mocked/hardcoded values or an optional paid API.
- A previous feature was broken or an unrelated dependency/file was changed without explanation.

Use a CI workflow to run formatting, lint, typecheck, unit tests, relevant integration/E2E tests, and build before deployment. Use preview builds to inspect mobile layouts and ensure production deploys from a protected main branch. Avoid claiming a production release is safe until the gates pass.

## 13. Required agent workflow for every task

**Before implementation**
1. Read this file, existing architecture, schema/migrations, and nearby feature code.
2. State the intended behavior, key edge cases, affected files, and expected tests.
3. Inspect for existing utilities/components; reuse compatible ones, don't duplicate.
4. If introducing an API or dependency, verify current docs, quotas, licenses, and its free-tier suitability.
5. For schema/security changes, enumerate ownership and RLS implications.

**During implementation**
6. Make the smallest coherent change that solves the task. Avoid speculative refactors and drive-by formatting of unrelated files.
7. Implement or update pure domain logic first, then data adapter, then UI.
8. Add tests alongside the behavior. Use synthetic fixtures, never personal production data.
9. Ensure all branches have explicit loading/error/empty and authorization behavior.
10. Never work around failures by suppressing types, disabling lint, skipping tests, weakening RLS, swallowing errors, or hardcoding success responses.

**After implementation**
11. Run formatter, linter, type checker, tests, build, and relevant security/migration checks; record actual outcomes.
12. Review the diff for accidental changes, duplicated code, inconsistent names, unused dependencies, exposed secrets, missing cleanup, and missed edge cases.
13. Update docs, migration notes, env examples, and tests when behavior changes.
14. Report: (a) what changed, (b) architectural decisions, (c) tests/checks actually run and outcomes, (d) remaining risks and known limitations, (e) whether the ₹0/month requirement is still satisfied.
15. Never claim a successful deploy, test, cost guarantee, or live API integration unless verified.

## 14. Coding agent anti-patterns — prohibited

- One gigantic React component containing UI, API requests, validation, and domain formulas.
- A generic global `utils.ts` that becomes a dumping ground.
- An abstraction introduced before a second credible use case exists.
- Rebuilding basic data-layer functionality already covered reliably by PostgreSQL/Supabase.
- Using the client as the authority for user permissions, balance calculation, or transaction integrity.
- Duplicated state, computed totals stored inconsistently, or unexplained `useEffect` chains.
- Silent `catch` blocks, ignored promises, endless retries, `console.log` secrets.
- Code that looks finished but relies on placeholder constants, fake APIs, or demo-only data.
- Weakening compiler, lint, test, or security settings to get a green build.
- Replacing an entire working feature as an easier alternative to debugging a localized issue.
- Overengineering for millions of users when the stated target is two users.

## 15. Final acceptance criterion

The code should be understandable by a new competent TypeScript developer without needing access to the original agent conversation. The user can add a new field, adjust a calculation, or change a screen without touching unrelated modules. A new agent can trace a record from form input through validation and authorization to persistence and back. All core workflows are usable with free infrastructure, and the complete change history is reviewable in git.

**When uncertain, choose the simpler secure design, document the trade-off, and test it. Never hide uncertainty behind confident completion language.**
