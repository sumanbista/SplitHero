import assert from "node:assert/strict";
import test from "node:test";

import {
  getMemberDisplayName,
  getMemberInitials,
} from "../src/lib/utils/member.ts";

test("a single-word name uses one initial", () => {
  assert.equal(getMemberInitials("Alex"), "A");
});

test("a multi-word name uses the first and last initials", () => {
  assert.equal(getMemberInitials("Suman Kumar Bista"), "SB");
});

test("initial generation ignores surrounding and repeated whitespace", () => {
  assert.equal(getMemberInitials("  maya   patel  "), "MP");
});

test("linked members use their current profile display name", () => {
  assert.equal(getMemberDisplayName("Original member", "  Current Name  "), "Current Name");
});

test("members fall back to their existing name without a profile display name", () => {
  assert.equal(getMemberDisplayName("Guest member", null), "Guest member");
  assert.equal(getMemberDisplayName("Guest member", "   "), "Guest member");
});
