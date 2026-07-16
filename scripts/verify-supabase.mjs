import assert from "node:assert/strict";

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const requiredEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

for (const name of requiredEnvironment) {
  const value = process.env[name]?.trim();
  assert.ok(value, `${name} is required.`);
  assert.ok(!value.includes("your-"), `${name} still contains a placeholder.`);
}

const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
assert.equal(
  supabaseUrl.protocol,
  "https:",
  "NEXT_PUBLIC_SUPABASE_URL must use HTTPS for production.",
);

const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.notEqual(
  publishableKey,
  serviceRoleKey,
  "The publishable and service-role keys must be different.",
);

const response = await fetch(new URL("/rest/v1/", supabaseUrl), {
  headers: {
    Accept: "application/openapi+json",
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  },
  signal: AbortSignal.timeout(15_000),
});

assert.ok(
  response.ok,
  `Supabase schema check failed with HTTP ${response.status}.`,
);

const schema = await response.json();
assert.ok(schema && typeof schema === "object", "Supabase returned no schema.");
assert.ok(
  schema.paths && typeof schema.paths === "object",
  "Supabase did not return a PostgREST OpenAPI schema.",
);

const expectedPaths = [
  "/groups",
  "/members",
  "/expenses",
  "/expense_participants",
  "/settlement_payments",
  "/rpc/create_expense_with_participants",
  "/rpc/record_recommended_settlement_payment",
];

for (const expectedPath of expectedPaths) {
  assert.ok(
    expectedPath in schema.paths,
    `The deployed Supabase schema is missing ${expectedPath}.`,
  );
}

console.log(
  `Verified Supabase connectivity and ${expectedPaths.length} deployed schema paths.`,
);
