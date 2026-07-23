export type GroupAccessMode = "public" | "private";
export type GroupRole = "owner" | "member" | "viewer";

export type GroupPermissions = {
  canView: boolean;
  canEditGroup: boolean;
  canArchiveGroup: boolean;
  canRestoreGroup: boolean;
  canDeleteGroup: boolean;
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
  isArchived = false,
): GroupPermissions {
  const hasPublicLinkAccess = accessMode === "public";
  const isOwner = role === "owner";
  const canContributeAsMember = role === "member";
  const canMutate = !isArchived;

  return {
    canView: hasPublicLinkAccess || role !== null,
    canEditGroup: canMutate && isOwner,
    canArchiveGroup: canMutate && isOwner,
    canRestoreGroup: isArchived && isOwner,
    canDeleteGroup: isArchived && isOwner,
    canManageMembers: canMutate && (hasPublicLinkAccess || isOwner),
    canRenameMembers: canMutate && (hasPublicLinkAccess || isOwner),
    canArchiveMembers: canMutate && (hasPublicLinkAccess || isOwner),
    canRemoveMembers: canMutate && (hasPublicLinkAccess || isOwner),
    canContribute:
      canMutate && (hasPublicLinkAccess || isOwner || canContributeAsMember),
    canEditExpenses:
      canMutate && (hasPublicLinkAccess || isOwner || canContributeAsMember),
    canDeleteExpenses:
      canMutate && (hasPublicLinkAccess || isOwner || canContributeAsMember),
    canInvite: canMutate && isOwner,
    canChangeAccess: canMutate && isOwner,
  };
}
