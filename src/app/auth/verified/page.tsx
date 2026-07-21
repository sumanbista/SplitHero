import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import {
  addAuthStatusToPath,
  DEFAULT_AUTHENTICATED_PATH,
  getSafeNextPath,
} from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

type VerifiedPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export const metadata: Metadata = {
  title: "Email verified",
};

export default async function VerifiedPage({ searchParams }: VerifiedPageProps) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);

  if (!user) {
    redirect("/login");
  }

  const nextPath = addAuthStatusToPath(
    getSafeNextPath(params.next, DEFAULT_AUTHENTICATED_PATH),
    "email-verified",
  );

  return (
    <AuthShell
      logoHref="/dashboard"
      title="Email verified"
      description="Your SplitHero account is ready and you’re signed in."
    >
      <div className="mt-6 flex flex-col items-center gap-5 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <CheckCircle2 aria-hidden="true" className="size-7" />
        </span>
        <p className="text-sm leading-6 text-muted-foreground">
          You can now use your dashboard, join invited groups, and keep using
          public share links as before.
        </p>
        <Link
          href={nextPath}
          className={cn(buttonVariants({ size: "xl" }), "w-full")}
        >
          Continue to SplitHero
        </Link>
      </div>
    </AuthShell>
  );
}
