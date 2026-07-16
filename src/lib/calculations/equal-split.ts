export type EqualShare = {
  memberId: string;
  shareCents: number;
};

/**
 * Splits integer cents in the supplied participant order. The caller owns the
 * deterministic ordering so remainder cents always go to the same members.
 */
export function calculateEqualShares(
  amountCents: number,
  participantIds: string[],
): EqualShare[] {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new RangeError("Expense amount must be a positive integer.");
  }

  if (participantIds.length === 0) {
    throw new RangeError("At least one participant is required.");
  }

  if (new Set(participantIds).size !== participantIds.length) {
    throw new RangeError("Participants must be unique.");
  }

  const baseShare = Math.floor(amountCents / participantIds.length);
  const remainder = amountCents % participantIds.length;

  return participantIds.map((memberId, index) => ({
    memberId,
    shareCents: baseShare + (index < remainder ? 1 : 0),
  }));
}
