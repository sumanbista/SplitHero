"use client";

import { AlertCircle } from "lucide-react";

import { AppLogo } from "@/components/layout/app-logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type DashboardErrorProps = {
  unstable_retry: () => void;
};

export default function DashboardError({ unstable_retry }: DashboardErrorProps) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 py-6 sm:px-8">
        <AppLogo href="/dashboard" showMark />
      </header>
      <main className="mx-auto w-full max-w-5xl px-6 pt-12 pb-20 sm:px-8 sm:pt-20">
        <Alert variant="destructive" className="max-w-xl p-5">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>We couldn’t load your dashboard.</AlertTitle>
          <AlertDescription>
            Your account is still safe. Try loading the dashboard again.
          </AlertDescription>
        </Alert>
        <Button size="lg" className="mt-6" onClick={() => unstable_retry()}>
          Try again
        </Button>
      </main>
    </div>
  );
}
