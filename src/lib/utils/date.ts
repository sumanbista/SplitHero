const expenseDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatExpenseDate(expenseDate: string) {
  return expenseDateFormatter.format(new Date(`${expenseDate}T00:00:00Z`));
}
