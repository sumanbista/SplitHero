import assert from "node:assert/strict";
import test from "node:test";

import { createGroupSchema } from "../src/lib/validations/group.ts";

test("group names are trimmed before validation", () => {
  const result = createGroupSchema.parse({ name: "  Boston Trip  " });

  assert.equal(result.name, "Boston Trip");
});

test("blank group names are rejected", () => {
  const result = createGroupSchema.safeParse({ name: "   " });

  assert.equal(result.success, false);
});

test("group names longer than 80 characters are rejected", () => {
  const result = createGroupSchema.safeParse({ name: "a".repeat(81) });

  assert.equal(result.success, false);
});
