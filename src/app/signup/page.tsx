import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  DEFAULT_AUTHENTICATED_PATH,
  getSafeNextPath,
} from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";

type SignupPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export const metadata: Metadata = {
  title: "Create an account",
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  if (await getCurrentUser()) {
    redirect(DEFAULT_AUTHENTICATED_PATH);
  }

  const params = await searchParams;
  const nextPath = getSafeNextPath(params.next, DEFAULT_AUTHENTICATED_PATH);

  return (
    <AuthShell
      title="Create your account"
      description="Accounts are optional for now. You can keep creating and using public groups without signing in."
    >
      <AuthForm mode="signup" nextPath={nextPath} />
    </AuthShell>
  );
}
