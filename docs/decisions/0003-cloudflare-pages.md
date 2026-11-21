# 0003 — Cloudflare Pages for hosting (Workers static assets as drop-in alternative)

- **Status:** accepted (2026-11-21)
- **Context:** `AGENTS.md` and the PRD specify Cloudflare Pages. Cloudflare's docs now say "start new projects
  with Workers", while Pages remains supported ([research](research/platform-2026-11-21.md#2-cloudflare-and-github-actions)).
  This is a conflict between the contract and current vendor guidance.
- **Decision:** Follow the contract and use Pages: free, Git-integrated builds (500/month), automatic SPA
  fallback, custom domains from any DNS. The app is a static `dist/` folder plus, at most, one function, so
  switching to Workers static assets later is a configuration change (`wrangler.jsonc` with
  `assets.not_found_handling = "single-page-application"`), not a code change.
- **Revisit when:** Pages stops receiving features we need, or Cloudflare announces deprecation.
