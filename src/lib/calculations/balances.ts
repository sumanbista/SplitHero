export type BalanceMember = {
  id: string;
};

export type BalanceExpense = {
  amountCents: number;
  paidByMemberId: string;
  participantShares: Array<{
    memberId: string;
    shareCents: number;
  }>;
};

export type BalanceSettlementPayment = {
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
};

export type MemberBalance = {
  memberId: string;
  balanceCents: number;
  state: "receives" | "owes" | "settled";
};

function assertCents(value: number, label: string, allowZero: boolean) {
  if (
    !Number.isSafeInteger(value) ||
    (allowZero ? value < 0 : value <= 0)
  ) {
    throw new RangeError(`${label} must be a valid integer cent amount.`);
  }
}

function getMemberBalance(
  balances: Map<string, number>,
  memberId: string,
) {
  const balance = balances.get(memberId);

  if (balance === undefined) {
    throw new RangeError("Financial records must reference known members.");
  }

  return balance;
}

/**
 * Calculates each member's net balance using integer cents only.
 * Positive balances receive money, negative balances owe money, and zero is settled.
 */
export function calculateMemberBalances(
  members: BalanceMember[],
  expenses: BalanceExpense[],
  settlementPayments: BalanceSettlementPayment[],
): MemberBalance[] {
  const balances = new Map<string, number>();

  for (const member of members) {
    if (balances.has(member.id)) {
      throw new RangeError("Members must be unique.");
    }

    balances.set(member.id, 0);
  }

  for (const expense of expenses) {
    assertCents(expense.amountCents, "Expense amount", false);
    getMemberBalance(balances, expense.paidByMemberId);
    let shareTotalCents = 0;

    for (const participant of expense.participantShares) {
      assertCents(participant.shareCents, "Participant share", true);
      const participantBalance = getMemberBalance(
        balances,
        participant.memberId,
      );

      shareTotalCents += participant.shareCents;
      balances.set(
        participant.memberId,
        participantBalance - participant.shareCents,
      );
    }

    if (shareTotalCents !== expense.amountCents) {
      throw new RangeError("Expense shares must equal the expense amount.");
    }

    balances.set(
      expense.paidByMemberId,
      getMemberBalance(balances, expense.paidByMemberId) + expense.amountCents,
    );
  }

  for (const payment of settlementPayments) {
    assertCents(payment.amountCents, "Settlement payment", false);
    const senderBalance = getMemberBalance(balances, payment.fromMemberId);
    const receiverBalance = getMemberBalance(balances, payment.toMemberId);

    balances.set(
      payment.fromMemberId,
      senderBalance - payment.amountCents,
    );
    balances.set(
      payment.toMemberId,
      receiverBalance + payment.amountCents,
    );
  }

  return members.map((member) => {
    const balanceCents = getMemberBalance(balances, member.id);

    return {
      memberId: member.id,
      balanceCents,
      state:
        balanceCents > 0
          ? "receives"
          : balanceCents < 0
            ? "owes"
            : "settled",
    };
  });
}
