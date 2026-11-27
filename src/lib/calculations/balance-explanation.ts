export type ExplainableExpense = {
  id: string;
  title: string;
  /** ISO date (YYYY-MM-DD) used only to order the explanation. */
  date: string;
  amountCents: number;
  paidByMemberId: string;
  paidByName: string;
  participantShares: Array<{
    memberId: string;
    shareCents: number;
  }>;
};

export type ExplainablePayment = {
  id: string;
  date: string;
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amountCents: number;
};

export type BalanceExpenseLine = {
  kind: "expense";
  id: string;
  title: string;
  date: string;
  paidByName: string;
  /** What this member put in for the expense (their payment). */
  paidCents: number;
  /** What this member's share of the expense was. */
  shareCents: number;
  /** paidCents - shareCents. Positive means the group owes them. */
  netCents: number;
};

export type BalancePaymentLine = {
  kind: "payment";
  id: string;
  date: string;
  /** "sent" reduces what the member owes; "received" reduces what they get back. */
  direction: "sent" | "received";
  otherMemberName: string;
  amountCents: number;
  /** Signed effect on the balance: sent is positive, received is negative. */
  netCents: number;
};

export type BalanceLine = BalanceExpenseLine | BalancePaymentLine;

export type BalanceExplanation = {
  memberId: string;
  lines: BalanceLine[];
  /** Sum of every line. Always equals the member's balance. */
  totalCents: number;
};

/**
 * Breaks one member's balance down into the expenses and payments that
 * produced it, so the balance can be audited line by line. Uses integer cents
 * only, and the lines always sum to the same total as calculateMemberBalances.
 */
export function explainMemberBalance(
  memberId: string,
  expenses: ExplainableExpense[],
  payments: ExplainablePayment[],
): BalanceExplanation {
  const dated: Array<{ date: string; order: number; line: BalanceLine }> = [];
  let order = 0;

  for (const expense of expenses) {
    const paidCents =
      expense.paidByMemberId === memberId ? expense.amountCents : 0;
    const shareCents = expense.participantShares
      .filter((share) => share.memberId === memberId)
      .reduce((total, share) => total + share.shareCents, 0);

    if (paidCents === 0 && shareCents === 0) continue;

    dated.push({
      date: expense.date,
      order: order++,
      line: {
        kind: "expense",
        id: expense.id,
        title: expense.title,
        date: expense.date,
        paidByName: expense.paidByName,
        paidCents,
        shareCents,
        netCents: paidCents - shareCents,
      },
    });
  }

  for (const payment of payments) {
    if (payment.fromMemberId === memberId) {
      dated.push({
        date: payment.date,
        order: order++,
        line: {
          kind: "payment",
          id: payment.id,
          date: payment.date,
          direction: "sent",
          otherMemberName: payment.toMemberName,
          amountCents: payment.amountCents,
          netCents: payment.amountCents,
        },
      });
    } else if (payment.toMemberId === memberId) {
      dated.push({
        date: payment.date,
        order: order++,
        line: {
          kind: "payment",
          id: payment.id,
          date: payment.date,
          direction: "received",
          otherMemberName: payment.fromMemberName,
          amountCents: payment.amountCents,
          netCents: -payment.amountCents,
        },
      });
    }
  }

  dated.sort((left, right) =>
    left.date === right.date
      ? left.order - right.order
      : left.date < right.date
        ? -1
        : 1,
  );

  const lines = dated.map((entry) => entry.line);

  return {
    memberId,
    lines,
    totalCents: lines.reduce((total, line) => total + line.netCents, 0),
  };
}
