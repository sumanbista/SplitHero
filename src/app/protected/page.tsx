import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { AppLogo } from "@/components/layout/app-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logout } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Protected account check",
};

export default async function ProtectedPage() {
  const user = await requireUser("/protected");

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 py-6 sm:px-8">
        <AppLogo showMark />
      </header>
      <main className="mx-auto w-full max-w-lg px-6 pt-12 pb-20 sm:px-8">
        <Card className="rounded-2xl">
          <CardHeader>
            <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <CardTitle className="text-2xl">Your session is active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              This basic protected route is only visible while you are logged in
              as <span className="font-medium text-foreground">{user.email}</span>.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/" className={cn(buttonVariants({ size: "lg" }))}>
                Back to SplitHero
              </Link>
              <form action={logout}>
                <Button type="submit" size="lg" variant="outline">
                  Log out
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
