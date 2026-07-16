import assert from "node:assert/strict";
import test from "node:test";

import { simplifySettlements } from "../src/lib/calculations/settlements.ts";

test("matches the largest debtors and creditors first", () => {
  const balances = [
    { memberId: "alex", balanceCents: -4000 },
    { memberId: "maya", balanceCents: -2000 },
    { memberId: "suman", balanceCents: 6000 },
  ];

  assert.deepEqual(simplifySettlements(balances), [
    {
      fromMemberId: "alex",
      toMemberId: "suman",
      amountCents: 4000,
    },
    {
      fromMemberId: "maya",
      toMemberId: "suman",
      amountCents: 2000,
    },
  ]);
  assert.deepEqual(balances, [
    { memberId: "alex", balanceCents: -4000 },
    { memberId: "maya", balanceCents: -2000 },
    { memberId: "suman", balanceCents: 6000 },
  ]);
});

test("creates deterministic recommendations across multiple creditors", () => {
  assert.deepEqual(
    simplifySettlements([
      { memberId: "debtor-a", balanceCents: -5000 },
      { memberId: "debtor-b", balanceCents: -2000 },
      { memberId: "creditor-a", balanceCents: 4000 },
      { memberId: "creditor-b", balanceCents: 3000 },
    ]),
    [
      {
        fromMemberId: "debtor-a",
        toMemberId: "creditor-a",
        amountCents: 4000,
      },
      {
        fromMemberId: "debtor-a",
        toMemberId: "creditor-b",
        amountCents: 1000,
      },
      {
        fromMemberId: "debtor-b",
        toMemberId: "creditor-b",
        amountCents: 2000,
      },
    ],
  );
});

test("returns no recommendations when everyone is settled", () => {
  assert.deepEqual(
    simplifySettlements([
      { memberId: "alex", balanceCents: 0 },
      { memberId: "maya", balanceCents: 0 },
    ]),
    [],
  );
});

test("rejects invalid or unbalanced member balances", () => {
  assert.throws(
    () =>
      simplifySettlements([
        { memberId: "alex", balanceCents: -100 },
        { memberId: "maya", balanceCents: 99 },
      ]),
    RangeError,
  );
  assert.throws(
    () =>
      simplifySettlements([
        { memberId: "alex", balanceCents: -100 },
        { memberId: "alex", balanceCents: 100 },
      ]),
    RangeError,
  );
});
