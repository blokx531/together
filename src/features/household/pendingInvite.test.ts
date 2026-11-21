import { describe, expect, it } from 'vitest';
import {
  clearPendingInvite,
  readPendingInvite,
  readTokenFromHash,
  savePendingInvite,
} from './pendingInvite';

const TOKEN = 'a'.repeat(64);

describe('pending invite', () => {
  it('reads a well-formed token from the URL fragment', () => {
    expect(readTokenFromHash(`#t=${TOKEN}`)).toBe(TOKEN);
  });
  it('ignores malformed tokens', () => {
    expect(readTokenFromHash('#t=<script>')).toBeNull();
    expect(readTokenFromHash('')).toBeNull();
  });
  it('round-trips through session storage and clears', () => {
    savePendingInvite(TOKEN);
    expect(readPendingInvite()).toBe(TOKEN);
    clearPendingInvite();
    expect(readPendingInvite()).toBeNull();
  });
});
