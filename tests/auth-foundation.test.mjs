import assert from "node:assert/strict";
import test from "node:test";

import { getSafeNextPath } from "../src/lib/auth/redirect.ts";
import { authCredentialsSchema } from "../src/lib/validations/auth.ts";

test("auth credentials normalize email addresses", () => {
  const result = authCredentialsSchema.parse({
    email: "  PERSON@Example.COM  ",
    password: "correct-horse",
  });

  assert.equal(result.email, "person@example.com");
});

test("auth credentials reject short passwords", () => {
  const result = authCredentialsSchema.safeParse({
    email: "person@example.com",
    password: "short",
  });

  assert.equal(result.success, false);
});

test("safe next paths allow local routes", () => {
  assert.equal(getSafeNextPath("/protected"), "/protected");
  assert.equal(getSafeNextPath("/groups/public-token"), "/groups/public-token");
});

test("safe next paths reject external and protocol-relative redirects", () => {
  assert.equal(getSafeNextPath("https://example.com"), "/");
  assert.equal(getSafeNextPath("//example.com"), "/");
  assert.equal(getSafeNextPath("/\\example.com"), "/");
  assert.equal(getSafeNextPath(undefined, "/protected"), "/protected");
});
