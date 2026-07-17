import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";

import {
  sensitiveActionPolicies,
  type SensitiveAction,
} from "@/lib/security/rate-limit-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerSupabaseEnv } from "@/lib/supabase/server-config";

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Sensitive action rate limit exceeded.");
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function getClientAddress(requestHeaders: Headers) {
  const forwardedAddress = requestHeaders
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  return forwardedAddress || requestHeaders.get("x-real-ip")?.trim() || "unknown";
}

async function getIdentifierHash(userId: string | null, scope: string) {
  const requestHeaders = await headers();
  const actor = userId
    ? `user:${userId}`
    : `ip:${getClientAddress(requestHeaders)}`;
  const { serviceRoleKey } = getServerSupabaseEnv();

  return createHmac("sha256", serviceRoleKey)
    .update(`${actor}\n${scope}`)
    .digest("hex");
}

export async function enforceRateLimit({
  action,
  userId = null,
  scope = "global",
}: {
  action: SensitiveAction;
  userId?: string | null;
  scope?: string;
}) {
  const policy = sensitiveActionPolicies[action];
  const identifierHash = await getIdentifierHash(userId, scope);
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("consume_security_rate_limit", {
    p_action: action,
    p_identifier_hash: identifierHash,
    p_limit: policy.limit,
    p_window_seconds: policy.windowSeconds,
  });
  const result = data?.[0];

  if (error || !result) {
    throw new Error("Unable to verify the action rate limit.");
  }

  if (!result.allowed) {
    throw new RateLimitError(Math.max(1, Number(result.retry_after_seconds) || 1));
  }
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function getRateLimitMessage(error: RateLimitError) {
  const minutes = Math.max(1, Math.ceil(error.retryAfterSeconds / 60));
  return `Too many attempts. Try again in about ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}

