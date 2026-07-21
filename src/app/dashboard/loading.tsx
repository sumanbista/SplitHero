import { AppLogo } from "@/components/layout/app-logo";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div
      className="min-h-dvh"
      aria-busy="true"
      aria-label="Loading your dashboard"
    >
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 py-6 sm:px-8">
        <AppLogo href="/dashboard" showMark />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pt-8 pb-20 sm:px-8 sm:pt-12">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-12 w-80 max-w-full" />
          <Skeleton className="h-6 w-xl max-w-full" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <Card className="min-h-80">
              <CardContent className="flex flex-1 flex-col items-center justify-center gap-4">
                <Skeleton className="size-12 rounded-xl" />
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-72 max-w-full" />
                <Skeleton className="h-9 w-44" />
              </CardContent>
            </Card>
          </section>
          <Card>
            <CardHeader className="flex flex-col gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-44" />
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
