# 0002 — Email + password without confirmation emails

- **Status:** accepted (2026-11-21)
- **Context:** Supabase's built-in SMTP only delivers to members of the project's team and is limited to
  about 2 emails/hour ([research](research/platform-2026-11-21.md#1-supabase)). The partner's address is not
  a team member, so confirmation and reset emails would fail. Custom SMTP adds a provider (and often a
  domain) to maintain.
- **Decision:**
  1. Email + password sign-in. "Confirm email" is turned off, so sign-up signs the user in directly
     (local `supabase/config.toml` has `enable_confirmations = false`).
  2. Pairing happens with a single-use, expiring invite link (SHA-256 stored, 72 h lifetime, one live link).
  3. After both partners have accounts, the owner disables new sign-ups in the dashboard. An account with no
     household can see nothing (RLS), so the open window is low-risk.
  4. Password changes happen in-app while signed in. A forgotten password is reset by the project owner from
     the Supabase dashboard; optional free SMTP (e.g. Brevo) can enable self-service reset later.
- **Trade-off:** email ownership is not verified. Acceptable for two known people; documented in
  `docs/privacy-and-permissions.md`.
