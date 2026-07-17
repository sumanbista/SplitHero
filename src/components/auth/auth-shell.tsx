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
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 py-6 sm:px-8">
        <AppLogo showMark />
      </header>
      <main className="mx-auto flex w-full max-w-md px-6 pt-10 pb-20 sm:px-8 sm:pt-16">
        <Card className="w-full rounded-2xl">
          <CardHeader>
            <CardTitle className="text-2xl tracking-tight">{title}</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </main>
    </div>
  );
}
