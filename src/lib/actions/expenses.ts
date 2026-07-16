"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { calculateEqualShares } from "@/lib/calculations/equal-split";
import { createAdminClient } from "@/lib/supabase/admin";
import { createExpenseSchema } from "@/lib/validations/expense";
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
    const supabase = createAdminClient();
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("id")
      .eq("share_token", shareToken)
      .maybeSingle();

    if (groupError) {
      return {
        formError: "We couldn’t add this expense. Please try again.",
        values,
      };
    }

    if (!group) {
      return { formError: "This group is no longer available.", values };
    }

    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id")
      .eq("group_id", group.id)
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
        p_group_id: group.id,
        p_title: input.title,
        p_amount_cents: input.amount,
        p_paid_by_member_id: input.paidByMemberId,
        p_participant_ids: shares.map((share) => share.memberId),
        p_participant_shares: shares.map((share) => share.shareCents),
        p_expense_date: input.expenseDate ?? null,
        p_notes: input.notes ?? null,
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
  } catch {
    return {
      formError: "We couldn’t add this expense. Please try again.",
      values,
    };
  }
}
