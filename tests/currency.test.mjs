import assert from "node:assert/strict";
import test from "node:test";

import { formatCurrencyFromCents } from "../src/lib/utils/currency.ts";

test("formats integer cents as US dollars", () => {
  assert.equal(formatCurrencyFromCents(0), "$0.00");
  assert.equal(formatCurrencyFromCents(1), "$0.01");
  assert.equal(formatCurrencyFromCents(1250), "$12.50");
  assert.equal(formatCurrencyFromCents(123456), "$1,234.56");
});

test("formats negative cent amounts without losing the sign", () => {
  assert.equal(formatCurrencyFromCents(-1850), "-$18.50");
});
