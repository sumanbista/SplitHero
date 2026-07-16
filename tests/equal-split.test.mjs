import assert from "node:assert/strict";
import test from "node:test";

import { calculateEqualShares } from "../src/lib/calculations/equal-split.ts";

test("equal shares divide an amount evenly", () => {
  const shares = calculateEqualShares(9000, ["suman", "alex", "maya"]);

  assert.deepEqual(
    shares.map((share) => share.shareCents),
    [3000, 3000, 3000],
  );
});

test("remainder cents go to the first participants in order", () => {
  const shares = calculateEqualShares(1000, ["suman", "alex", "maya"]);

  assert.deepEqual(
    shares.map((share) => share.shareCents),
    [334, 333, 333],
  );
  assert.equal(
    shares.reduce((total, share) => total + share.shareCents, 0),
    1000,
  );
});

test("a small amount can produce valid zero-cent shares", () => {
  const shares = calculateEqualShares(1, ["suman", "alex", "maya"]);

  assert.deepEqual(
    shares.map((share) => share.shareCents),
    [1, 0, 0],
  );
});

test("equal split rejects missing or duplicate participants", () => {
  assert.throws(() => calculateEqualShares(1000, []), RangeError);
  assert.throws(
    () => calculateEqualShares(1000, ["suman", "suman"]),
    RangeError,
  );
});
