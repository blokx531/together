# 0004 — No server-state library; `useResource` + explicit reloads

- **Status:** accepted (2026-11-21)
- **Context:** Two users, small datasets, one screen visible at a time. A server-state library adds ~13 KB gzip
  and a second mental model. `AGENTS.md` allows one only for demonstrated caching/invalidation problems.
- **Decision:** Each view loads its data with `src/shared/lib/useResource.ts` (abortable, keyed, keeps data
  visible while refreshing, refetches when the app becomes visible again). Mutations go through
  `useAsyncAction` (blocks re-entrant submits) and then call `reload()`. Database writes are idempotent via
  client request ids, so UI guards are a convenience, not the safety mechanism.
- **Revisit when:** the same entity is shown in several simultaneously mounted views that must stay in sync,
  or offline writes are introduced.
