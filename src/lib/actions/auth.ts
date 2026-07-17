"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getFriendlyAuthError } from "@/lib/auth/errors";
import {
  addAuthStatusToPath,
  getSafeNextPath,
} from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import {
  authCredentialsSchema,
  emailSchema,
  passwordResetSchema,
  profileDisplayNameSchema,
} from "@/lib/validations/auth";

export type AuthActionState = {
  error?: string;
  fieldErrors?: {
    confirmPassword?: string[];
    email?: string[];
    password?: string[];
  };
  success?: string;
};

function validateCredentials(formData: FormData) {
  return authCredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

export type ProfileActionState = {
  error?: string;
  fieldErrors?: { displayName?: string[] };
  success?: string;
};

function getSiteOrigin() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelUrl = process.env.VERCEL_URL;
  return siteUrl
    ? siteUrl
    : vercelUrl
      ? `https://${vercelUrl}`
      : "http://localhost:3000";
}

function getAuthCallbackUrl(mode: "recovery" | "verify", nextPath: string) {
  const callbackUrl = new URL("/auth/callback", getSiteOrigin());

  callbackUrl.searchParams.set("mode", mode);
  callbackUrl.searchParams.set("next", getSafeNextPath(nextPath));

  return callbackUrl.toString();
}

export async function login(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const validated = validateCredentials(formData);

  if (!validated.success) {
    return { fieldErrors: validated.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(validated.data);

  if (error) {
    return { error: getFriendlyAuthError("login", error.code) };
  }

  redirect(getSafeNextPath(formData.get("next")?.toString()));
}

export async function signup(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const validated = validateCredentials(formData);

  if (!validated.success) {
    return { fieldErrors: validated.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const nextPath = getSafeNextPath(formData.get("next")?.toString());
  const { data, error } = await supabase.auth.signUp({
    ...validated.data,
    options: {
      emailRedirectTo: getAuthCallbackUrl("verify", nextPath),
    },
  });

  if (error) {
    return { error: getFriendlyAuthError("signup", error.code) };
  }

  if (data.session) {
    redirect(addAuthStatusToPath(nextPath, "account-created"));
  }

  return {
    success:
      "Check your inbox and open the verification link to finish creating your account.",
  };
}

export async function requestPasswordReset(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const validated = emailSchema.safeParse(formData.get("email"));

  if (!validated.success) {
    return { fieldErrors: { email: validated.error.issues.map(({ message }) => message) } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(validated.data, {
    redirectTo: getAuthCallbackUrl("recovery", "/reset-password"),
  });

  if (error) {
    return { error: getFriendlyAuthError("password-recovery", error.code) };
  }

  return {
    success:
      "If an account matches that email, we sent a password-reset link. Check your inbox and spam folder.",
  };
}

export async function updatePassword(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const validated = passwordResetSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validated.success) {
    return { fieldErrors: validated.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "This reset link has expired or already been used. Request a new one to continue.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: validated.data.password,
  });

  if (error) {
    return { error: getFriendlyAuthError("password-update", error.code) };
  }

  redirect("/dashboard?auth=password-updated");
}

export async function updateDisplayName(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const validated = profileDisplayNameSchema.safeParse({
    displayName: formData.get("displayName"),
  });

  if (!validated.success) {
    return { fieldErrors: validated.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Your session has ended. Log in again to update your profile." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: validated.data.displayName })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { error: "We could not update your display name. Please try again." };
  }

  revalidatePath("/account");
  revalidatePath("/dashboard");

  return { success: "Display name updated." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
