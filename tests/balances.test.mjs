import assert from "node:assert/strict";
import test from "node:test";

import { calculateMemberBalances } from "../src/lib/calculations/balances.ts";

const members = [{ id: "suman" }, { id: "alex" }, { id: "maya" }];

test("calculates receiving, owing, and settled balances", () => {
  const balances = calculateMemberBalances(
    members,
    [
      {
        amountCents: 9000,
        paidByMemberId: "suman",
        participantShares: [
          { memberId: "suman", shareCents: 3000 },
          { memberId: "alex", shareCents: 3000 },
          { memberId: "maya", shareCents: 3000 },
        ],
      },
    ],
    [],
  );

  assert.deepEqual(balances, [
    { memberId: "suman", balanceCents: 6000, state: "receives" },
    { memberId: "alex", balanceCents: -3000, state: "owes" },
    { memberId: "maya", balanceCents: -3000, state: "owes" },
  ]);
  assert.equal(
    balances.reduce((total, balance) => total + balance.balanceCents, 0),
    0,
  );
});

test("combines multiple expenses and preserves member order", () => {
  const balances = calculateMemberBalances(
    members,
    [
      {
        amountCents: 1000,
        paidByMemberId: "alex",
        participantShares: [
          { memberId: "suman", shareCents: 334 },
          { memberId: "alex", shareCents: 333 },
          { memberId: "maya", shareCents: 333 },
        ],
      },
      {
        amountCents: 500,
        paidByMemberId: "maya",
        participantShares: [
          { memberId: "alex", shareCents: 250 },
          { memberId: "maya", shareCents: 250 },
        ],
      },
    ],
    [],
  );

  assert.deepEqual(balances, [
    { memberId: "suman", balanceCents: -334, state: "owes" },
    { memberId: "alex", balanceCents: 417, state: "receives" },
    { memberId: "maya", balanceCents: -83, state: "owes" },
  ]);
});

test("settlement payments move the sender and receiver toward zero", () => {
  const balances = calculateMemberBalances(
    members,
    [
      {
        amountCents: 9000,
        paidByMemberId: "suman",
        participantShares: [
          { memberId: "suman", shareCents: 3000 },
          { memberId: "alex", shareCents: 3000 },
          { memberId: "maya", shareCents: 3000 },
        ],
      },
    ],
    [
      { fromMemberId: "alex", toMemberId: "suman", amountCents: 3000 },
      { fromMemberId: "maya", toMemberId: "suman", amountCents: 3000 },
    ],
  );

  assert.deepEqual(balances, [
    { memberId: "suman", balanceCents: 0, state: "settled" },
    { memberId: "alex", balanceCents: 0, state: "settled" },
    { memberId: "maya", balanceCents: 0, state: "settled" },
  ]);
});

test("members with no financial activity are settled", () => {
  assert.deepEqual(calculateMemberBalances(members, [], []), [
    { memberId: "suman", balanceCents: 0, state: "settled" },
    { memberId: "alex", balanceCents: 0, state: "settled" },
    { memberId: "maya", balanceCents: 0, state: "settled" },
  ]);
});

test("rejects invalid financial records", () => {
  assert.throws(
    () =>
      calculateMemberBalances(
        members,
        [
          {
            amountCents: 100,
            paidByMemberId: "suman",
            participantShares: [{ memberId: "alex", shareCents: 99 }],
          },
        ],
        [],
      ),
    RangeError,
  );
  assert.throws(
    () =>
      calculateMemberBalances(members, [], [
        { fromMemberId: "unknown", toMemberId: "suman", amountCents: 100 },
      ]),
    RangeError,
  );
  assert.throws(
    () =>
      calculateMemberBalances(members, [], [
        { fromMemberId: "suman", toMemberId: "suman", amountCents: 100 },
      ]),
    RangeError,
  );
});
