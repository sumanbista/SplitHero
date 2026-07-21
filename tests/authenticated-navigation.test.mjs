import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the landing page redirects authenticated users to the dashboard", async () => {
  const source = await readFile(
    new URL("../src/app/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /if \(await getCurrentUser\(\)\) \{\s*redirect\("\/dashboard"\)/);
  assert.doesNotMatch(source, /account-created|email-verified/);
});

test("ordinary signup and verification default to the dashboard", async () => {
  const [signupPage, signupAction, verifiedPage] = await Promise.all([
    readFile(new URL("../src/app/signup/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/actions/auth.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/auth/verified/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(
    signupPage,
    /getSafeNextPath\(params\.next, DEFAULT_AUTHENTICATED_PATH\)/,
  );
  assert.match(
    signupAction,
    /getSafeNextPath\(\s*formData\.get\("next"\)\?\.toString\(\),\s*DEFAULT_AUTHENTICATED_PATH/,
  );
  assert.match(
    verifiedPage,
    /getSafeNextPath\(params\.next, DEFAULT_AUTHENTICATED_PATH\)/,
  );
});

test("dashboard owns authenticated group creation and success messages", async () => {
  const [dashboard, newGroupPage] = await Promise.all([
    readFile(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/groups/new/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(dashboard, /href="\/groups\/new"/);
  assert.doesNotMatch(dashboard, /href="\/#create-group"/);
  assert.match(dashboard, /"account-created"/);
  assert.match(dashboard, /"email-verified"/);
  assert.match(newGroupPage, /requireUser\("\/groups\/new"\)/);
  assert.match(newGroupPage, /<CreateGroupForm isAuthenticated \/>/);
});

test("the shared logo accepts an authenticated home destination", async () => {
  const source = await readFile(
    new URL("../src/components/layout/app-logo.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /href\?: string/);
  assert.match(source, /href=\{href\}/);
});
