import { ReceiptText, UsersRound } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const previewRows = [
  { initial: "S", text: "Suman paid for dinner", value: null },
  { initial: "A", text: "Alex owes $30.00", value: "$30.00" },
  { initial: "M", text: "Maya gets back $30.00", value: "$30.00" },
] as const;

export function GroupPreview() {
  return (
    <section
      aria-labelledby="preview-title"
      className="grid items-center gap-10 py-20 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 lg:py-24"
    >
      <div>
        <h2
          id="preview-title"
          className="max-w-md text-3xl font-bold tracking-tight sm:text-4xl"
        >
          The whole group, on the same page.
        </h2>
        <p className="mt-4 max-w-md text-lg leading-8 text-muted-foreground">
          Clear updates and everyday language keep everyone aligned.
        </p>
      </div>
      <Card className="gap-0 py-0">
        <CardHeader className="grid grid-cols-[auto_1fr] items-center gap-x-3 border-b border-border px-5 py-4 sm:px-6">
          <span className="row-span-2 flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <UsersRound className="size-5" />
          </span>
          <CardTitle className="text-base font-semibold">Dinner Night</CardTitle>
          <CardDescription>A simple preview</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="divide-y divide-border">
            {previewRows.map((row) => (
              <li
                key={row.text}
                className="flex min-h-16 items-center gap-3 px-5 py-3 sm:px-6"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary">
                  {row.initial}
                </span>
                <span className="min-w-0 flex-1 text-sm sm:text-base">
                  {row.text}
                </span>
                {row.value ? (
                  <span className="rounded-lg bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary tabular-nums">
                    {row.value}
                  </span>
                ) : (
                  <ReceiptText
                    aria-hidden="true"
                    className="size-5 text-primary"
                  />
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
