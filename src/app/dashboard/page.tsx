import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, FolderHeart, Mail } from "lucide-react";

import { AppLogo } from "@/components/layout/app-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { logout } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth/session";
import {
  getAccountDisplayName,
  getAccountInitials,
} from "@/lib/dashboard/account";
import {
  getDashboardData,
  type OwnedGroupSummary,
} from "@/lib/dashboard/data";
import { cn } from "@/lib/utils";

const accountDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your SplitHero account and connected groups.",
};

function OwnedGroupCard({ group }: { group: OwnedGroupSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{group.name}</CardTitle>
        <CardDescription>
          Updated {accountDateFormatter.format(new Date(group.updatedAt))}
        </CardDescription>
        <CardAction>
          <Link
            href={`/groups/${group.shareToken}`}
            aria-label={`Open ${group.name}`}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <ArrowRight aria-hidden="true" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Link
          href={`/groups/${group.shareToken}`}
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
        >
          View group
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const { profile, ownedGroups } = await getDashboardData(user.id);
  const displayName = getAccountDisplayName(profile.displayName, user.email);
  const accountCreatedAt = accountDateFormatter.format(new Date(user.created_at));

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-6 sm:px-8">
        <AppLogo showMark />
        <form action={logout}>
          <Button type="submit" variant="outline" size="lg">
            Log out
          </Button>
        </form>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pt-8 pb-20 sm:px-8 sm:pt-12">
        <section aria-labelledby="dashboard-title">
          <p className="text-sm font-semibold text-primary">Your dashboard</p>
          <h1
            id="dashboard-title"
            className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl"
          >
            Welcome back, {displayName}.
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-muted-foreground">
            See your account details and groups connected to your SplitHero
            account.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <section aria-labelledby="groups-title" className="flex min-w-0 flex-col gap-4">
            <div>
              <h2 id="groups-title" className="text-xl font-semibold tracking-tight">
                Your groups
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Only groups explicitly connected to your account appear here.
              </p>
            </div>

            {ownedGroups.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {ownedGroups.map((group) => (
                  <OwnedGroupCard key={group.id} group={group} />
                ))}
              </div>
            ) : (
              <Empty className="min-h-80 border bg-card">
                <EmptyHeader>
                  <EmptyMedia
                    variant="icon"
                    className="size-12 rounded-xl bg-primary-soft text-primary"
                  >
                    <FolderHeart aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle className="text-lg">No connected groups yet</EmptyTitle>
                  <EmptyDescription>
                    Groups connected to your account will appear here. Public
                    share-link groups still work without signing in.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Link
                    href="/#create-group"
                    className={cn(buttonVariants({ size: "lg" }))}
                  >
                    Create a public group
                  </Link>
                </EmptyContent>
              </Empty>
            )}
          </section>

          <aside aria-labelledby="account-title">
            <Card>
              <CardHeader>
                <CardTitle id="account-title">Account</CardTitle>
                <CardDescription>Your basic SplitHero profile.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <Avatar size="lg">
                    {profile.avatarUrl ? (
                      <AvatarImage src={profile.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback>{getAccountInitials(displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium" title={displayName}>
                      {displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">Signed in</p>
                  </div>
                </div>
                <dl className="flex flex-col gap-4 text-sm">
                  <div className="flex items-start gap-3">
                    <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Email</dt>
                      <dd className="truncate" title={user.email}>
                        {user.email ?? "Not available"}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <dt className="text-xs text-muted-foreground">Member since</dt>
                      <dd>{accountCreatedAt}</dd>
                    </div>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
