import { Link2, ReceiptText, UsersRound } from "lucide-react";

const steps = [
  {
    title: "Create a group",
    description: "Give your trip, home, or event a name.",
    icon: UsersRound,
  },
  {
    title: "Add your people",
    description: "Share one private link with everyone involved.",
    icon: Link2,
  },
  {
    title: "Settle up clearly",
    description: "See who owes whom in plain language.",
    icon: ReceiptText,
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="scroll-mt-20 rounded-[2rem] border border-border bg-primary-soft/45 px-6 py-16 sm:px-10 lg:px-14 lg:py-20"
    >
      <h2
        id="how-it-works-title"
        className="text-center text-3xl font-bold tracking-tight sm:text-4xl"
      >
        How it works in three simple steps
      </h2>
      <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <li key={step.title} className="relative text-center">
              <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-background text-primary ring-1 ring-primary/25">
                <Icon className="size-8" strokeWidth={1.75} />
              </div>
              <h3 className="mt-5 text-lg font-semibold">
                <span className="mr-2 inline-flex size-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
                  {index + 1}
                </span>
                {step.title}
              </h3>
              <p className="mx-auto mt-3 max-w-xs leading-6 text-muted-foreground">
                {step.description}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
