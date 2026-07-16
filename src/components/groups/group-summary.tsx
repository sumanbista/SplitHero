import type { ReactNode } from "react";
import { CircleCheck, HandCoins, ReceiptText, Users, WalletCards } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
};

function SummaryCard({ label, value, icon }: SummaryCardProps) {
  return (
    <Card size="sm" className="min-h-32">
      <CardHeader className="grid grid-cols-[1fr_auto] items-start gap-3">
        <CardDescription>{label}</CardDescription>
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary [&_svg]:size-4">
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        <CardTitle className="text-xl font-semibold tabular-nums sm:text-2xl">
          {value}
        </CardTitle>
      </CardContent>
    </Card>
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
          icon={
            settlementCount === 0 && expenseCount > 0 ? (
              <CircleCheck aria-hidden="true" />
            ) : (
              <HandCoins aria-hidden="true" />
            )
          }
        />
      </div>
    </section>
  );
}
