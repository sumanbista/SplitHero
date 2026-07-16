import assert from "node:assert/strict";
import test from "node:test";

import {
  addMemberSchema,
  memberGroupTokenSchema,
} from "../src/lib/validations/member.ts";

test("member names are trimmed before validation", () => {
  const result = addMemberSchema.parse({ name: "  Suman Bista  " });

  assert.equal(result.name, "Suman Bista");
});

test("blank member names are rejected", () => {
  const result = addMemberSchema.safeParse({ name: "   " });

  assert.equal(result.success, false);
});

test("member names longer than 50 characters are rejected", () => {
  const result = addMemberSchema.safeParse({ name: "a".repeat(51) });

  assert.equal(result.success, false);
});

test("member mutations require a valid group share token", () => {
  assert.equal(
    memberGroupTokenSchema.safeParse("not-a-real-group").success,
    false,
  );
});
