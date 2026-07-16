import assert from "node:assert/strict";
import test from "node:test";

import { getMemberInitials } from "../src/lib/utils/member.ts";

test("a single-word name uses one initial", () => {
  assert.equal(getMemberInitials("Alex"), "A");
});

test("a multi-word name uses the first and last initials", () => {
  assert.equal(getMemberInitials("Suman Kumar Bista"), "SB");
});

test("initial generation ignores surrounding and repeated whitespace", () => {
  assert.equal(getMemberInitials("  maya   patel  "), "MP");
});
