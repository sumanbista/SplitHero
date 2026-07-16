import assert from "node:assert/strict";
import test from "node:test";

import { createExpenseSchema } from "../src/lib/validations/expense.ts";

const validExpense = {
  title: "Dinner",
  amount: "90.00",
  paidByMemberId: "00000000-0000-4000-8000-000000000001",
  participantIds: [
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
  ],
  expenseDate: "",
  notes: "",
};

test("expense validation trims text and converts dollars to cents", () => {
  const result = createExpenseSchema.parse({
    ...validExpense,
    title: "  Dinner  ",
    amount: "10.05",
  });

  assert.equal(result.title, "Dinner");
  assert.equal(result.amount, 1005);
  assert.equal(result.expenseDate, undefined);
  assert.equal(result.notes, undefined);
});

test("expense validation rejects zero and fractional cents", () => {
  assert.equal(
    createExpenseSchema.safeParse({ ...validExpense, amount: "0.00" })
      .success,
    false,
  );
  assert.equal(
    createExpenseSchema.safeParse({ ...validExpense, amount: "10.005" })
      .success,
    false,
  );
});

test("expense validation requires a payer and participant", () => {
  assert.equal(
    createExpenseSchema.safeParse({
      ...validExpense,
      paidByMemberId: "",
      participantIds: [],
    }).success,
    false,
  );
});

test("expense validation rejects impossible dates", () => {
  assert.equal(
    createExpenseSchema.safeParse({
      ...validExpense,
      expenseDate: "2026-02-30",
    }).success,
    false,
  );
});
