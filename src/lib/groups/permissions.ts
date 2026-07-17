export type GroupAccessMode = "public" | "private";
export type GroupRole = "owner" | "member" | "viewer";

export type GroupPermissions = {
  canView: boolean;
  canManageMembers: boolean;
  canContribute: boolean;
  canInvite: boolean;
  canChangeAccess: boolean;
};

export function getGroupPermissions(
  accessMode: GroupAccessMode,
  role: GroupRole | null,
): GroupPermissions {
  const hasPublicLinkAccess = accessMode === "public";
  const isOwner = role === "owner";
  const canContributeAsMember = role === "member";

  return {
    canView: hasPublicLinkAccess || role !== null,
    canManageMembers: hasPublicLinkAccess || isOwner,
    canContribute: hasPublicLinkAccess || isOwner || canContributeAsMember,
    canInvite: isOwner,
    canChangeAccess: isOwner,
  };
}
