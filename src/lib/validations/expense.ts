import { z } from "zod";

import {
  calculateExpenseShares,
  ExpenseSplitError,
  expenseSplitModes,
  parseCurrencyToCents,
} from "../calculations/expense-split.ts";

function isValidExpenseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const expenseAmountSchema = z
  .string()
  .trim()
  .min(1, "Enter an amount.")
  .max(15, "Enter a smaller amount.")
  .refine((value) => {
    const amountCents = parseCurrencyToCents(value);
    return amountCents !== null && amountCents > 0;
  }, "Enter an amount greater than $0.00.")
  .transform((value) => parseCurrencyToCents(value) as number);

const optionalExpenseDateSchema = z
  .union([
    z.literal(""),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
      .refine(isValidExpenseDate, "Enter a valid date."),
  ])
  .transform((value) => value || undefined);

export const createExpenseSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Enter an expense title.")
      .max(100, "Expense titles must be 100 characters or fewer."),
    amount: expenseAmountSchema,
    paidByMemberId: z.string().uuid("Select who paid."),
    participantIds: z
      .array(z.string().uuid("Select valid participants."))
      .min(1, "Select at least one participant."),
    splitMode: z.enum(expenseSplitModes).default("equal"),
    participantShares: z
      .array(
        z.object({
          memberId: z.string().uuid(),
          value: z.string(),
        }),
      )
      .default([]),
    expenseDate: optionalExpenseDateSchema,
    notes: z
      .string()
      .trim()
      .max(1000, "Notes must be 1,000 characters or fewer.")
      .transform((value) => value || undefined),
  })
  .superRefine((expense, context) => {
    try {
      calculateExpenseShares(
        expense.amount,
        expense.participantIds,
        expense.splitMode,
        expense.participantShares,
      );
    } catch (error) {
      context.addIssue({
        code: "custom",
        message:
          error instanceof ExpenseSplitError
            ? error.message
            : "Enter a valid split.",
        path:
          expense.splitMode === "equal"
            ? ["participantIds"]
            : ["participantShares"],
      });
    }
  });

export const expenseMutationTargetSchema = z.object({
  expenseId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});
