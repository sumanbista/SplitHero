import { AppLogo } from "@/components/layout/app-logo";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function GroupLoading() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center px-6 py-6 sm:px-8">
        <AppLogo showMark />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pt-10 pb-20 sm:px-8 sm:pt-16">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-64 max-w-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card>
            <CardHeader className="flex flex-col gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-52" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="self-start">
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
