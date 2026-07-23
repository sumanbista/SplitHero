"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { getGroupAccess } from "@/lib/groups/access";
import {
  enforceRateLimit,
  getRateLimitMessage,
  isRateLimitError,
} from "@/lib/security/rate-limit";
import {
  addMemberSchema,
  memberGroupTokenSchema,
  memberMutationSchema,
} from "@/lib/validations/member";

export type AddMemberState = {
  fieldError?: string;
  formError?: string;
  memberId?: string;
  memberName?: string;
  value?: string;
};

export type MemberMutationState = {
  fieldError?: string;
  formError?: string;
  memberId?: string;
  result?: "renamed" | "archived" | "restored" | "removed";
};

const duplicateNameError = (value: string): AddMemberState => ({
  fieldError: "A member with this name is already in the group.",
  value,
});

export async function addMember(
  shareToken: string,
  _previousState: AddMemberState,
  formData: FormData,
): Promise<AddMemberState> {
  const rawName = formData.get("name");
  const validation = addMemberSchema.safeParse({ name: rawName });

  if (!validation.success) {
    return {
      fieldError: validation.error.issues[0]?.message,
      value: typeof rawName === "string" ? rawName : "",
    };
  }

  const name = validation.data.name;

  if (!memberGroupTokenSchema.safeParse(shareToken).success) {
    return {
      formError: "This group is no longer available.",
      value: name,
    };
  }

  try {
    const access = await getGroupAccess(shareToken);

    if (!access) {
      return {
        formError: "This group is no longer available.",
        value: name,
      };
    }

    if (!access.permissions.canManageMembers) {
      return {
        formError: "You don’t have permission to add members to this group.",
        value: name,
      };
    }

    await enforceRateLimit({
      action: "member.create",
      userId: access.user?.id,
      scope: access.group.id,
    });

    const supabase = createAdminClient();

    const { data: existingMembers, error: memberLookupError } = await supabase
      .from("members")
      .select("name")
      .eq("group_id", access.group.id);

    if (memberLookupError) {
      return {
        formError: "We couldn’t add this member. Please try again.",
        value: name,
      };
    }

    const normalizedName = name.toLocaleLowerCase();
    const hasDuplicate = existingMembers.some(
      (member) => member.name.trim().toLocaleLowerCase() === normalizedName,
    );

    if (hasDuplicate) {
      return duplicateNameError(name);
    }

    const { data: memberId, error: insertError } = await supabase.rpc(
      "create_member_with_activity",
      {
        p_group_id: access.group.id,
        p_name: name,
        p_actor_user_id: access.user?.id ?? null,
      },
    );

    if (insertError) {
      if (insertError.code === "23505") {
        return duplicateNameError(name);
      }

      return {
        formError: "We couldn’t add this member. Please try again.",
        value: name,
      };
    }

    revalidatePath(`/groups/${shareToken}`);

    return {
      memberId,
      memberName: name,
    };
  } catch (error) {
    if (isRateLimitError(error)) {
      return {
        formError: getRateLimitMessage(error),
        value: name,
      };
    }

    return {
      formError: "We couldn’t add this member. Please try again.",
      value: name,
    };
  }
}

export async function mutateMember(
  shareToken: string,
  _previousState: MemberMutationState,
  formData: FormData,
): Promise<MemberMutationState> {
  const rawMemberId = formData.get("memberId");
  const validation = memberMutationSchema.safeParse({
    intent: formData.get("intent"),
    memberId: rawMemberId,
    name: formData.get("name"),
  });

  if (!validation.success) {
    const nameIssue = validation.error.issues.find(
      (issue) => issue.path[0] === "name",
    );
    return nameIssue
      ? {
          fieldError: nameIssue.message,
          memberId: typeof rawMemberId === "string" ? rawMemberId : undefined,
        }
      : { formError: "This member is no longer available." };
  }

  if (!memberGroupTokenSchema.safeParse(shareToken).success) {
    return { formError: "This group is no longer available." };
  }

  try {
    const access = await getGroupAccess(shareToken);
    if (!access) {
      return { formError: "This group is no longer available." };
    }

    const input = validation.data;
    const allowed =
      input.intent === "rename"
        ? access.permissions.canRenameMembers
        : input.intent === "remove"
          ? access.permissions.canRemoveMembers
          : access.permissions.canArchiveMembers;

    if (!allowed) {
      return {
        formError: "You don’t have permission to manage members in this group.",
      };
    }

    await enforceRateLimit({
      action: "member.update",
      userId: access.user?.id,
      scope: access.group.id,
    });

    const supabase = createAdminClient();
    let result: string | null = null;
    let error: { code?: string } | null = null;

    if (input.intent === "rename") {
      const response = await supabase.rpc("rename_member_with_activity", {
        p_group_id: access.group.id,
        p_member_id: input.memberId,
        p_name: input.name,
        p_actor_user_id: access.user?.id ?? null,
      });
      result = response.data;
      error = response.error;
    } else if (input.intent === "remove") {
      const response = await supabase.rpc("remove_unused_member_with_activity", {
        p_group_id: access.group.id,
        p_member_id: input.memberId,
        p_actor_user_id: access.user?.id ?? null,
      });
      result = response.data;
      error = response.error;
    } else {
      const response = await supabase.rpc("set_member_active_with_activity", {
        p_group_id: access.group.id,
        p_member_id: input.memberId,
        p_is_active: input.intent === "restore",
        p_actor_user_id: access.user?.id ?? null,
      });
      result = response.data;
      error = response.error;
    }

    if (error?.code === "23505") {
      return {
        fieldError: "A member with this name is already in the group.",
        memberId: input.memberId,
      };
    }

    if (error || !result) {
      return {
        formError: "We couldn’t update this member. Please try again.",
        memberId: input.memberId,
      };
    }

    if (result === "missing") {
      return {
        formError: "This member is no longer available.",
        memberId: input.memberId,
      };
    }

    if (result === "account_linked") {
      return {
        formError:
          "This member is connected to an account. Archive them instead; their group access is managed separately.",
        memberId: input.memberId,
      };
    }

    if (result === "non_zero_balance") {
      return {
        formError:
          "This member still has an outstanding balance. Settle it, then archive the member.",
        memberId: input.memberId,
      };
    }

    if (result === "has_history") {
      return {
        formError:
          "This member has group history and can’t be removed permanently. Archive them instead.",
        memberId: input.memberId,
      };
    }

    const completed =
      result === "unchanged"
        ? "renamed"
        : result === "already_active"
          ? "restored"
          : result === "already_archived"
            ? "archived"
            : result;

    if (!["renamed", "archived", "restored", "removed"].includes(completed)) {
      return {
        formError: "We couldn’t update this member. Please try again.",
        memberId: input.memberId,
      };
    }

    revalidatePath(`/groups/${shareToken}`);
    return {
      memberId: input.memberId,
      result: completed as MemberMutationState["result"],
    };
  } catch (error) {
    if (isRateLimitError(error)) {
      return { formError: getRateLimitMessage(error) };
    }

    return { formError: "We couldn’t update this member. Please try again." };
  }
}
