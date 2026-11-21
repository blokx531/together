# 0001 — Own repository (initially built in a subfolder of another repo)

- **Status:** accepted (2026-11-21); completed — the project now lives at the root of its own repository.
- **Context:** The workspace repository (`practice`) already holds an unrelated Next.js app with its own
  root `AGENTS.md`. The PRD asks to place the attached `AGENTS.md` at the repository root and to avoid
  destructive replacement of existing work. The owner chose "new repo later".
- **Decision:** Build Together as a self-contained project in `together/`, laid out exactly as it will be
  at the root of its own repository: `together/AGENTS.md` is the attached contract (byte-identical,
  SHA-256 `d776c580…`), `together/CLAUDE.md` points to it, and `together/.github/workflows/ci.yml` holds CI.
  The existing root `AGENTS.md`/`CLAUDE.md` belong to the other app and are left untouched.
- **Consequences:** The first six commits were authored in `together/` of the other repository and moved here with
  `git subtree split`, which keeps their history but contains none of the other project's files. Nothing was ever
  pushed to the other repository. CI (`.github/workflows/ci.yml`) runs from this repository's root.
