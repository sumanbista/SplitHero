"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { getGroupAccess } from "@/lib/groups/access";
import { writeSecurityAuditEvent } from "@/lib/security/audit";
import {
  enforceRateLimit,
  getRateLimitMessage,
  isRateLimitError,
} from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateShareToken } from "@/lib/utils/share-token";
import {
  createGroupSchema,
  deleteGroupConfirmationSchema,
  groupAccessModeSchema,
  groupLifecycleIntentSchema,
  updateGroupDetailsSchema,
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

export type UpdateGroupDetailsState = {
  fieldErrors?: {
    name?: string[];
    description?: string[];
  };
  formError?: string;
  successMessage?: string;
};

export type GroupLifecycleState = {
  formError?: string;
  successMessage?: string;
};

export type DeleteGroupState = {
  confirmationError?: string;
  formError?: string;
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
    await enforceRateLimit({ action: "group.create", userId: user?.id });
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
        console.error("Group creation database error.", {
          code: error.code,
          message: error.message,
        });
        return {
          formError: "We couldn’t create your group. Please try again.",
          value: validation.data.name,
        };
      }
    }
  } catch (error) {
    if (isRateLimitError(error)) {
      return {
        formError: getRateLimitMessage(error),
        value: validation.data.name,
      };
    }

    console.error("Unexpected group creation error.", {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : "Unknown error",
    });

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

    if (access.group.archivedAt) {
      return {
        formError: "Restore this group before changing its access setting.",
      };
    }

    if (!access.permissions.canChangeAccess) {
      await writeSecurityAuditEvent({
        eventType: "group.access.update",
        outcome: "denied",
        actorUserId: access.user?.id,
        groupId: access.group.id,
      });
      return { formError: "Only the group owner can change access settings." };
    }

    await enforceRateLimit({
      action: "group.access.update",
      userId: access.user?.id,
      scope: access.group.id,
    });

    const supabase = createAdminClient();
    const { data: result, error } = await supabase.rpc(
      "update_group_access_with_activity",
      {
        p_group_id: access.group.id,
        p_access_mode: validation.data,
        p_actor_user_id: access.user?.id ?? null,
      },
    );

    if (error || (result !== "updated" && result !== "unchanged")) {
      return { formError: "We couldn’t update group access. Please try again." };
    }

    await writeSecurityAuditEvent({
      eventType: "group.access.update",
      outcome: "allowed",
      actorUserId: access.user?.id,
      groupId: access.group.id,
      metadata: { accessMode: validation.data },
    });

    revalidatePath(`/groups/${shareToken}`);
    revalidatePath("/dashboard");

    return {
      successMessage:
        validation.data === "private"
          ? "This group is now private. Only invited members can open it."
          : "This group now works for anyone with its share link.",
    };
  } catch (error) {
    if (isRateLimitError(error)) {
      return { formError: getRateLimitMessage(error) };
    }

    return { formError: "We couldn’t update group access. Please try again." };
  }
}

export async function updateGroupDetails(
  shareToken: string,
  _previousState: UpdateGroupDetailsState,
  formData: FormData,
): Promise<UpdateGroupDetailsState> {
  const validation = updateGroupDetailsSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!validation.success) {
    return { fieldErrors: validation.error.flatten().fieldErrors };
  }

  try {
    const access = await getGroupAccess(shareToken);

    if (!access) {
      return { formError: "This group is no longer available." };
    }

    if (access.group.archivedAt) {
      return { formError: "Restore this group before editing its details." };
    }

    if (!access.permissions.canEditGroup || !access.user) {
      await writeSecurityAuditEvent({
        eventType: "group.settings.update",
        outcome: "denied",
        actorUserId: access.user?.id,
        groupId: access.group.id,
      });
      return { formError: "Only the group owner can edit group details." };
    }

    await enforceRateLimit({
      action: "group.settings.update",
      userId: access.user.id,
      scope: access.group.id,
    });

    const supabase = createAdminClient();
    const { data: result, error } = await supabase.rpc(
      "update_group_details_with_activity",
      {
        p_group_id: access.group.id,
        p_name: validation.data.name,
        p_description: validation.data.description,
        p_actor_user_id: access.user.id,
      },
    );

    if (
      error ||
      (result !== "updated" && result !== "unchanged")
    ) {
      return {
        formError: "We couldn’t update the group details. Please try again.",
      };
    }

    await writeSecurityAuditEvent({
      eventType: "group.settings.update",
      outcome: "allowed",
      actorUserId: access.user.id,
      groupId: access.group.id,
    });

    revalidatePath(`/groups/${shareToken}`);
    revalidatePath("/dashboard");

    return {
      successMessage:
        result === "unchanged"
          ? "The group details are already up to date."
          : "Group details updated.",
    };
  } catch (error) {
    if (isRateLimitError(error)) {
      return { formError: getRateLimitMessage(error) };
    }

    return {
      formError: "We couldn’t update the group details. Please try again.",
    };
  }
}

export async function updateGroupLifecycle(
  shareToken: string,
  _previousState: GroupLifecycleState,
  formData: FormData,
): Promise<GroupLifecycleState> {
  const validation = groupLifecycleIntentSchema.safeParse(
    formData.get("intent"),
  );

  if (!validation.success) {
    return { formError: "Choose a valid group lifecycle action." };
  }

  try {
    const access = await getGroupAccess(shareToken);

    if (!access) {
      return { formError: "This group is no longer available." };
    }

    const intent = validation.data;
    const allowed =
      intent === "archive"
        ? access.permissions.canArchiveGroup
        : access.permissions.canRestoreGroup;

    if (!allowed || !access.user) {
      await writeSecurityAuditEvent({
        eventType: `group.${intent}`,
        outcome: "denied",
        actorUserId: access.user?.id,
        groupId: access.group.id,
      });
      return {
        formError:
          intent === "archive"
            ? "Only the owner of an active group can archive it."
            : "Only the owner of an archived group can restore it.",
      };
    }

    await enforceRateLimit({
      action: "group.lifecycle.update",
      userId: access.user.id,
      scope: access.group.id,
    });

    const supabase = createAdminClient();
    const functionName =
      intent === "archive"
        ? "archive_group_with_activity"
        : "restore_group_with_activity";
    const { data: result, error } = await supabase.rpc(functionName, {
      p_group_id: access.group.id,
      p_actor_user_id: access.user.id,
    });
    const expectedResult = intent === "archive" ? "archived" : "restored";

    if (error || result !== expectedResult) {
      return {
        formError: `We couldn’t ${intent} this group. Please try again.`,
      };
    }

    await writeSecurityAuditEvent({
      eventType: `group.${intent}`,
      outcome: "allowed",
      actorUserId: access.user.id,
      groupId: access.group.id,
    });

    revalidatePath(`/groups/${shareToken}`);
    revalidatePath("/dashboard");

    return {
      successMessage:
        intent === "archive"
          ? "Group archived. Its history is now read-only."
          : "Group restored. Previous permissions are active again.",
    };
  } catch (error) {
    if (isRateLimitError(error)) {
      return { formError: getRateLimitMessage(error) };
    }

    return {
      formError: "We couldn’t update this group. Please try again.",
    };
  }
}

export async function permanentlyDeleteGroup(
  shareToken: string,
  _previousState: DeleteGroupState,
  formData: FormData,
): Promise<DeleteGroupState> {
  const validation = deleteGroupConfirmationSchema.safeParse({
    confirmationName: formData.get("confirmationName"),
  });

  if (!validation.success) {
    return { confirmationError: "Enter the group name to confirm deletion." };
  }

  let deleted = false;
  let deletedGroupId: string | undefined;
  let actorUserId: string | undefined;

  try {
    const access = await getGroupAccess(shareToken);

    if (!access) {
      return { formError: "This group is no longer available." };
    }

    if (!access.permissions.canDeleteGroup || !access.user) {
      await writeSecurityAuditEvent({
        eventType: "group.delete",
        outcome: "denied",
        actorUserId: access.user?.id,
        groupId: access.group.id,
      });
      return {
        formError:
          "Only the owner can permanently delete an archived group.",
      };
    }

    if (validation.data.confirmationName !== access.group.name) {
      return {
        confirmationError: `Enter “${access.group.name}” exactly to confirm deletion.`,
      };
    }

    await enforceRateLimit({
      action: "group.delete",
      userId: access.user.id,
      scope: access.group.id,
    });

    const supabase = createAdminClient();
    const { data: result, error } = await supabase.rpc(
      "permanently_delete_group",
      {
        p_group_id: access.group.id,
        p_actor_user_id: access.user.id,
      },
    );

    if (error || result !== "deleted") {
      return {
        formError: "We couldn’t permanently delete this group. Please try again.",
      };
    }

    deleted = true;
    deletedGroupId = access.group.id;
    actorUserId = access.user.id;
  } catch (error) {
    if (isRateLimitError(error)) {
      return { formError: getRateLimitMessage(error) };
    }

    return {
      formError: "We couldn’t permanently delete this group. Please try again.",
    };
  }

  if (deleted) {
    await writeSecurityAuditEvent({
      eventType: "group.delete",
      outcome: "allowed",
      actorUserId,
      metadata: { deletedGroupId: deletedGroupId ?? "unknown" },
    });
    revalidatePath("/dashboard");
    redirect("/dashboard?group=deleted");
  }

  return {
    formError: "We couldn’t permanently delete this group. Please try again.",
  };
}
