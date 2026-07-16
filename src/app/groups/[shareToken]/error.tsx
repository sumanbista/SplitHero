"use client";

import { AlertCircle } from "lucide-react";

import { AppLogo } from "@/components/layout/app-logo";
import { Button } from "@/components/ui/button";

type GroupErrorProps = {
  unstable_retry: () => void;
};

export default function GroupError({ unstable_retry }: GroupErrorProps) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 py-6 sm:px-8">
        <AppLogo showMark />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col items-start px-6 pt-12 pb-20 sm:px-8 sm:pt-20">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-7" />
        </div>
        <h1 className="mt-8 text-4xl font-bold tracking-tight sm:text-5xl">
          We couldn’t load this group.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
          Something went wrong while loading the group details. Please try
          again.
        </p>
        <Button size="xl" className="mt-8" onClick={() => unstable_retry()}>
          Try again
        </Button>
      </main>
    </div>
  );
}
