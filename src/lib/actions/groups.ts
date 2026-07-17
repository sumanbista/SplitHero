"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { getGroupAccess } from "@/lib/groups/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateShareToken } from "@/lib/utils/share-token";
import {
  createGroupSchema,
  groupAccessModeSchema,
} from "@/lib/validations/group";

const MAX_TOKEN_ATTEMPTS = 3;

export type CreateGroupState = {
  fieldError?: string;
  formError?: string;
  value?: string;
};

export type UpdateGroupAccessState = {
  formError?: string;
  successMessage?: string;
};

export async function createGroup(
  _previousState: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  const rawName = formData.get("name");
  const validation = createGroupSchema.safeParse({ name: rawName });

  if (!validation.success) {
    return {
      fieldError: validation.error.issues[0]?.message,
      value: typeof rawName === "string" ? rawName : "",
    };
  }

  let shareToken: string | undefined;

  try {
    // The owner comes from Supabase's server-validated session, never from
    // client-submitted form data. A missing session intentionally creates the
    // same unowned public group supported by guest mode.
    const user = await getCurrentUser();
    const supabase = createAdminClient();

    for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt += 1) {
      const candidate = generateShareToken();
      const { error } = await supabase.from("groups").insert({
        name: validation.data.name,
        share_token: candidate,
        created_by_user_id: user?.id ?? null,
      });

      if (!error) {
        shareToken = candidate;
        break;
      }

      if (error.code !== "23505") {
        return {
          formError: "We couldn’t create your group. Please try again.",
          value: validation.data.name,
        };
      }
    }
  } catch {
    return {
      formError: "We couldn’t create your group. Please try again.",
      value: validation.data.name,
    };
  }

  if (!shareToken) {
    return {
      formError: "We couldn’t create a unique group link. Please try again.",
      value: validation.data.name,
    };
  }

  revalidatePath("/dashboard");
  redirect(`/groups/${shareToken}`);
}

export async function updateGroupAccess(
  shareToken: string,
  _previousState: UpdateGroupAccessState,
  formData: FormData,
): Promise<UpdateGroupAccessState> {
  const validation = groupAccessModeSchema.safeParse(formData.get("accessMode"));

  if (!validation.success) {
    return { formError: "Choose a valid group access setting." };
  }

  try {
    const access = await getGroupAccess(shareToken);

    if (!access) {
      return { formError: "This group is no longer available." };
    }

    if (!access.permissions.canChangeAccess) {
      return { formError: "Only the group owner can change access settings." };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("groups")
      .update({ access_mode: validation.data })
      .eq("id", access.group.id);

    if (error) {
      return { formError: "We couldn’t update group access. Please try again." };
    }

    revalidatePath(`/groups/${shareToken}`);
    revalidatePath("/dashboard");

    return {
      successMessage:
        validation.data === "private"
          ? "This group is now private. Only invited members can open it."
          : "This group now works for anyone with its share link.",
    };
  } catch {
    return { formError: "We couldn’t update group access. Please try again." };
  }
}
