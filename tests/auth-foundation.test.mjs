import assert from "node:assert/strict";
import test from "node:test";

import { getFriendlyAuthError } from "../src/lib/auth/errors.ts";
import {
  addAuthStatusToPath,
  getSafeNextPath,
} from "../src/lib/auth/redirect.ts";
import {
  authCredentialsSchema,
  passwordResetSchema,
  profileDisplayNameSchema,
} from "../src/lib/validations/auth.ts";

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

test("auth status redirects preserve safe route query parameters", () => {
  assert.equal(
    addAuthStatusToPath("/groups/public-token?invitation=accepted", "email-verified"),
    "/groups/public-token?invitation=accepted&auth=email-verified",
  );
  assert.equal(
    addAuthStatusToPath("https://example.com", "email-verified"),
    "/?auth=email-verified",
  );
});

test("password reset requires matching passwords", () => {
  assert.equal(
    passwordResetSchema.safeParse({
      password: "correct-horse",
      confirmPassword: "different-horse",
    }).success,
    false,
  );
});

test("profile display names are trimmed and length-limited", () => {
  assert.equal(
    profileDisplayNameSchema.parse({ displayName: "  Suman Bista  " }).displayName,
    "Suman Bista",
  );
  assert.equal(
    profileDisplayNameSchema.safeParse({ displayName: " ".repeat(81) }).success,
    false,
  );
});

test("authentication errors use friendly messages instead of provider text", () => {
  assert.match(
    getFriendlyAuthError("login", "email_not_confirmed"),
    /verify your email/i,
  );
  assert.equal(
    getFriendlyAuthError("login", "unexpected_provider_detail"),
    "Email or password is incorrect.",
  );
});
