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
};

export type DashboardData = {
  profile: DashboardProfile;
  ownedGroups: OwnedGroupSummary[];
};

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = createAdminClient();
  const [profileResult, groupsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("groups")
      .select("id, name, share_token, created_at, updated_at")
      .eq("created_by_user_id", userId)
      .order("updated_at", { ascending: false }),
  ]);

  if (profileResult.error || groupsResult.error) {
    throw new Error("Unable to load dashboard data.");
  }

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
    })),
  };
}
