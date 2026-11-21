# Privacy and permissions

Access is enforced by Postgres Row Level Security and column grants, not by hiding things in the UI.
Integration tests (`tests/integration/`) sign in as two partners, an outsider and a signed-out client and
assert what each can read and change.

## Who can see what

| Data                       | You                               | Your partner | Anyone else / signed out                     |
| -------------------------- | --------------------------------- | ------------ | -------------------------------------------- |
| Your name and time zone    | read, edit                        | read         | nothing                                      |
| Your email address         | (auth only)                       | never shown  | nothing                                      |
| Household name and members | read, rename                      | read, rename | nothing                                      |
| Invitations                | see status; create/revoke via app | same         | nothing; token hash never readable by anyone |

Each new feature adds rows to this table when it ships.

Personal expenses default to **private**; sharing one is an explicit checkbox. Meals default to the visibility chosen in
Settings (initially shared) and can be made private per meal. Weight data is private until shared.

## Consent and defaults

- Joining a household requires the invitee to open a private link and confirm. Links are single-use,
  expire after 72 hours, and creating a new link cancels the previous one.
- Email addresses are not verified (see [ADR 0002](decisions/0002-auth-without-email.md)); sign-ups should be
  disabled after both partners join.
- Nothing is sent to third parties. Future optional AI features will require explicit opt-in per use.
