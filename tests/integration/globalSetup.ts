import { readLocalStack } from './localStack';

export default async function globalSetup(): Promise<void> {
  const stack = readLocalStack();
  const response = await fetch(`${stack.apiUrl}/auth/v1/health`, {
    headers: { apikey: stack.publishableKey },
  });
  if (!response.ok) {
    throw new Error(`Local Supabase auth is not healthy (HTTP ${response.status}).`);
  }
  process.env.TEST_SUPABASE_URL = stack.apiUrl;
  process.env.TEST_SUPABASE_PUBLISHABLE_KEY = stack.publishableKey;
  process.env.TEST_SUPABASE_SECRET_KEY = stack.secretKey;
  process.env.TEST_DATABASE_URL = stack.dbUrl;
}
