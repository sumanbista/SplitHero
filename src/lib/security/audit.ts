import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type SecurityAuditEvent = {
  eventType: string;
  outcome: "allowed" | "denied" | "rate_limited" | "replayed";
  actorUserId?: string | null;
  groupId?: string | null;
  metadata?: Record<string, boolean | number | string>;
};

export async function writeSecurityAuditEvent(event: SecurityAuditEvent) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("security_audit_log").insert({
      event_type: event.eventType,
      outcome: event.outcome,
      actor_user_id: event.actorUserId ?? null,
      group_id: event.groupId ?? null,
      metadata: event.metadata ?? {},
    });

    if (error) {
      throw new Error("Unable to record the security audit event.");
    }
  } catch {
    // Auditing must not expose internal failures or break an otherwise valid
    // product operation. Production monitoring should alert on insert errors.
  }
}
