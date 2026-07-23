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

test("linked members keep their group-local member name", () => {
  assert.equal(
    getMemberDisplayName("  Group Name  ", "Current Account Name"),
    "Group Name",
  );
});

test("members use their group-local name without a profile display name", () => {
  assert.equal(getMemberDisplayName("Guest member", null), "Guest member");
  assert.equal(getMemberDisplayName("  Guest member  ", "   "), "Guest member");
});

test("member display names safely fall back when group-local data is unavailable", () => {
  assert.equal(
    getMemberDisplayName("   ", "  Current Account Name  "),
    "Current Account Name",
  );
  assert.equal(getMemberDisplayName("   ", null), "Unnamed member");
});
