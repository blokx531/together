/**
 * Keeps an invitation token across the sign-up step. The token arrives in the URL fragment
 * (`/join#t=...`), which browsers never send to servers, and is held only in this tab's
 * sessionStorage until it is used or discarded.
 */
const STORAGE_KEY = 'together.pendingInvite';
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export function readTokenFromHash(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('t');
  return token && TOKEN_PATTERN.test(token) ? token : null;
}

export function savePendingInvite(token: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Storage can be unavailable (private mode); the user can reopen the link after signing in.
  }
}

export function readPendingInvite(): string | null {
  try {
    const token = sessionStorage.getItem(STORAGE_KEY);
    return token && TOKEN_PATTERN.test(token) ? token : null;
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored if storage is unavailable.
  }
}
