export type GroupAccessMode = "public" | "private";
export type GroupRole = "owner" | "member" | "viewer";

export type GroupPermissions = {
  canView: boolean;
  canManageMembers: boolean;
  canRenameMembers: boolean;
  canArchiveMembers: boolean;
  canRemoveMembers: boolean;
  canContribute: boolean;
  canEditExpenses: boolean;
  canDeleteExpenses: boolean;
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
    canRenameMembers: hasPublicLinkAccess || isOwner,
    canArchiveMembers: hasPublicLinkAccess || isOwner,
    canRemoveMembers: hasPublicLinkAccess || isOwner,
    canContribute: hasPublicLinkAccess || isOwner || canContributeAsMember,
    canEditExpenses: hasPublicLinkAccess || isOwner || canContributeAsMember,
    canDeleteExpenses: hasPublicLinkAccess || isOwner || canContributeAsMember,
    canInvite: isOwner,
    canChangeAccess: isOwner,
  };
}
