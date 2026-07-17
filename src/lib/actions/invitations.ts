"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { getGroupAccess } from "@/lib/groups/access";
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
    return { formError: "Only the group owner can send invitations." };
  }

  const supabase = createAdminClient();

  if (validation.data.memberId) {
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, user_id")
      .eq("id", validation.data.memberId)
      .eq("group_id", access.group.id)
      .maybeSingle();

    if (memberError) {
      return { formError: "We couldn’t create the invitation. Please try again." };
    }

    if (!member || member.user_id) {
      return { fieldErrors: { memberId: ["Choose an unlinked group member."] } };
    }
  }

  const now = new Date();
  await supabase
    .from("group_invitations")
    .update({ status: "expired", responded_at: now.toISOString() })
    .eq("group_id", access.group.id)
    .eq("email", validation.data.email)
    .eq("status", "pending")
    .lte("expires_at", now.toISOString());

  const token = generateInvitationToken();
  const { error: invitationError } = await supabase
    .from("group_invitations")
    .insert({
      group_id: access.group.id,
      email: validation.data.email,
      token_hash: hashInvitationToken(token),
      role: validation.data.role,
      invited_member_id: validation.data.memberId,
      invited_by_user_id: user.id,
      expires_at: new Date(now.getTime() + INVITATION_LIFETIME_MS).toISOString(),
    });

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

  const { data, error } = await context.supabase.rpc("accept_group_invitation", {
    p_invitation_id: context.invitation.id,
    p_user_id: context.user.id,
    p_email: context.email,
  });

  if (error || !data?.[0]?.share_token) {
    redirect("/dashboard?invitation=unavailable");
  }

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

  const { error } = await context.supabase
    .from("group_invitations")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", context.invitation.id)
    .eq("status", "pending");

  if (error) {
    redirect("/dashboard?invitation=unavailable");
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?invitation=declined");
}
