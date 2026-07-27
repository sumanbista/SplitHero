import { calculateEqualShares } from "./equal-split.ts";

export const expenseSplitModes = ["equal", "exact", "percentage"] as const;

export type ExpenseSplitMode = (typeof expenseSplitModes)[number];

export type ParticipantSplitInput = {
  memberId: string;
  value: string;
};

export type FinalizedExpenseShare = {
  memberId: string;
  shareCents: number;
  percentageBasisPoints: number | null;
};

export class ExpenseSplitError extends RangeError {}

export function parseCurrencyToCents(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const dollars = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const totalCents = dollars * 100 + cents;

  return Number.isSafeInteger(totalCents) ? totalCents : null;
}

export function parsePercentageToBasisPoints(value: string) {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const wholePercent = Number(match[1]);
  const fractionalPercent = Number((match[2] ?? "").padEnd(2, "0"));
  const basisPoints = wholePercent * 100 + fractionalPercent;

  return basisPoints <= 10_000 ? basisPoints : null;
}

function getOrderedInputs(
  participantIds: string[],
  participantInputs: ParticipantSplitInput[],
) {
  if (new Set(participantIds).size !== participantIds.length) {
    throw new ExpenseSplitError("Participants must be unique.");
  }

  const inputsByMemberId = new Map<string, string>();

  for (const input of participantInputs) {
    if (inputsByMemberId.has(input.memberId)) {
      throw new ExpenseSplitError("Participant shares must be unique.");
    }
    inputsByMemberId.set(input.memberId, input.value);
  }

  if (
    inputsByMemberId.size !== participantIds.length ||
    participantIds.some((memberId) => !inputsByMemberId.has(memberId))
  ) {
    throw new ExpenseSplitError(
      "Enter a share for every selected participant.",
    );
  }

  return participantIds.map((memberId) => ({
    memberId,
    value: inputsByMemberId.get(memberId) ?? "",
  }));
}

export function calculateExpenseShares(
  amountCents: number,
  participantIds: string[],
  splitMode: ExpenseSplitMode,
  participantInputs: ParticipantSplitInput[] = [],
): FinalizedExpenseShare[] {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new ExpenseSplitError(
      "Expense amount must be a positive integer cent amount.",
    );
  }

  if (participantIds.length === 0) {
    throw new ExpenseSplitError("Select at least one participant.");
  }

  if (splitMode === "equal") {
    return calculateEqualShares(amountCents, participantIds).map((share) => ({
      ...share,
      percentageBasisPoints: null,
    }));
  }

  const orderedInputs = getOrderedInputs(participantIds, participantInputs);

  if (splitMode === "exact") {
    const shares = orderedInputs.map(({ memberId, value }) => {
      const shareCents = parseCurrencyToCents(value);

      if (shareCents === null) {
        throw new ExpenseSplitError(
          "Enter a valid amount for every selected participant.",
        );
      }

      return { memberId, shareCents, percentageBasisPoints: null };
    });

    if (
      shares.reduce((total, share) => total + share.shareCents, 0) !==
      amountCents
    ) {
      throw new ExpenseSplitError(
        "Exact shares must add up to the expense total.",
      );
    }

    return shares;
  }

  const percentages = orderedInputs.map(({ memberId, value }, index) => {
    const percentageBasisPoints = parsePercentageToBasisPoints(value);

    if (percentageBasisPoints === null) {
      throw new ExpenseSplitError(
        "Enter a valid percentage for every selected participant.",
      );
    }

    const numerator =
      BigInt(amountCents) * BigInt(percentageBasisPoints);

    return {
      memberId,
      percentageBasisPoints,
      index,
      shareCents: Number(numerator / BigInt(10_000)),
      remainder: numerator % BigInt(10_000),
    };
  });

  if (
    percentages.reduce(
      (total, share) => total + share.percentageBasisPoints,
      0,
    ) !== 10_000
  ) {
    throw new ExpenseSplitError("Percentages must add up to 100%.");
  }

  const allocatedCents = percentages.reduce(
    (total, share) => total + share.shareCents,
    0,
  );
  const remainderRecipients = percentages.toSorted((left, right) => {
    if (left.remainder === right.remainder) {
      return left.index - right.index;
    }
    return left.remainder > right.remainder ? -1 : 1;
  });

  for (
    let index = 0;
    index < amountCents - allocatedCents;
    index += 1
  ) {
    remainderRecipients[index].shareCents += 1;
  }

  return percentages.map(
    ({ memberId, percentageBasisPoints, shareCents }) => ({
      memberId,
      percentageBasisPoints,
      shareCents,
    }),
  );
}
