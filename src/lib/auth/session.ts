import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { getSafeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireUser(nextPath = "/protected"): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    const safeNextPath = getSafeNextPath(nextPath, "/protected");
    redirect(`/login?next=${encodeURIComponent(safeNextPath)}`);
  }

  return user;
}
