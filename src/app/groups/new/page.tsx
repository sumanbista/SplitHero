import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SessionNavigation } from "@/components/auth/session-navigation";
import { CreateGroupForm } from "@/components/groups/create-group-form";
import { AppLogo } from "@/components/layout/app-logo";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Create a group",
  description: "Create a new SplitHero group connected to your account.",
};

export default async function NewGroupPage() {
  const user = await requireUser("/groups/new");

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-5 sm:px-8 sm:py-6">
        <AppLogo href="/dashboard" showMark />
        <nav aria-label="Account navigation">
          <SessionNavigation user={user} />
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-6 pb-16 sm:px-8 sm:pt-10 sm:pb-20">
        <div>
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "-ml-2",
            )}
          >
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Dashboard
          </Link>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Create a new group
          </h1>
          <p className="mt-3 text-lg leading-8 text-muted-foreground">
            Give your group a recognizable name. It will be saved to your
            dashboard automatically.
          </p>
        </div>
        <CreateGroupForm isAuthenticated />
      </main>
    </div>
  );
}
