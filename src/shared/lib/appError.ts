export type AppErrorKind =
  'network' | 'auth' | 'forbidden' | 'not_found' | 'conflict' | 'validation' | 'unknown';

/**
 * Normalised error for UI code. `code` carries a machine-readable reason when the database raised
 * one deliberately (e.g. `INVITE_EXPIRED`), so features can map it to their own copy.
 */
export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly code: string | null;

  constructor(kind: AppErrorKind, message: string, code: string | null = null) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.code = code;
  }
}

const DEFAULT_MESSAGES: Record<AppErrorKind, string> = {
  network: 'Could not reach the server. Check your connection and try again.',
  auth: 'Your session has ended. Please sign in again.',
  forbidden: 'You do not have access to this.',
  not_found: 'This item no longer exists.',
  conflict: 'This was changed elsewhere. Refresh to see the latest version.',
  validation: 'Some details are not valid. Please check and try again.',
  unknown: 'Something went wrong. Please try again.',
};

// Codes raised on purpose by our SQL functions (`raise exception 'CODE'`).
const DOMAIN_CODE = /^[A-Z][A-Z_]+$/;

interface ErrorLike {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  name?: unknown;
}

function asErrorLike(value: unknown): ErrorLike | null {
  return typeof value === 'object' && value !== null ? value : null;
}

function kindFromPostgresCode(code: string): AppErrorKind | null {
  switch (code) {
    case '42501':
      return 'forbidden';
    case '23505':
    case '40001':
      return 'conflict';
    case '23502':
    case '23503':
    case '23514':
    case '22P02':
    case '22023':
      return 'validation';
    case 'PGRST116':
      return 'not_found';
    case 'PGRST301':
    case 'PGRST303':
      return 'auth';
    default:
      return null;
  }
}

function domainCodeKind(domainCode: string): AppErrorKind | null {
  if (domainCode.startsWith('STALE_')) return 'conflict';
  if (domainCode === 'NOT_FOUND') return 'not_found';
  return null;
}

function isNetworkFailure(message: string, name: string): boolean {
  return (
    name === 'AbortError' ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message)
  );
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const like = asErrorLike(error);
  const message = typeof like?.message === 'string' ? like.message : '';
  const code = typeof like?.code === 'string' ? like.code : '';
  const name = typeof like?.name === 'string' ? like.name : '';
  const status = typeof like?.status === 'number' ? like.status : null;

  if (isNetworkFailure(message, name)) return new AppError('network', DEFAULT_MESSAGES.network);
  if (DOMAIN_CODE.test(message)) {
    const kind = domainCodeKind(message) ?? kindFromPostgresCode(code) ?? 'validation';
    return new AppError(kind, DEFAULT_MESSAGES[kind], message);
  }
  const kind = kindFromPostgresCode(code) ?? (status === 401 ? 'auth' : 'unknown');
  return new AppError(kind, DEFAULT_MESSAGES[kind], code || null);
}
