import type { ReactNode } from "react";

import { AppLogo } from "@/components/layout/app-logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AuthShellProps = {
  children: ReactNode;
  description: string;
  title: string;
};

export function AuthShell({ children, description, title }: AuthShellProps) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center px-4 py-5 sm:px-8 sm:py-6">
        <AppLogo showMark />
      </header>
      <main className="mx-auto flex w-full max-w-md px-4 pt-2 pb-12 sm:px-8 sm:pt-12 sm:pb-20">
        <Card className="w-full rounded-2xl shadow-none sm:shadow-sm">
          <CardHeader className="px-5 pt-6 sm:px-6">
            <CardTitle className="text-2xl tracking-tight">{title}</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </CardHeader>
          <CardContent className="px-5 pb-6 sm:px-6">{children}</CardContent>
        </Card>
      </main>
    </div>
  );
}
