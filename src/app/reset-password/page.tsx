import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      logoHref="/dashboard"
      title="Choose a new password"
      description="Use a new password for your SplitHero account."
    >
      <UpdatePasswordForm />
    </AuthShell>
  );
}
