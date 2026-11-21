import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { assertLocalTestUrl } from '../localTestEnv';

export interface LocalStack {
  apiUrl: string;
  publishableKey: string;
  secretKey: string;
  dbUrl: string;
}

type MaybeStack = { [K in keyof LocalStack]: string | undefined };

function parseEnvOutput(output: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of output.split('\n')) {
    const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (match?.[1] && match[2] !== undefined) values[match[1]] = match[2];
  }
  return values;
}

/**
 * Reads connection details for the disposable local Supabase stack. Values come from the
 * environment when provided (CI), otherwise from `supabase status`. Production URLs are rejected.
 */
export function readLocalStack(): LocalStack {
  const fromEnv: MaybeStack = {
    apiUrl: process.env.TEST_SUPABASE_URL,
    publishableKey: process.env.TEST_SUPABASE_PUBLISHABLE_KEY,
    secretKey: process.env.TEST_SUPABASE_SECRET_KEY,
    dbUrl: process.env.TEST_DATABASE_URL,
  };
  let stack: MaybeStack = fromEnv;
  if (!fromEnv.apiUrl || !fromEnv.publishableKey || !fromEnv.secretKey || !fromEnv.dbUrl) {
    const options: ExecFileSyncOptionsWithStringEncoding = {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    };
    // Windows provides npx as a .cmd shim. Pass only fixed arguments through cmd.exe.
    const output =
      process.platform === 'win32'
        ? execFileSync('cmd.exe', ['/d', '/s', '/c', 'npx --no supabase status -o env'], options)
        : execFileSync('npx', ['--no', 'supabase', 'status', '-o', 'env'], options);
    const status = parseEnvOutput(output);
    stack = {
      apiUrl: status.API_URL,
      publishableKey: status.PUBLISHABLE_KEY,
      secretKey: status.SECRET_KEY,
      dbUrl: status.DB_URL,
    };
  }
  const { apiUrl, publishableKey, secretKey, dbUrl } = stack;
  if (!apiUrl || !publishableKey || !secretKey || !dbUrl) {
    throw new Error('Local Supabase is not running. Start it with `npm run db:start`.');
  }
  assertLocalTestUrl(apiUrl, 'TEST_SUPABASE_URL', ['http:', 'https:']);
  assertLocalTestUrl(dbUrl, 'TEST_DATABASE_URL', ['postgres:', 'postgresql:']);
  return { apiUrl, publishableKey, secretKey, dbUrl };
}
