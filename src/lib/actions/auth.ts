"use server";

import { redirect } from "next/navigation";

import { getSafeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import { authCredentialsSchema } from "@/lib/validations/auth";

export type AuthActionState = {
  error?: string;
  fieldErrors?: {
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

function getAuthCallbackUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelUrl = process.env.VERCEL_URL;
  const origin = siteUrl
    ? siteUrl
    : vercelUrl
      ? `https://${vercelUrl}`
      : "http://localhost:3000";

  return new URL("/auth/callback", origin).toString();
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
    return { error: "Email or password is incorrect." };
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
      emailRedirectTo: `${getAuthCallbackUrl()}?next=${encodeURIComponent(nextPath)}`,
    },
  });

  if (error) {
    return { error: "We could not create your account. Please try again." };
  }

  if (data.session) {
    redirect(nextPath);
  }

  return {
    success: "Check your email to confirm your account, then come back to log in.",
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
