import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, FolderHeart, Mail, MailOpen } from "lucide-react";

import { AppLogo } from "@/components/layout/app-logo";
import { SessionNavigation } from "@/components/auth/session-navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { acceptInvitation, declineInvitation } from "@/lib/actions/invitations";
import { requireUser } from "@/lib/auth/session";
import {
  getAccountDisplayName,
  getAccountInitials,
} from "@/lib/dashboard/account";
import {
  getDashboardData,
  type MemberGroupSummary,
  type OwnedGroupSummary,
  type PendingInvitationSummary,
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

type DashboardPageProps = {
  searchParams: Promise<{ auth?: string; invitation?: string }>;
};

function GroupCard({
  group,
  role,
}: {
  group: OwnedGroupSummary | MemberGroupSummary;
  role: "owner" | "member" | "viewer";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{group.name}</CardTitle>
        <CardDescription>
          {role.charAt(0).toUpperCase() + role.slice(1)} · Updated {accountDateFormatter.format(new Date(group.updatedAt))}
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

function InvitationCard({ invitation }: { invitation: PendingInvitationSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{invitation.groupName}</CardTitle>
        <CardDescription className="capitalize">Invited as {invitation.role}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row">
        <form action={declineInvitation} className="flex-1">
          <input type="hidden" name="invitationId" value={invitation.id} />
          <Button type="submit" variant="outline" className="w-full">Decline</Button>
        </form>
        <form action={acceptInvitation} className="flex-1">
          <input type="hidden" name="invitationId" value={invitation.id} />
          <Button type="submit" className="w-full">Accept</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const user = await requireUser("/dashboard");
  const { profile, ownedGroups, memberGroups, pendingInvitations } =
    await getDashboardData(user.id, user.email);
  const hasGroups = ownedGroups.length + memberGroups.length > 0;
  const displayName = getAccountDisplayName(profile.displayName, user.email);
  const accountCreatedAt = accountDateFormatter.format(new Date(user.created_at));

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-6 sm:px-8">
        <AppLogo showMark />
        <nav aria-label="Account navigation">
          <SessionNavigation user={user} />
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pt-8 pb-20 sm:px-8 sm:pt-12">
        {params.auth === "password-updated" ? (
          <Alert className="border-primary/25 bg-primary-soft/40">
            <AlertDescription className="text-foreground">
              Password updated. You’re signed in and ready to continue.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.invitation === "declined" ? (
          <Alert className="border-primary/25 bg-primary-soft/40">
            <AlertDescription className="text-foreground">Invitation declined.</AlertDescription>
          </Alert>
        ) : params.invitation ? (
          <Alert variant="destructive">
            <AlertDescription>That invitation is invalid, expired, or no longer available.</AlertDescription>
          </Alert>
        ) : null}
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
                Groups you own or joined through an invitation.
              </p>
            </div>

            {hasGroups ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {ownedGroups.map((group) => (
                  <GroupCard key={group.id} group={group} role="owner" />
                ))}
                {memberGroups.map((group) => (
                  <GroupCard key={group.id} group={group} role={group.role} />
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
                    Create a group
                  </Link>
                </EmptyContent>
              </Empty>
            )}

            {pendingInvitations.length > 0 ? (
              <section aria-labelledby="invitations-title" className="mt-4 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <MailOpen aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <h2 id="invitations-title" className="text-xl font-semibold tracking-tight">Pending invitations</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Choose which groups to join.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {pendingInvitations.map((invitation) => (
                    <InvitationCard key={invitation.id} invitation={invitation} />
                  ))}
                </div>
              </section>
            ) : null}
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
                <Link
                  href="/account"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                >
                  Manage account
                </Link>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
