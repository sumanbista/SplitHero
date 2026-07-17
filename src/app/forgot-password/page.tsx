import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordResetRequestForm } from "@/components/auth/password-reset-request-form";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export const metadata: Metadata = {
  title: "Reset your password",
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your account email and we’ll send you a secure reset link."
    >
      {params.error ? (
        <Alert variant="destructive" className="mt-5">
          <AlertDescription>
            That reset link has expired or already been used. Request a new one below.
          </AlertDescription>
        </Alert>
      ) : null}
      <PasswordResetRequestForm />
    </AuthShell>
  );
}
