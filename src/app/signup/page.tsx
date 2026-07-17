import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Create an account",
};

export default async function SignupPage() {
  if (await getCurrentUser()) {
    redirect("/");
  }

  return (
    <AuthShell
      title="Create your account"
      description="Accounts are optional for now. You can keep creating and using public groups without signing in."
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
