export type SensitiveAction =
  | "auth.login"
  | "auth.password_reset"
  | "auth.password_update"
  | "auth.signup"
  | "expense.create"
  | "expense.delete"
  | "expense.update"
  | "group.access.update"
  | "group.create"
  | "invitation.accept"
  | "invitation.create.group"
  | "invitation.create.user"
  | "invitation.decline"
  | "member.create"
  | "member.update"
  | "settlement.create";

export type RateLimitPolicy = {
  limit: number;
  windowSeconds: number;
};

export const sensitiveActionPolicies: Record<SensitiveAction, RateLimitPolicy> = {
  "auth.login": { limit: 10, windowSeconds: 15 * 60 },
  "auth.password_reset": { limit: 5, windowSeconds: 60 * 60 },
  "auth.password_update": { limit: 5, windowSeconds: 60 * 60 },
  "auth.signup": { limit: 5, windowSeconds: 60 * 60 },
  "expense.create": { limit: 120, windowSeconds: 60 * 60 },
  "expense.delete": { limit: 60, windowSeconds: 60 * 60 },
  "expense.update": { limit: 120, windowSeconds: 60 * 60 },
  "group.access.update": { limit: 20, windowSeconds: 60 * 60 },
  "group.create": { limit: 10, windowSeconds: 60 * 60 },
  "invitation.accept": { limit: 20, windowSeconds: 60 * 60 },
  "invitation.create.group": { limit: 25, windowSeconds: 24 * 60 * 60 },
  "invitation.create.user": { limit: 10, windowSeconds: 60 * 60 },
  "invitation.decline": { limit: 20, windowSeconds: 60 * 60 },
  "member.create": { limit: 60, windowSeconds: 60 * 60 },
  "member.update": { limit: 120, windowSeconds: 60 * 60 },
  "settlement.create": { limit: 120, windowSeconds: 60 * 60 },
};
