/**
 * Idempotency key for a single user intent (one form submission). Generate it once when the form
 * opens and re-send the same key on retry so the database can drop duplicates.
 */
export function newRequestId(): string {
  return crypto.randomUUID();
}
