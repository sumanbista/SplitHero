"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { calculateMemberBalances } from "@/lib/calculations/balances";
import { simplifySettlements } from "@/lib/calculations/settlements";
import { getGroupAccess } from "@/lib/groups/access";
import {
  enforceRateLimit,
  getRateLimitMessage,
  isRateLimitError,
} from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { memberGroupTokenSchema } from "@/lib/validations/member";
import { recordSettlementSchema } from "@/lib/validations/settlement";

export type RecordSettlementState = {
  formError?: string;
  paymentId?: string;
};

const unavailableMessage = "This settlement is no longer available.";
const failureMessage = "We couldn’t record this payment. Please try again.";

export async function recordSettlementPayment(
  shareToken: string,
  _previousState: RecordSettlementState,
  formData: FormData,
): Promise<RecordSettlementState> {
  if (!memberGroupTokenSchema.safeParse(shareToken).success) {
    return { formError: "This group is no longer available." };
  }

  const validation = recordSettlementSchema.safeParse({
    fromMemberId: formData.get("fromMemberId"),
    toMemberId: formData.get("toMemberId"),
    amountCents: formData.get("amountCents"),
  });

  if (!validation.success) {
    return { formError: unavailableMessage };
  }

  try {
    const access = await getGroupAccess(shareToken);

    if (!access) {
      return { formError: "This group is no longer available." };
    }

    if (!access.permissions.canContribute) {
      return { formError: "You don’t have permission to record payments in this group." };
    }

    await enforceRateLimit({
      action: "settlement.create",
      userId: access.user?.id,
      scope: access.group.id,
    });

    const supabase = createAdminClient();

    const [membersResult, expensesResult, paymentsResult] = await Promise.all([
      supabase
        .from("members")
        .select("id")
        .eq("group_id", access.group.id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("expenses")
        .select(
          "amount_cents, paid_by_member_id, participants:expense_participants(member_id, share_cents)",
        )
        .eq("group_id", access.group.id),
      supabase
        .from("settlement_payments")
        .select("from_member_id, to_member_id, amount_cents")
        .eq("group_id", access.group.id),
    ]);

    if (membersResult.error || expensesResult.error || paymentsResult.error) {
      return { formError: failureMessage };
    }

    const balances = calculateMemberBalances(
      membersResult.data,
      expensesResult.data.map((expense) => ({
        amountCents: Number(expense.amount_cents),
        paidByMemberId: expense.paid_by_member_id,
        participantShares: expense.participants.map((participant) => ({
          memberId: participant.member_id,
          shareCents: Number(participant.share_cents),
        })),
      })),
      paymentsResult.data.map((payment) => ({
        fromMemberId: payment.from_member_id,
        toMemberId: payment.to_member_id,
        amountCents: Number(payment.amount_cents),
      })),
    );
    const input = validation.data;
    const isCurrentRecommendation = simplifySettlements(balances).some(
      (recommendation) =>
        recommendation.fromMemberId === input.fromMemberId &&
        recommendation.toMemberId === input.toMemberId &&
        recommendation.amountCents === input.amountCents,
    );

    if (!isCurrentRecommendation) {
      return { formError: unavailableMessage };
    }

    const { data: paymentId, error: paymentError } = await supabase.rpc(
      "record_recommended_settlement_payment",
      {
        p_group_id: access.group.id,
        p_from_member_id: input.fromMemberId,
        p_to_member_id: input.toMemberId,
        p_amount_cents: input.amountCents,
        p_actor_user_id: access.user?.id ?? null,
      },
    );

    if (paymentError || typeof paymentId !== "string") {
      return { formError: unavailableMessage };
    }

    revalidatePath(`/groups/${shareToken}`);

    return { paymentId };
  } catch (error) {
    if (isRateLimitError(error)) {
      return { formError: getRateLimitMessage(error) };
    }

    return { formError: failureMessage };
  }
}
