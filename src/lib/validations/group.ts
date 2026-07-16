import { z } from "zod";

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a group name.")
    .max(80, "Group names must be 80 characters or fewer."),
});
