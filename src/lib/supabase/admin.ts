import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServerSupabaseEnv } from "@/lib/supabase/server-config";

export function createAdminClient() {
  const { url, serviceRoleKey } = getServerSupabaseEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
