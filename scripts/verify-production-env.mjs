import assert from "node:assert/strict";

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const requiredEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

for (const name of requiredEnvironment) {
  const value = process.env[name]?.trim();
  assert.ok(value, `${name} is required for production.`);
  assert.ok(!value.includes("your-"), `${name} still contains a placeholder.`);
}

for (const name of Object.keys(process.env)) {
  assert.doesNotMatch(
    name,
    /^NEXT_PUBLIC_.*(?:SERVICE_ROLE|SECRET|PRIVATE)/i,
    `${name} appears to expose a server secret to the browser.`,
  );
}

const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
assert.equal(supabaseUrl.protocol, "https:", "Supabase must use HTTPS.");
assert.equal(supabaseUrl.username, "", "Supabase URL must not contain credentials.");
assert.equal(supabaseUrl.password, "", "Supabase URL must not contain credentials.");

const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL);
assert.equal(siteUrl.protocol, "https:", "NEXT_PUBLIC_SITE_URL must use HTTPS.");
assert.equal(siteUrl.username, "", "NEXT_PUBLIC_SITE_URL must not contain credentials.");
assert.equal(siteUrl.password, "", "NEXT_PUBLIC_SITE_URL must not contain credentials.");
assert.equal(siteUrl.pathname, "/", "NEXT_PUBLIC_SITE_URL must be an origin without a path.");
assert.equal(siteUrl.search, "", "NEXT_PUBLIC_SITE_URL must not contain a query string.");
assert.equal(siteUrl.hash, "", "NEXT_PUBLIC_SITE_URL must not contain a fragment.");
assert.ok(
  !["localhost", "127.0.0.1", "::1"].includes(siteUrl.hostname),
  "NEXT_PUBLIC_SITE_URL must use the deployed production host.",
);

const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
assert.ok(publishableKey.length >= 20, "Supabase publishable key is unexpectedly short.");
assert.ok(serviceRoleKey.length >= 32, "Supabase service-role key is unexpectedly short.");
assert.notEqual(
  publishableKey,
  serviceRoleKey,
  "The publishable and service-role keys must be different.",
);

console.log("Verified production environment safety checks.");
