import assert from "node:assert/strict";
import test from "node:test";

import { explainMemberBalance } from "../src/lib/calculations/balance-explanation.ts";
import { calculateMemberBalances } from "../src/lib/calculations/balances.ts";

const members = [{ id: "asha" }, { id: "ben" }, { id: "chloe" }];

const expenses = [
  {
    id: "dinner",
    title: "Dinner",
    date: "2026-11-26",
    amountCents: 12000,
    paidByMemberId: "asha",
    paidByName: "Asha",
    participantShares: [
      { memberId: "asha", shareCents: 4000 },
      { memberId: "ben", shareCents: 4000 },
      { memberId: "chloe", shareCents: 4000 },
    ],
  },
  {
    id: "taxi",
    title: "Taxi",
    date: "2026-11-25",
    amountCents: 3000,
    paidByMemberId: "ben",
    paidByName: "Ben",
    participantShares: [
      { memberId: "asha", shareCents: 1500 },
      { memberId: "ben", shareCents: 750 },
      { memberId: "chloe", shareCents: 750 },
    ],
  },
  {
    id: "snacks",
    title: "Snacks",
    date: "2026-11-27",
    amountCents: 1000,
    paidByMemberId: "asha",
    paidByName: "Asha",
    participantShares: [
      { memberId: "asha", shareCents: 500 },
      { memberId: "ben", shareCents: 500 },
    ],
  },
];

const payments = [
  {
    id: "pay-1",
    date: "2026-11-27",
    fromMemberId: "ben",
    fromMemberName: "Ben",
    toMemberId: "asha",
    toMemberName: "Asha",
    amountCents: 500,
  },
];

function toBalanceInput() {
  return {
    expenses: expenses.map((expense) => ({
      amountCents: expense.amountCents,
      paidByMemberId: expense.paidByMemberId,
      participantShares: expense.participantShares,
    })),
    payments: payments.map((payment) => ({
      fromMemberId: payment.fromMemberId,
      toMemberId: payment.toMemberId,
      amountCents: payment.amountCents,
    })),
  };
}

test("explanation totals always equal the calculated balance", () => {
  const input = toBalanceInput();
  const balances = calculateMemberBalances(
    members,
    input.expenses,
    input.payments,
  );

  for (const balance of balances) {
    const explanation = explainMemberBalance(
      balance.memberId,
      expenses,
      payments,
    );

    assert.equal(
      explanation.totalCents,
      balance.balanceCents,
      `${balance.memberId} explanation must add up to their balance`,
    );
  }
});

test("lines show what the member paid and their share for each expense", () => {
  const explanation = explainMemberBalance("asha", expenses, payments);
  const dinner = explanation.lines.find((line) => line.id === "dinner");

  assert.equal(dinner?.kind, "expense");
  assert.equal(dinner?.paidCents, 12000);
  assert.equal(dinner?.shareCents, 4000);
  assert.equal(dinner?.netCents, 8000);
});

test("payments sent raise the balance and payments received lower it", () => {
  const sender = explainMemberBalance("ben", expenses, payments);
  const receiver = explainMemberBalance("asha", expenses, payments);
  const sent = sender.lines.find((line) => line.kind === "payment");
  const received = receiver.lines.find((line) => line.kind === "payment");

  assert.equal(sent?.direction, "sent");
  assert.equal(sent?.otherMemberName, "Asha");
  assert.equal(sent?.netCents, 500);
  assert.equal(received?.direction, "received");
  assert.equal(received?.otherMemberName, "Ben");
  assert.equal(received?.netCents, -500);
});

test("expenses the member is not part of are left out", () => {
  const explanation = explainMemberBalance("chloe", expenses, payments);

  assert.deepEqual(
    explanation.lines.map((line) => line.id),
    ["taxi", "dinner"],
  );
});

test("lines are ordered by date, keeping input order for ties", () => {
  const explanation = explainMemberBalance("asha", expenses, payments);

  assert.deepEqual(
    explanation.lines.map((line) => line.id),
    ["taxi", "dinner", "snacks", "pay-1"],
  );
});

test("a member with no activity has no lines and a zero total", () => {
  const explanation = explainMemberBalance("nobody", expenses, payments);

  assert.deepEqual(explanation.lines, []);
  assert.equal(explanation.totalCents, 0);
});

test("a member who both paid and took a share nets the two on one line", () => {
  const explanation = explainMemberBalance("ben", expenses, []);
  const taxi = explanation.lines.find((line) => line.id === "taxi");

  assert.equal(taxi?.paidCents, 3000);
  assert.equal(taxi?.shareCents, 750);
  assert.equal(taxi?.netCents, 2250);
});
