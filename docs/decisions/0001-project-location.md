# 0001 — Build in `together/` inside the existing repository, move later

- **Status:** accepted (2026-11-21)
- **Context:** The workspace repository (`practice`) already holds an unrelated Next.js app with its own
  root `AGENTS.md`. The PRD asks to place the attached `AGENTS.md` at the repository root and to avoid
  destructive replacement of existing work. The owner chose "new repo later".
- **Decision:** Build Together as a self-contained project in `together/`, laid out exactly as it will be
  at the root of its own repository: `together/AGENTS.md` is the attached contract (byte-identical,
  SHA-256 `d776c580…`), `together/CLAUDE.md` points to it, and `together/.github/workflows/ci.yml` holds CI.
  The existing root `AGENTS.md`/`CLAUDE.md` belong to the other app and are left untouched.
- **Consequences:** GitHub only runs workflows from the repository root, so CI activates after the move.
  All checks were run locally in the meantime. To move with history:
  `git subtree split --prefix together -b together-main` and push that branch to the new repository.
