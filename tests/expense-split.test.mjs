import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateExpenseShares,
  parsePercentageToBasisPoints,
} from "../src/lib/calculations/expense-split.ts";

const members = ["alex", "maya", "sam"];

test("equal mode preserves the existing equal-split behavior", () => {
  const shares = calculateExpenseShares(1000, members, "equal");

  assert.deepEqual(
    shares.map((share) => share.shareCents),
    [334, 333, 333],
  );
  assert.deepEqual(
    shares.map((share) => share.percentageBasisPoints),
    [null, null, null],
  );
});

test("exact shares are finalized as integer cents", () => {
  const shares = calculateExpenseShares(1000, members, "exact", [
    { memberId: "alex", value: "3.34" },
    { memberId: "maya", value: "3.33" },
    { memberId: "sam", value: "3.33" },
  ]);

  assert.deepEqual(
    shares.map((share) => share.shareCents),
    [334, 333, 333],
  );
});

test("exact shares must equal the expense total", () => {
  assert.throws(
    () =>
      calculateExpenseShares(1000, members, "exact", [
        { memberId: "alex", value: "3.33" },
        { memberId: "maya", value: "3.33" },
        { memberId: "sam", value: "3.33" },
      ]),
    /add up to the expense total/i,
  );
});

test("percentage shares use deterministic largest-remainder allocation", () => {
  const shares = calculateExpenseShares(100, members, "percentage", [
    { memberId: "alex", value: "33.33" },
    { memberId: "maya", value: "33.33" },
    { memberId: "sam", value: "33.34" },
  ]);

  assert.deepEqual(
    shares.map((share) => share.shareCents),
    [33, 33, 34],
  );
  assert.deepEqual(
    shares.map((share) => share.percentageBasisPoints),
    [3333, 3333, 3334],
  );
});

test("percentage remainder ties use participant order", () => {
  const shares = calculateExpenseShares(1, ["alex", "maya"], "percentage", [
    { memberId: "alex", value: "50" },
    { memberId: "maya", value: "50.00" },
  ]);

  assert.deepEqual(
    shares.map((share) => share.shareCents),
    [1, 0],
  );
});

test("percentages must total 100% with at most two decimal places", () => {
  assert.equal(parsePercentageToBasisPoints("12.345"), null);
  assert.throws(
    () =>
      calculateExpenseShares(1000, ["alex", "maya"], "percentage", [
        { memberId: "alex", value: "60" },
        { memberId: "maya", value: "39.99" },
      ]),
    /add up to 100%/i,
  );
});
