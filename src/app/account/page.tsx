import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

import { ProfileForm } from "@/components/auth/profile-form";
import { SessionNavigation } from "@/components/auth/session-navigation";
import { AppLogo } from "@/components/layout/app-logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import {
  getAccountDisplayName,
  getAccountInitials,
} from "@/lib/dashboard/account";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your SplitHero profile.",
};

export default async function AccountPage() {
  const user = await requireUser("/account");
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load account profile.");
  }

  const displayName = getAccountDisplayName(profile?.display_name, user.email);

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
            className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "-ml-2")}
          >
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Dashboard
          </Link>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Your account
          </h1>
          <p className="mt-3 text-lg leading-8 text-muted-foreground">
            Keep your SplitHero profile simple and recognizable.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarFallback>{getAccountInitials(displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <CardTitle className="truncate">{displayName}</CardTitle>
                <CardDescription>Profile details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <ProfileForm displayName={profile?.display_name ?? ""} />
            <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-4 text-sm">
              <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Account email</p>
                <p className="truncate" title={user.email}>
                  {user.email ?? "Not available"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
