import type { MemberBalance } from "@/lib/calculations/balances";

export type SettlementRecommendation = {
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
};

type OutstandingBalance = {
  memberId: string;
  amountCents: number;
  order: number;
};

function byLargestAmount(
  left: OutstandingBalance,
  right: OutstandingBalance,
) {
  return right.amountCents - left.amountCents || left.order - right.order;
}

/**
 * Reduces net balances to a deterministic set of debtor-to-creditor payments.
 * The input is never mutated and all calculations remain in integer cents.
 */
export function simplifySettlements(
  balances: Pick<MemberBalance, "memberId" | "balanceCents">[],
): SettlementRecommendation[] {
  const seenMemberIds = new Set<string>();
  const debtors: OutstandingBalance[] = [];
  const creditors: OutstandingBalance[] = [];
  let balanceTotalCents = 0;

  balances.forEach((balance, order) => {
    if (seenMemberIds.has(balance.memberId)) {
      throw new RangeError("Member balances must be unique.");
    }

    if (!Number.isSafeInteger(balance.balanceCents)) {
      throw new RangeError("Balances must use valid integer cent amounts.");
    }

    seenMemberIds.add(balance.memberId);
    balanceTotalCents += balance.balanceCents;

    if (balance.balanceCents < 0) {
      debtors.push({
        memberId: balance.memberId,
        amountCents: -balance.balanceCents,
        order,
      });
    } else if (balance.balanceCents > 0) {
      creditors.push({
        memberId: balance.memberId,
        amountCents: balance.balanceCents,
        order,
      });
    }
  });

  if (balanceTotalCents !== 0) {
    throw new RangeError("Member balances must add up to zero.");
  }

  debtors.sort(byLargestAmount);
  creditors.sort(byLargestAmount);

  const recommendations: SettlementRecommendation[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountCents = Math.min(
      debtor.amountCents,
      creditor.amountCents,
    );

    recommendations.push({
      fromMemberId: debtor.memberId,
      toMemberId: creditor.memberId,
      amountCents,
    });

    debtor.amountCents -= amountCents;
    creditor.amountCents -= amountCents;

    if (debtor.amountCents === 0) {
      debtorIndex += 1;
    }

    if (creditor.amountCents === 0) {
      creditorIndex += 1;
    }
  }

  return recommendations;
}
