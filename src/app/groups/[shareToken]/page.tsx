import type { Metadata } from "next";
import { Link2, Users } from "lucide-react";
import { notFound } from "next/navigation";

import { AppLogo } from "@/components/layout/app-logo";
import { AddMemberDialog } from "@/components/members/add-member-dialog";
import { MemberList } from "@/components/members/member-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";

type GroupPageProps = {
  params: Promise<{ shareToken: string }>;
};

export const metadata: Metadata = {
  title: "Your group",
  description: "A shared SplitHero group.",
};

export default async function GroupPage({ params }: GroupPageProps) {
  const { shareToken } = await params;
  const supabase = createAdminClient();
  const { data: group, error } = await supabase
    .from("groups")
    .select("id, name")
    .eq("share_token", shareToken)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load the group.");
  }

  if (!group) {
    notFound();
  }

  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("id, name")
    .eq("group_id", group.id)
    .order("created_at", { ascending: true });

  if (membersError) {
    throw new Error("Unable to load group members.");
  }

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 py-6 sm:px-8">
        <AppLogo showMark />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pt-10 pb-20 sm:px-8 sm:pt-16">
        <section className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Your group</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              {group.name}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {members.length === 0
                ? "Start by adding everyone in the group."
                : `${members.length} ${members.length === 1 ? "member" : "members"}`}
            </p>
          </div>
          <AddMemberDialog shareToken={shareToken} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Users className="size-5" />
                </span>
                <div>
                  <CardTitle>Members</CardTitle>
                  <CardDescription>
                    Everyone included in this group.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <MemberList members={members} />
            </CardContent>
          </Card>

          <Card className="self-start">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="size-4 text-primary" />
                Keep this link handy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-6 text-muted-foreground">
                Share this page’s private link with everyone who belongs in the
                group.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
