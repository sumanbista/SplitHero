import Link from "next/link";
import { Link2Off } from "lucide-react";

import { AppLogo } from "@/components/layout/app-logo";
import { Button } from "@/components/ui/button";

export default function GroupNotFound() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 py-6 sm:px-8">
        <AppLogo showMark />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col items-start px-6 pt-12 pb-20 sm:px-8 sm:pt-20">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Link2Off className="size-7" />
        </div>
        <h1 className="mt-8 max-w-xl text-4xl font-bold tracking-tight sm:text-5xl">
          This group does not exist, or the link may be incorrect.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
          Check the link you received, or start a new group from the homepage.
        </p>
        <Button
          size="xl"
          className="mt-8"
          nativeButton={false}
          render={<Link href="/" />}
        >
          Create a new group
        </Button>
      </main>
    </div>
  );
}
