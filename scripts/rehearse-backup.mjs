import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const { API_URL, PUBLISHABLE_KEY, SECRET_KEY, GITHUB_ACTIONS } = process.env;
const [mode, fixturePath] = process.argv.slice(2);
assert.equal(
  GITHUB_ACTIONS,
  "true",
  "This rehearsal is limited to its disposable GitHub runner.",
);
assert.ok(
  API_URL && ["127.0.0.1", "localhost"].includes(new URL(API_URL).hostname),
);
assert.ok(PUBLISHABLE_KEY && SECRET_KEY && fixturePath);
const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};
const publicClient = () => createClient(API_URL, PUBLISHABLE_KEY, options);
const backupDate = "2026-11-21";

async function checked(call) {
  const { data, error } = await call;
  if (error) throw error;
  return data;
}

async function signIn(account) {
  const client = publicClient();
  const data = await checked(
    client.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    }),
  );
  assert.equal(
    data.user.id,
    account.id,
    "Restored credentials must sign in as the original user.",
  );
  return client;
}

async function verifyData(fixture) {
  const [asha, bilal, outsider] = await Promise.all(
    fixture.accounts.map(signIn),
  );
  const [a, b] = fixture.accounts;
  const expectedNets = { [a.id]: 60000, [b.id]: -60000 };
  for (const client of [asha, bilal]) {
    const balances = await checked(client.rpc("household_balances"));
    assert.deepEqual(
      Object.fromEntries(balances.map((row) => [row.user_id, row.net_paise])),
      expectedNets,
    );
    const members = await checked(
      client
        .from("household_members")
        .select("user_id")
        .eq("household_id", fixture.household),
    );
    assert.deepEqual(
      new Set(members.map((row) => row.user_id)),
      new Set([a.id, b.id]),
    );
  }
  const meals = (client) =>
    checked(
      client
        .from("meals")
        .select("visibility, meal_type, meal_items(kcal)")
        .eq("owner_user_id", a.id)
        .eq("local_date", backupDate)
        .order("meal_type"),
    );
  assert.deepEqual(await meals(asha), [
    {
      visibility: "private",
      meal_type: "breakfast",
      meal_items: [{ kcal: 102 }],
    },
    {
      visibility: "household",
      meal_type: "lunch",
      meal_items: [{ kcal: 204 }],
    },
  ]);
  assert.deepEqual(await meals(bilal), [
    {
      visibility: "household",
      meal_type: "lunch",
      meal_items: [{ kcal: 204 }],
    },
  ]);
  assert.deepEqual(await meals(outsider), []);
  const signedOut = await publicClient().from("meals").select("id");
  assert.ok(signedOut.error || signedOut.data.length === 0);
}

if (mode === "seed") {
  const admin = createClient(API_URL, SECRET_KEY, options);
  const accounts = [];
  for (const name of ["Asha", "Bilal", "Outsider"]) {
    const email = name.toLowerCase() + "-" + randomUUID() + "@example.test";
    const password = randomUUID() + "-Test";
    const { user } = await checked(
      admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: name },
      }),
    );
    accounts.push({ id: user.id, email, password });
  }
  const [a, b] = accounts;
  const [asha, bilal] = await Promise.all([signIn(a), signIn(b)]);
  const household = await checked(
    asha.rpc("create_household", { household_name: "Synthetic restore space" }),
  );
  const { token } = await checked(
    asha.rpc("create_household_invitation").single(),
  );
  await checked(
    bilal.rpc("accept_household_invitation", { invitation_token: token }),
  );
  await checked(
    asha.rpc("save_expense", {
      p_client_request_id: randomUUID(),
      p_payer_user_id: a.id,
      p_scope: "shared",
      p_visibility: "household",
      p_split_method: "equal",
      p_amount_paise: 120000,
      p_category: "groceries",
      p_title: "Synthetic groceries",
      p_note: "",
      p_spent_on: backupDate,
      p_splits: [
        { user_id: a.id, share_paise: 60000 },
        { user_id: b.id, share_paise: 60000 },
      ],
    }),
  );
  const { id: foodId } = await checked(
    asha.from("foods").select("id").eq("source_ref", "roti:home").single(),
  );
  for (const [meal, visibility, quantity] of [
    ["breakfast", "private", 40],
    ["lunch", "household", 80],
  ]) {
    await checked(
      asha.rpc("log_food", {
        p_client_request_id: randomUUID(),
        p_local_date: backupDate,
        p_meal_type: meal,
        p_custom_label: "",
        p_visibility: visibility,
        p_food_id: foodId,
        p_quantity: quantity,
        p_serving_label: "",
        p_serving_count: 1,
      }),
    );
  }
  const fixture = { accounts, household };
  await verifyData(fixture);
  await writeFile(fixturePath, JSON.stringify(fixture), { mode: 0o600 });
  console.log("Synthetic fixture and pre-backup permissions verified.");
} else if (mode === "verify") {
  await verifyData(JSON.parse(await readFile(fixturePath, "utf8")));
  console.log(
    "Recovered both logins, shared balance, household membership, and meal privacy on a fresh stack.",
  );
} else {
  throw new Error("Specify seed or verify.");
}
