import type { ReactNode } from "react";
import { CircleCheck, HandCoins, ReceiptText, Users, WalletCards } from "lucide-react";

import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents } from "@/lib/utils/currency";

type GroupSummaryProps = {
  totalSpentCents: number;
  memberCount: number;
  expenseCount: number;
  settlementCount: number;
};

type SummaryCardProps = {
  label: string;
  value: string;
  icon: ReactNode;
  compactValue?: boolean;
};

function SummaryCard({
  label,
  value,
  icon,
  compactValue = false,
}: SummaryCardProps) {
  return (
    <div className="flex min-w-0 items-center gap-3 bg-card px-4 py-4 sm:px-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <CardDescription className="text-xs">{label}</CardDescription>
        <CardTitle
          className={cn(
            "mt-1 text-base font-semibold tabular-nums sm:text-lg",
            compactValue && "text-sm leading-tight sm:text-sm",
          )}
        >
          {value}
        </CardTitle>
      </div>
    </div>
  );
}

export function GroupSummary({
  totalSpentCents,
  memberCount,
  expenseCount,
  settlementCount,
}: GroupSummaryProps) {
  const settlementStatus =
    expenseCount === 0
      ? "No expenses yet"
      : settlementCount === 0
        ? "Settled up"
        : `${settlementCount} ${settlementCount === 1 ? "payment" : "payments"} remaining`;

  return (
    <section aria-labelledby="group-summary-title">
      <h2 id="group-summary-title" className="sr-only">
        Group summary
      </h2>
      <Card className="grid grid-cols-2 gap-px bg-border p-0 sm:grid-cols-4">
        <SummaryCard
          label="Total spent"
          value={formatCurrencyFromCents(totalSpentCents)}
          icon={<WalletCards aria-hidden="true" />}
        />
        <SummaryCard
          label="Members"
          value={memberCount.toString()}
          icon={<Users aria-hidden="true" />}
        />
        <SummaryCard
          label="Expenses"
          value={expenseCount.toString()}
          icon={<ReceiptText aria-hidden="true" />}
        />
        <SummaryCard
          label="Status"
          value={settlementStatus}
          compactValue
          icon={
            settlementCount === 0 && expenseCount > 0 ? (
              <CircleCheck aria-hidden="true" />
            ) : (
              <HandCoins aria-hidden="true" />
            )
          }
        />
      </Card>
    </section>
  );
}
