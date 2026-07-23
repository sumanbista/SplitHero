import "server-only";

import type { User } from "@supabase/supabase-js";

import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getGroupPermissions,
  type GroupAccessMode,
  type GroupRole,
} from "@/lib/groups/permissions";

export type GroupAccess = {
  group: {
    id: string;
    name: string;
    description: string | null;
    shareToken: string;
    accessMode: GroupAccessMode;
    createdByUserId: string | null;
    archivedAt: string | null;
  };
  user: User | null;
  role: GroupRole | null;
  permissions: ReturnType<typeof getGroupPermissions>;
};

export async function getGroupAccess(
  shareToken: string,
): Promise<GroupAccess | null> {
  const userPromise = getCurrentUser();
  const supabase = createAdminClient();
  const { data: group, error } = await supabase
    .from("groups")
    .select(
      "id, name, description, share_token, access_mode, created_by_user_id, archived_at",
    )
    .eq("share_token", shareToken)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to check group access.");
  }

  if (!group) {
    return null;
  }

  const user = await userPromise;
  let role: GroupRole | null = null;

  if (user) {
    const { data: membership, error: membershipError } = await supabase
      .from("group_memberships")
      .select("role")
      .eq("group_id", group.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      throw new Error("Unable to check group membership.");
    }

    role = (membership?.role as GroupRole | undefined) ?? null;
  }

  const accessMode = group.access_mode as GroupAccessMode;

  return {
    group: {
      id: group.id,
      name: group.name,
      description: group.description,
      shareToken: group.share_token,
      accessMode,
      createdByUserId: group.created_by_user_id,
      archivedAt: group.archived_at,
    },
    user,
    role,
    permissions: getGroupPermissions(
      accessMode,
      role,
      group.archived_at !== null,
    ),
  };
}
