import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getAccountDisplayName,
  getAccountInitials,
} from "../src/lib/dashboard/account.ts";

test("account display names prefer profile data and fall back to email", () => {
  assert.equal(
    getAccountDisplayName("  Suman Bista  ", "suman@example.com"),
    "Suman Bista",
  );
  assert.equal(
    getAccountDisplayName(null, "suman@example.com"),
    "suman@example.com",
  );
});

test("account initials support names and email fallbacks", () => {
  assert.equal(getAccountInitials("Suman Bista"), "SB");
  assert.equal(getAccountInitials("suman@example.com"), "S");
});

test("dashboard group loading is scoped to the signed-in user", async () => {
  const source = await readFile(
    new URL("../src/lib/dashboard/data.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /\.eq\("created_by_user_id", userId\)/);
  assert.doesNotMatch(source, /\.is\("created_by_user_id", null\)/);
});

test("anonymous group creation remains unowned", async () => {
  const source = await readFile(
    new URL("../src/lib/actions/groups.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /created_by_user_id/);
});
