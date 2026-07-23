import { z } from "zod";

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a group name.")
    .max(80, "Group names must be 80 characters or fewer."),
});

export const groupAccessModeSchema = z.enum(["public", "private"]);

export const updateGroupDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a group name.")
    .max(80, "Group names must be 80 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(500, "Descriptions must be 500 characters or fewer.")
    .transform((value) => value || null),
});

export const groupLifecycleIntentSchema = z.enum(["archive", "restore"]);

export const deleteGroupConfirmationSchema = z.object({
  confirmationName: z.string().trim(),
});
