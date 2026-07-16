import type { Metadata } from "next";
import { CheckCircle2, Link2 } from "lucide-react";
import { notFound } from "next/navigation";

import { AppLogo } from "@/components/layout/app-logo";
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
    .select("name")
    .eq("share_token", shareToken)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load the group.");
  }

  if (!group) {
    notFound();
  }

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 py-6 sm:px-8">
        <AppLogo showMark />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col px-6 pt-12 pb-20 sm:px-8 sm:pt-20">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <CheckCircle2 className="size-7" />
        </div>
        <p className="mt-8 text-sm font-semibold text-primary">
          Your group is ready
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          {group.name}
        </h1>
        <div className="mt-8 flex max-w-2xl items-start gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Link2 className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">Keep this link handy</h2>
            <p className="mt-1 leading-6 text-muted-foreground">
              Share this page’s private link with everyone who belongs in the
              group.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
