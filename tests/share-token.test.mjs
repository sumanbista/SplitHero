import assert from "node:assert/strict";
import test from "node:test";

import { generateShareToken } from "../src/lib/utils/share-token.ts";

test("share tokens are URL-safe and carry 32 bytes of entropy", () => {
  const token = generateShareToken();

  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
});

test("share token generation does not repeat across a sample", () => {
  const tokens = new Set(
    Array.from({ length: 256 }, () => generateShareToken()),
  );

  assert.equal(tokens.size, 256);
});
