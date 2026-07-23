"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { getGroupAccess } from "@/lib/groups/access";
import { writeSecurityAuditEvent } from "@/lib/security/audit";
import {
  enforceRateLimit,
  getRateLimitMessage,
  isRateLimitError,
} from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createInvitationSchema,
  invitationIdSchema,
  invitationTokenSchema,
} from "@/lib/validations/invitation";
import {
  generateInvitationToken,
  hashInvitationToken,
} from "@/lib/utils/invitation-token";
import { memberGroupTokenSchema } from "@/lib/validations/member";

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export type CreateInvitationState = {
  fieldErrors?: { email?: string[]; role?: string[]; memberId?: string[] };
  formError?: string;
  invitationUrl?: string;
  invitedEmail?: string;
};

export async function createInvitation(
  shareToken: string,
  _previousState: CreateInvitationState,
  formData: FormData,
): Promise<CreateInvitationState> {
  const validation = createInvitationSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    memberId: formData.get("memberId") ?? "none",
  });

  if (!validation.success) {
    return { fieldErrors: validation.error.flatten().fieldErrors };
  }

  if (!memberGroupTokenSchema.safeParse(shareToken).success) {
    return { formError: "This group is no longer available." };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { formError: "Log in as the group owner to invite someone." };
  }

  if (user.email?.trim().toLowerCase() === validation.data.email) {
    return { fieldErrors: { email: ["You already belong to this group as its owner."] } };
  }

  let access;
  try {
    access = await getGroupAccess(shareToken);
  } catch {
    return { formError: "We couldn’t create the invitation. Please try again." };
  }

  if (!access?.permissions.canInvite) {
    await writeSecurityAuditEvent({
      eventType: "invitation.create",
      outcome: "denied",
      actorUserId: user.id,
      groupId: access?.group.id,
    });
    return { formError: "Only the group owner can send invitations." };
  }

  try {
    await enforceRateLimit({
      action: "invitation.create.user",
      userId: user.id,
    });
    await enforceRateLimit({
      action: "invitation.create.group",
      userId: user.id,
      scope: access.group.id,
    });
  } catch (error) {
    if (isRateLimitError(error)) {
      await writeSecurityAuditEvent({
        eventType: "invitation.create",
        outcome: "rate_limited",
        actorUserId: user.id,
        groupId: access.group.id,
      });
      return { formError: getRateLimitMessage(error) };
    }

    return { formError: "We couldn’t verify this invitation. Please try again." };
  }

  const supabase = createAdminClient();

  if (validation.data.memberId) {
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, user_id")
      .eq("id", validation.data.memberId)
      .eq("group_id", access.group.id)
      .eq("is_active", true)
      .maybeSingle();

    if (memberError) {
      return { formError: "We couldn’t create the invitation. Please try again." };
    }

    if (!member || member.user_id) {
      return { fieldErrors: { memberId: ["Choose an unlinked group member."] } };
    }
  }

  const now = new Date();
  const token = generateInvitationToken();
  const { error: invitationError } = await supabase.rpc(
    "create_group_invitation_with_activity",
    {
      p_group_id: access.group.id,
      p_email: validation.data.email,
      p_token_hash: hashInvitationToken(token),
      p_role: validation.data.role,
      p_invited_member_id: validation.data.memberId ?? null,
      p_invited_by_user_id: user.id,
      p_expires_at: new Date(
        now.getTime() + INVITATION_LIFETIME_MS,
      ).toISOString(),
    },
  );

  if (invitationError) {
    if (invitationError.code === "23505") {
      if (validation.data.memberId) {
        return {
          fieldErrors: { memberId: ["That member already has a pending invitation."] },
        };
      }

      return {
        fieldErrors: { email: ["A pending invitation already exists for this email."] },
      };
    }

    return { formError: "We couldn’t create the invitation. Please try again." };
  }

  await writeSecurityAuditEvent({
    eventType: "invitation.create",
    outcome: "allowed",
    actorUserId: user.id,
    groupId: access.group.id,
    metadata: {
      linkedMember: Boolean(validation.data.memberId),
      role: validation.data.role,
    },
  });

  revalidatePath(`/groups/${shareToken}`);
  revalidatePath("/dashboard");

  return {
    invitedEmail: validation.data.email,
    invitationUrl: `/invitations/${token}`,
  };
}

async function getInvitationForAccount(invitationId: string, token?: string) {
  const user = await requireUser(token ? `/invitations/${token}` : "/dashboard");
  const email = user.email?.trim().toLowerCase();

  if (!email) {
    return null;
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("group_invitations")
    .select("id, group_id, status, expires_at, groups!inner(share_token)")
    .eq("id", invitationId)
    .eq("email", email);

  if (token) {
    query = query.eq("token_hash", hashInvitationToken(token));
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return null;
  }

  return { invitation: data, user, email, supabase };
}

export async function acceptInvitation(formData: FormData) {
  const rawId = formData.get("invitationId");
  const rawToken = formData.get("token");
  const idValidation = invitationIdSchema.safeParse(rawId);
  const tokenValidation = typeof rawToken === "string" && rawToken
    ? invitationTokenSchema.safeParse(rawToken)
    : null;

  if (!idValidation.success || (tokenValidation && !tokenValidation.success)) {
    redirect("/dashboard?invitation=invalid");
  }

  const token = tokenValidation?.data;

  const context = await getInvitationForAccount(idValidation.data, token);
  if (!context) {
    redirect("/dashboard?invitation=unavailable");
  }

  try {
    await enforceRateLimit({
      action: "invitation.accept",
      userId: context.user.id,
      scope: context.invitation.group_id,
    });
  } catch (error) {
    if (isRateLimitError(error)) {
      await writeSecurityAuditEvent({
        eventType: "invitation.accept",
        outcome: "rate_limited",
        actorUserId: context.user.id,
        groupId: context.invitation.group_id,
      });
    }
    redirect("/dashboard?invitation=unavailable");
  }

  const isReplay = context.invitation.status === "accepted";

  const { data, error } = await context.supabase.rpc("accept_group_invitation", {
    p_invitation_id: context.invitation.id,
    p_user_id: context.user.id,
    p_email: context.email,
  });

  if (error || !data?.[0]?.share_token) {
    redirect("/dashboard?invitation=unavailable");
  }

  await writeSecurityAuditEvent({
    eventType: "invitation.accept",
    outcome: isReplay ? "replayed" : "allowed",
    actorUserId: context.user.id,
    groupId: context.invitation.group_id,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/groups/${data[0].share_token}`);
  redirect(`/groups/${data[0].share_token}?invitation=accepted`);
}

export async function declineInvitation(formData: FormData) {
  const rawId = formData.get("invitationId");
  const rawToken = formData.get("token");
  const idValidation = invitationIdSchema.safeParse(rawId);
  const tokenValidation = typeof rawToken === "string" && rawToken
    ? invitationTokenSchema.safeParse(rawToken)
    : null;

  if (!idValidation.success || (tokenValidation && !tokenValidation.success)) {
    redirect("/dashboard?invitation=invalid");
  }

  const token = tokenValidation?.data;

  const context = await getInvitationForAccount(idValidation.data, token);
  if (!context || context.invitation.status !== "pending") {
    redirect("/dashboard?invitation=unavailable");
  }

  try {
    await enforceRateLimit({
      action: "invitation.decline",
      userId: context.user.id,
      scope: context.invitation.group_id,
    });
  } catch {
    redirect("/dashboard?invitation=unavailable");
  }

  const { data, error } = await context.supabase.rpc(
    "decline_group_invitation_with_activity",
    {
      p_invitation_id: context.invitation.id,
      p_user_id: context.user.id,
      p_email: context.email,
    },
  );

  if (error || !data) {
    redirect("/dashboard?invitation=unavailable");
  }

  await writeSecurityAuditEvent({
    eventType: "invitation.decline",
    outcome: "allowed",
    actorUserId: context.user.id,
    groupId: context.invitation.group_id,
  });

  revalidatePath("/dashboard");
  redirect("/dashboard?invitation=declined");
}
