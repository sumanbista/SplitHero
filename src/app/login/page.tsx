import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getSafeNextPath } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await getCurrentUser()) {
    redirect("/");
  }

  const params = await searchParams;
  const nextPath = getSafeNextPath(params.next, "/");

  return (
    <AuthShell
      title="Welcome back"
      description="Log in to your SplitHero account. Public group links still work without an account."
    >
      {params.error ? (
        <Alert variant="destructive" className="mt-5">
          <AlertDescription>
            That sign-in link could not be completed. Please try again.
          </AlertDescription>
        </Alert>
      ) : null}
      <AuthForm mode="login" nextPath={nextPath} />
    </AuthShell>
  );
}
