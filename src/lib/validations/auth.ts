import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(72, "Password must be 72 characters or fewer.");

export const authCredentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const passwordResetSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(({ confirmPassword, password }) => confirmPassword === password, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const profileDisplayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter a display name.")
    .max(80, "Display name must be 80 characters or fewer."),
});
