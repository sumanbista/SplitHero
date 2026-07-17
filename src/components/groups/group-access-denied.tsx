import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { SessionNavigation } from "@/components/auth/session-navigation";
import { AppLogo } from "@/components/layout/app-logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function GroupAccessDenied({
  shareToken,
  user,
}: {
  shareToken: string;
  user: User | null;
}) {
  const isSignedIn = Boolean(user);
  const nextPath = `/groups/${shareToken}`;

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-6 sm:px-8">
        <AppLogo showMark />
        <nav aria-label="Account navigation" className="flex items-center gap-1 sm:gap-3">
          <SessionNavigation user={user} />
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col items-start px-6 pt-12 pb-20 sm:px-8 sm:pt-20">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <LockKeyhole className="size-7" />
        </div>
        <p className="mt-8 text-sm font-semibold text-primary">Private group</p>
        <h1 className="mt-2 max-w-xl text-4xl font-bold tracking-tight sm:text-5xl">
          {isSignedIn ? "You don’t have access to this group." : "Log in to open this group."}
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
          {isSignedIn
            ? "Ask the group owner to invite this account, or switch to the account that received the invitation."
            : "Private groups are available only to invited SplitHero members. Public share links still work without an account."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {!isSignedIn ? (
            <Link
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              className={cn(buttonVariants({ size: "xl" }))}
            >
              Log in
            </Link>
          ) : null}
          <Link
            href={isSignedIn ? "/dashboard" : "/"}
            className={cn(buttonVariants({ variant: "outline", size: "xl" }))}
          >
            {isSignedIn ? "Go to dashboard" : "Go home"}
          </Link>
        </div>
      </main>
    </div>
  );
}
