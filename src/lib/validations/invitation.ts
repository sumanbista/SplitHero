import { z } from "zod";

export const invitationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "This invitation link is invalid.");

export const invitationIdSchema = z.uuid();

export const createInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(254),
  role: z.enum(["member", "viewer"]),
  memberId: z.union([z.uuid(), z.literal("none")]).transform((value) =>
    value === "none" ? null : value,
  ),
});
