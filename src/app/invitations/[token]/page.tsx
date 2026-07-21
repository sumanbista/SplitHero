import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { AppLogo } from "@/components/layout/app-logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptInvitation, declineInvitation } from "@/lib/actions/invitations";
import { getCurrentUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { hashInvitationToken } from "@/lib/utils/invitation-token";
import { invitationTokenSchema } from "@/lib/validations/invitation";
import { createAdminClient } from "@/lib/supabase/admin";

type InvitationPageProps = { params: Promise<{ token: string }> };

export const metadata: Metadata = { title: "Group invitation" };

export default async function InvitationPage({ params }: InvitationPageProps) {
  const { token: rawToken } = await params;
  const tokenValidation = invitationTokenSchema.safeParse(rawToken);
  if (!tokenValidation.success) notFound();

  const token = tokenValidation.data;
  const userPromise = getCurrentUser();
  const supabase = createAdminClient();
  const { data: invitation, error } = await supabase
    .from("group_invitations")
    .select("id, email, role, status, expires_at, groups!inner(name)")
    .eq("token_hash", hashInvitationToken(token))
    .maybeSingle();
  const user = await userPromise;

  if (error) throw new Error("Unable to load this invitation.");
  if (!invitation) notFound();

  const group = Array.isArray(invitation.groups) ? invitation.groups[0] : invitation.groups;
  const isPending = invitation.status === "pending" && new Date(invitation.expires_at) > new Date();
  const matchesAccount = user?.email?.trim().toLowerCase() === invitation.email;
  const nextPath = `/invitations/${token}`;

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-xl px-6 py-6">
        <AppLogo href={user ? "/dashboard" : "/"} showMark />
      </header>
      <main className="mx-auto w-full max-w-xl px-6 pt-10 pb-20">
        <Card>
          <CardHeader className="text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <MailCheck aria-hidden="true" />
            </span>
            <CardTitle className="mt-3 text-2xl">You’re invited to {group?.name ?? "a group"}</CardTitle>
            <CardDescription>Accept to connect this group to your SplitHero dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!isPending ? (
              <Alert><AlertDescription>This invitation is no longer available.</AlertDescription></Alert>
            ) : !user ? (
              <>
                <Alert><AlertDescription>Log in or create an account using the invited email address to respond.</AlertDescription></Alert>
                <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className={cn(buttonVariants({ size: "lg" }))}>Log in to respond</Link>
                <Link href={`/signup?next=${encodeURIComponent(nextPath)}`} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>Create an account</Link>
              </>
            ) : !matchesAccount ? (
              <Alert variant="destructive"><AlertDescription>This invitation was sent to a different email address.</AlertDescription></Alert>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <form action={declineInvitation}>
                  <input type="hidden" name="invitationId" value={invitation.id} />
                  <input type="hidden" name="token" value={token} />
                  <Button type="submit" variant="outline" size="lg" className="w-full">Decline</Button>
                </form>
                <form action={acceptInvitation}>
                  <input type="hidden" name="invitationId" value={invitation.id} />
                  <input type="hidden" name="token" value={token} />
                  <Button type="submit" size="lg" className="w-full">Accept invitation</Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
