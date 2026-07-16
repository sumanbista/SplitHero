import { AppLogo } from "@/components/layout/app-logo";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function SectionSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, index) => (
          <Card key={index} size="sm">
            <CardHeader className="flex flex-col gap-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-52 max-w-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default function GroupLoading() {
  return (
    <div className="min-h-dvh" aria-busy="true" aria-label="Loading group dashboard">
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 py-6 sm:px-8">
        <AppLogo showMark />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pt-8 pb-20 sm:px-8 sm:pt-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-12 w-64 max-w-full" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-10">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Card key={index} size="sm" className="min-h-32">
                  <CardHeader className="flex flex-row items-start justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="size-9 rounded-lg" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-7 w-24 max-w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton rows={3} />
            <SectionSkeleton rows={1} />
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            <Card>
              <CardHeader className="flex flex-col gap-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-36" />
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-col gap-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-48 max-w-full" />
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
