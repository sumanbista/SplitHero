import { z } from "zod";

function parseCurrencyToCents(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const dollars = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const totalCents = dollars * 100 + cents;

  return Number.isSafeInteger(totalCents) ? totalCents : null;
}

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

export const createExpenseSchema = z.object({
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
  expenseDate: optionalExpenseDateSchema,
  notes: z
    .string()
    .trim()
    .max(1000, "Notes must be 1,000 characters or fewer.")
    .transform((value) => value || undefined),
});
