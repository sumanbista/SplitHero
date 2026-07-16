import { z } from "zod";

export const addMemberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a member name.")
    .max(50, "Member names must be 50 characters or fewer."),
});

export const memberGroupTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/);
