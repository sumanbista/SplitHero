import "server-only";

import { z } from "zod";

const serverSupabaseEnvSchema = z.object({
  url: z.url(),
  serviceRoleKey: z.string().min(1),
});

export function getServerSupabaseEnv() {
  return serverSupabaseEnvSchema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
