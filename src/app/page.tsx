import { redirect } from "next/navigation";

import { AppLogo } from "@/components/layout/app-logo";
import { SessionNavigation } from "@/components/auth/session-navigation";
import { CreateGroupForm } from "@/components/groups/create-group-form";
import { GroupPreview } from "@/components/landing/group-preview";
import { HeroNetwork } from "@/components/landing/hero-network";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";

export default async function Home() {
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-[86rem] items-center justify-between px-6 py-6 sm:px-8 lg:px-20">
        <AppLogo />
        <nav aria-label="Main navigation" className="flex items-center gap-1 sm:gap-3">
          <a
            href="#how-it-works"
            className="hidden rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus lg:inline-flex"
          >
            How it works
          </a>
          <SessionNavigation user={null} />
          <Button
            size="lg"
            className="hidden sm:inline-flex"
            nativeButton={false}
            render={<a href="#create-group" />}
          >
            Create a group
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-[86rem] items-center gap-12 px-6 pt-12 pb-20 sm:px-8 sm:pt-16 lg:grid-cols-[1.08fr_0.92fr] lg:gap-20 lg:px-20 lg:pt-20 lg:pb-40">
          <div>
            <h1 className="max-w-3xl text-5xl leading-[1.04] font-bold tracking-[-0.045em] sm:text-6xl lg:text-[4rem]">
              Shared expenses, settled simply.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
              Create a group, add your people, record expenses, and see who
              owes whom—without the awkward math.
            </p>
            <div className="mt-10">
              <HeroNetwork />
            </div>
          </div>
          <CreateGroupForm />
        </section>

        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <HowItWorks />
          <GroupPreview />
          <section className="rounded-[2rem] border border-border bg-primary-soft/45 px-6 py-14 text-center sm:px-10 sm:py-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to make shared costs simple?
            </h2>
            <Button
              className="mt-7"
              size="xl"
              nativeButton={false}
              render={<a href="#create-group" />}
            >
              Create your group
            </Button>
          </section>
        </div>
      </main>

      <footer className="mx-auto flex w-full max-w-[86rem] flex-col gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-20">
        <AppLogo showMark />
        <p>Shared costs, less awkward math.</p>
      </footer>
    </div>
  );
}
