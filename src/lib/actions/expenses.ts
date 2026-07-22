"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { calculateEqualShares } from "@/lib/calculations/equal-split";
import { getGroupAccess } from "@/lib/groups/access";
import { writeSecurityAuditEvent } from "@/lib/security/audit";
import {
  enforceRateLimit,
  getRateLimitMessage,
  isRateLimitError,
} from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createExpenseSchema,
  expenseMutationTargetSchema,
} from "@/lib/validations/expense";
import { memberGroupTokenSchema } from "@/lib/validations/member";

export type ExpenseFieldErrors = Partial<
  Record<
    | "title"
    | "amount"
    | "paidByMemberId"
    | "participantIds"
    | "expenseDate"
    | "notes",
    string
  >
>;

export type ExpenseFormValues = {
  title: string;
  amount: string;
  paidByMemberId: string;
  participantIds: string[];
  expenseDate: string;
  notes: string;
};

export type AddExpenseState = {
  fieldErrors?: ExpenseFieldErrors;
  formError?: string;
  expenseId?: string;
  expenseTitle?: string;
  values?: ExpenseFormValues;
};

export type UpdateExpenseState = AddExpenseState & {
  updatedExpenseId?: string;
};

export type DeleteExpenseState = {
  deletedExpenseId?: string;
  formError?: string;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getFormValues(formData: FormData): ExpenseFormValues {
  return {
    title: getString(formData, "title"),
    amount: getString(formData, "amount"),
    paidByMemberId: getString(formData, "paidByMemberId"),
    participantIds: formData
      .getAll("participantIds")
      .filter((value): value is string => typeof value === "string"),
    expenseDate: getString(formData, "expenseDate"),
    notes: getString(formData, "notes"),
  };
}

function getFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
): ExpenseFieldErrors {
  return {
    title: fieldErrors.title?.[0],
    amount: fieldErrors.amount?.[0],
    paidByMemberId: fieldErrors.paidByMemberId?.[0],
    participantIds: fieldErrors.participantIds?.[0],
    expenseDate: fieldErrors.expenseDate?.[0],
    notes: fieldErrors.notes?.[0],
  };
}

export async function addExpense(
  shareToken: string,
  _previousState: AddExpenseState,
  formData: FormData,
): Promise<AddExpenseState> {
  const values = getFormValues(formData);
  const validation = createExpenseSchema.safeParse(values);

  if (!validation.success) {
    return {
      fieldErrors: getFieldErrors(validation.error.flatten().fieldErrors),
      values,
    };
  }

  if (!memberGroupTokenSchema.safeParse(shareToken).success) {
    return { formError: "This group is no longer available.", values };
  }

  const input = validation.data;

  try {
    const access = await getGroupAccess(shareToken);

    if (!access) {
      return { formError: "This group is no longer available.", values };
    }

    if (!access.permissions.canContribute) {
      return {
        formError: "You don’t have permission to add expenses to this group.",
        values,
      };
    }

    await enforceRateLimit({
      action: "expense.create",
      userId: access.user?.id,
      scope: access.group.id,
    });

    const supabase = createAdminClient();

    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id")
      .eq("group_id", access.group.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (membersError) {
      return {
        formError: "We couldn’t add this expense. Please try again.",
        values,
      };
    }

    const memberIds = new Set(members.map((member) => member.id));

    if (!memberIds.has(input.paidByMemberId)) {
      return {
        fieldErrors: { paidByMemberId: "Select a payer from this group." },
        values,
      };
    }

    const requestedParticipantIds = new Set(input.participantIds);
    const orderedParticipantIds = members
      .filter((member) => requestedParticipantIds.has(member.id))
      .map((member) => member.id);

    if (
      requestedParticipantIds.size !== input.participantIds.length ||
      orderedParticipantIds.length !== requestedParticipantIds.size
    ) {
      return {
        fieldErrors: {
          participantIds: "Select participants from this group.",
        },
        values,
      };
    }

    const shares = calculateEqualShares(
      input.amount,
      orderedParticipantIds,
    );
    const { data: expenseId, error: transactionError } = await supabase.rpc(
      "create_expense_with_participants",
      {
        p_group_id: access.group.id,
        p_title: input.title,
        p_amount_cents: input.amount,
        p_paid_by_member_id: input.paidByMemberId,
        p_participant_ids: shares.map((share) => share.memberId),
        p_participant_shares: shares.map((share) => share.shareCents),
        p_expense_date: input.expenseDate ?? null,
        p_notes: input.notes ?? null,
        p_actor_user_id: access.user?.id ?? null,
      },
    );

    if (transactionError || typeof expenseId !== "string") {
      return {
        formError: "We couldn’t add this expense. Please try again.",
        values,
      };
    }

    revalidatePath(`/groups/${shareToken}`);

    return { expenseId, expenseTitle: input.title };
  } catch (error) {
    if (isRateLimitError(error)) {
      return { formError: getRateLimitMessage(error), values };
    }

    return {
      formError: "We couldn’t add this expense. Please try again.",
      values,
    };
  }
}

export async function updateExpense(
  shareToken: string,
  _previousState: UpdateExpenseState,
  formData: FormData,
): Promise<UpdateExpenseState> {
  const values = getFormValues(formData);
  const [expenseValidation, targetValidation] = [
    createExpenseSchema.safeParse(values),
    expenseMutationTargetSchema.safeParse({
      expenseId: formData.get("expenseId"),
      expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    }),
  ];

  if (!expenseValidation.success) {
    return {
      fieldErrors: getFieldErrors(expenseValidation.error.flatten().fieldErrors),
      values,
    };
  }

  if (
    !targetValidation.success ||
    !memberGroupTokenSchema.safeParse(shareToken).success
  ) {
    return { formError: "This expense is no longer available.", values };
  }

  const input = expenseValidation.data;
  const target = targetValidation.data;

  try {
    const access = await getGroupAccess(shareToken);

    if (!access) {
      return { formError: "This group is no longer available.", values };
    }

    if (!access.permissions.canEditExpenses) {
      await writeSecurityAuditEvent({
        eventType: "expense.update",
        outcome: "denied",
        actorUserId: access.user?.id,
        groupId: access.group.id,
        metadata: { expenseId: target.expenseId },
      });
      return {
        formError: "You don’t have permission to edit expenses in this group.",
        values,
      };
    }

    await enforceRateLimit({
      action: "expense.update",
      userId: access.user?.id,
      scope: access.group.id,
    });

    const supabase = createAdminClient();
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id")
      .eq("group_id", access.group.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (membersError) {
      return {
        formError: "We couldn’t update this expense. Please try again.",
        values,
      };
    }

    const memberIds = new Set(members.map((member) => member.id));

    if (!memberIds.has(input.paidByMemberId)) {
      return {
        fieldErrors: { paidByMemberId: "Select a payer from this group." },
        values,
      };
    }

    const requestedParticipantIds = new Set(input.participantIds);
    const orderedParticipantIds = members
      .filter((member) => requestedParticipantIds.has(member.id))
      .map((member) => member.id);

    if (
      requestedParticipantIds.size !== input.participantIds.length ||
      orderedParticipantIds.length !== requestedParticipantIds.size
    ) {
      return {
        fieldErrors: {
          participantIds: "Select participants from this group.",
        },
        values,
      };
    }

    const shares = calculateEqualShares(input.amount, orderedParticipantIds);
    const { data: result, error: transactionError } = await supabase.rpc(
      "update_expense_with_participants",
      {
        p_group_id: access.group.id,
        p_expense_id: target.expenseId,
        p_expected_updated_at: target.expectedUpdatedAt,
        p_title: input.title,
        p_amount_cents: input.amount,
        p_paid_by_member_id: input.paidByMemberId,
        p_participant_ids: shares.map((share) => share.memberId),
        p_participant_shares: shares.map((share) => share.shareCents),
        p_expense_date: input.expenseDate ?? null,
        p_notes: input.notes ?? null,
        p_actor_user_id: access.user?.id ?? null,
      },
    );

    if (transactionError) {
      return {
        formError: "We couldn’t update this expense. Please try again.",
        values,
      };
    }

    if (result === "conflict") {
      return {
        formError:
          "This expense was changed by someone else. Refresh and try again.",
        values,
      };
    }

    if (result !== "updated") {
      return { formError: "This expense is no longer available.", values };
    }

    await writeSecurityAuditEvent({
      eventType: "expense.update",
      outcome: "allowed",
      actorUserId: access.user?.id,
      groupId: access.group.id,
      metadata: { expenseId: target.expenseId },
    });
    revalidatePath(`/groups/${shareToken}`);

    return {
      updatedExpenseId: target.expenseId,
      expenseTitle: input.title,
    };
  } catch (error) {
    if (isRateLimitError(error)) {
      return { formError: getRateLimitMessage(error), values };
    }

    return {
      formError: "We couldn’t update this expense. Please try again.",
      values,
    };
  }
}

export async function deleteExpense(
  shareToken: string,
  _previousState: DeleteExpenseState,
  formData: FormData,
): Promise<DeleteExpenseState> {
  const targetValidation = expenseMutationTargetSchema.safeParse({
    expenseId: formData.get("expenseId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
  });

  if (
    !targetValidation.success ||
    !memberGroupTokenSchema.safeParse(shareToken).success
  ) {
    return { formError: "This expense is no longer available." };
  }

  const target = targetValidation.data;

  try {
    const access = await getGroupAccess(shareToken);

    if (!access) {
      return { formError: "This group is no longer available." };
    }

    if (!access.permissions.canDeleteExpenses) {
      await writeSecurityAuditEvent({
        eventType: "expense.delete",
        outcome: "denied",
        actorUserId: access.user?.id,
        groupId: access.group.id,
        metadata: { expenseId: target.expenseId },
      });
      return {
        formError: "You don’t have permission to delete expenses in this group.",
      };
    }

    await enforceRateLimit({
      action: "expense.delete",
      userId: access.user?.id,
      scope: access.group.id,
    });

    const supabase = createAdminClient();
    const { data: result, error: transactionError } = await supabase.rpc(
      "delete_expense",
      {
        p_group_id: access.group.id,
        p_expense_id: target.expenseId,
        p_expected_updated_at: target.expectedUpdatedAt,
        p_actor_user_id: access.user?.id ?? null,
      },
    );

    if (transactionError) {
      return {
        formError: "We couldn’t delete this expense. Please try again.",
      };
    }

    if (result === "conflict") {
      return {
        formError:
          "This expense was changed by someone else. Refresh and try again.",
      };
    }

    if (result !== "deleted") {
      return { formError: "This expense was already removed." };
    }

    await writeSecurityAuditEvent({
      eventType: "expense.delete",
      outcome: "allowed",
      actorUserId: access.user?.id,
      groupId: access.group.id,
      metadata: { expenseId: target.expenseId },
    });
    revalidatePath(`/groups/${shareToken}`);

    return { deletedExpenseId: target.expenseId };
  } catch (error) {
    if (isRateLimitError(error)) {
      return { formError: getRateLimitMessage(error) };
    }

    return {
      formError: "We couldn’t delete this expense. Please try again.",
    };
  }
}
