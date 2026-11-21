import { describe, expect, it } from 'vitest';
import { AppError, toAppError } from './appError';

describe('toAppError', () => {
  it('classifies fetch failures as network errors', () => {
    expect(toAppError({ message: 'TypeError: Failed to fetch', code: '' }).kind).toBe('network');
  });

  it('keeps deliberate database codes for feature-specific copy', () => {
    const error = toAppError({ message: 'INVITE_EXPIRED', code: 'P0001' });
    expect(error.kind).toBe('validation');
    expect(error.code).toBe('INVITE_EXPIRED');
  });

  it('treats STALE_* codes as conflicts and NOT_FOUND as missing', () => {
    expect(toAppError({ message: 'STALE_EXPENSE', code: 'P0001' })).toMatchObject({
      kind: 'conflict',
      code: 'STALE_EXPENSE',
    });
    expect(toAppError({ message: 'NOT_FOUND', code: 'P0001' }).kind).toBe('not_found');
    expect(toAppError({ message: 'NOT_ALLOWED', code: '42501' }).kind).toBe('forbidden');
  });

  it('maps RLS / privilege failures to forbidden', () => {
    expect(toAppError({ message: 'permission denied for table x', code: '42501' }).kind).toBe(
      'forbidden',
    );
  });

  it('maps unique violations to conflict', () => {
    expect(toAppError({ message: 'duplicate key', code: '23505' }).kind).toBe('conflict');
  });

  it('maps HTTP 401 auth errors', () => {
    expect(toAppError({ message: 'JWT expired', status: 401 }).kind).toBe('auth');
  });

  it('passes AppError through unchanged', () => {
    const original = new AppError('conflict', 'x', 'STALE');
    expect(toAppError(original)).toBe(original);
  });

  it('falls back to unknown without leaking raw messages', () => {
    const error = toAppError(new Error('internal detail'));
    expect(error.kind).toBe('unknown');
    expect(error.message).not.toContain('internal detail');
  });
});
