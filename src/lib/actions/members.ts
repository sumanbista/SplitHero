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
} from "@/lib/validations/member";

export type AddMemberState = {
  fieldError?: string;
  formError?: string;
  memberId?: string;
  memberName?: string;
  value?: string;
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

    const { data: member, error: insertError } = await supabase
      .from("members")
      .insert({ group_id: access.group.id, name })
      .select("id")
      .single();

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
      memberId: member.id,
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
