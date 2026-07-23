import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type DashboardProfile = {
  displayName: string | null;
  avatarUrl: string | null;
};

export type OwnedGroupSummary = {
  id: string;
  name: string;
  shareToken: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type MemberGroupSummary = OwnedGroupSummary & {
  role: "member" | "viewer";
};

export type PendingInvitationSummary = {
  id: string;
  groupName: string;
  role: "member" | "viewer";
  expiresAt: string;
  groupArchivedAt: string | null;
};

export type DashboardData = {
  profile: DashboardProfile;
  ownedGroups: OwnedGroupSummary[];
  memberGroups: MemberGroupSummary[];
  pendingInvitations: PendingInvitationSummary[];
};

export async function getDashboardData(
  userId: string,
  userEmail: string | undefined,
): Promise<DashboardData> {
  const supabase = createAdminClient();
  const normalizedEmail = userEmail?.trim().toLowerCase();
  const invitationsPromise = normalizedEmail
    ? supabase
        .from("group_invitations")
        .select("id, role, expires_at, groups!inner(name, archived_at)")
        .eq("email", normalizedEmail)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });
  const [profileResult, groupsResult, membershipsResult, invitationsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("groups")
      .select("id, name, share_token, created_at, updated_at, archived_at")
      .eq("created_by_user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("group_memberships")
      .select(
        "role, groups!inner(id, name, share_token, created_at, updated_at, archived_at)",
      )
      .eq("user_id", userId)
      .neq("role", "owner")
      .order("created_at", { ascending: false }),
    invitationsPromise,
  ]);

  if (
    profileResult.error ||
    groupsResult.error ||
    membershipsResult.error ||
    invitationsResult.error
  ) {
    throw new Error("Unable to load dashboard data.");
  }

  const relatedGroup = <T>(value: T | T[] | null) =>
    Array.isArray(value) ? value[0] : value;

  return {
    profile: {
      displayName: profileResult.data?.display_name ?? null,
      avatarUrl: profileResult.data?.avatar_url ?? null,
    },
    ownedGroups: groupsResult.data.map((group) => ({
      id: group.id,
      name: group.name,
      shareToken: group.share_token,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      archivedAt: group.archived_at,
    })),
    memberGroups: membershipsResult.data.flatMap((membership) => {
      const group = relatedGroup(membership.groups);
      return group
        ? [{
            id: group.id,
            name: group.name,
            shareToken: group.share_token,
            createdAt: group.created_at,
            updatedAt: group.updated_at,
            archivedAt: group.archived_at,
            role: membership.role as "member" | "viewer",
          }]
        : [];
    }),
    pendingInvitations: invitationsResult.data.flatMap((invitation) => {
      const group = relatedGroup(invitation.groups);
      return group
        ? [{
            id: invitation.id,
            groupName: group.name,
            role: invitation.role as "member" | "viewer",
            expiresAt: invitation.expires_at,
            groupArchivedAt: group.archived_at,
          }]
        : [];
    }),
  };
}
