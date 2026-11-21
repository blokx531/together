import { execFileSync } from 'node:child_process';

export interface LocalStack {
  apiUrl: string;
  publishableKey: string;
  secretKey: string;
  dbUrl: string;
}

type MaybeStack = { [K in keyof LocalStack]: string | undefined };

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

function assertLocal(url: string): void {
  const { hostname } = new URL(url);
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(`Refusing to run integration tests against non-local host "${hostname}".`);
  }
}

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
    const output = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
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
  assertLocal(apiUrl);
  assertLocal(dbUrl);
  return { apiUrl, publishableKey, secretKey, dbUrl };
}
