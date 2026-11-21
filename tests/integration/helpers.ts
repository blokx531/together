import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { expect } from 'vitest';
import type { Database } from '../../src/shared/types/database';
import { readLocalStack } from './localStack';

export type TestClient = SupabaseClient<Database>;

export interface TestUser {
  id: string;
  email: string;
  displayName: string;
  client: TestClient;
}

const stack = readLocalStack();
const TEST_PASSWORD = `pw-${randomUUID()}`;

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

export function anonClient(): TestClient {
  return createClient<Database>(stack.apiUrl, stack.publishableKey, clientOptions);
}

function adminClient(): TestClient {
  return createClient<Database>(stack.apiUrl, stack.secretKey, clientOptions);
}

/** Direct superuser connection for fixture manipulation (e.g. expiring an invite). Local only. */
export async function withDb<T>(run: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: stack.dbUrl });
  await db.connect();
  try {
    return await run(db);
  } finally {
    await db.end();
  }
}

export async function createTestUser(displayName: string): Promise<TestUser> {
  const email = `${displayName.toLowerCase()}-${randomUUID()}@example.test`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) throw error;
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, email, displayName, client };
}

export async function createHousehold(owner: TestUser, name = 'Test home'): Promise<string> {
  const { data, error } = await owner.client.rpc('create_household', { household_name: name });
  if (error) throw error;
  return data;
}

export async function createInvitationToken(owner: TestUser): Promise<string> {
  const { data, error } = await owner.client.rpc('create_household_invitation').single();
  if (error) throw error;
  return data.token;
}

export interface Pair {
  a: TestUser;
  b: TestUser;
  householdId: string;
}

/** Two users paired in one household, plus nothing else. */
export async function createPair(): Promise<Pair> {
  const a = await createTestUser('Asha');
  const b = await createTestUser('Bilal');
  const householdId = await createHousehold(a);
  const token = await createInvitationToken(a);
  const { error } = await b.client.rpc('accept_household_invitation', { invitation_token: token });
  if (error) throw error;
  return { a, b, householdId };
}

/** Asserts a Supabase response failed with the given database error message. */
export function expectDbError(
  result: { error: { message: string } | null },
  message: string | RegExp,
): void {
  expect(result.error, 'expected the request to be rejected').not.toBeNull();
  expect(result.error?.message).toMatch(message);
}
