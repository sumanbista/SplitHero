import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DEFAULT_AUTHENTICATED_PATH,
  getPostLoginPath,
} from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await getCurrentUser()) {
    redirect(DEFAULT_AUTHENTICATED_PATH);
  }

  const params = await searchParams;
  const nextPath = getPostLoginPath(params.next);

  return (
    <AuthShell
      title="Welcome back"
      description="Log in to your SplitHero account. Public group links still work without an account."
    >
      {params.error ? (
        <Alert variant="destructive" className="mt-5">
          <AlertDescription>
            {params.error === "verification"
              ? "That verification link has expired or already been used. Log in if your email is already verified, or create a new account to request another link."
              : "That sign-in link could not be completed. Please try again."}
          </AlertDescription>
        </Alert>
      ) : null}
      <AuthForm mode="login" nextPath={nextPath} />
    </AuthShell>
  );
}
