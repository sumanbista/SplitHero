import { CircleCheck, Scale } from "lucide-react";

import { MemberAvatar } from "@/components/members/member-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { MemberBalance } from "@/lib/calculations/balances";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents } from "@/lib/utils/currency";

export type BalanceListItem = MemberBalance & {
  memberName: string;
};

type BalanceListProps = {
  balances: BalanceListItem[];
  hasExpenses: boolean;
};

export function BalanceList({ balances, hasExpenses }: BalanceListProps) {
  if (balances.length === 0 || !hasExpenses) {
    return (
      <Empty className="border bg-primary-soft/40 py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Scale />
          </EmptyMedia>
          <EmptyTitle>No balances yet</EmptyTitle>
          <EmptyDescription>
            {balances.length === 0
              ? "Add group members to start tracking balances."
              : "Add the first shared expense to calculate everyone’s balance."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul aria-label="Member balances" className="grid gap-3 sm:grid-cols-2">
      {balances.map((balance) => (
        <li key={balance.memberId}>
          <Card size="sm" className="h-full">
            <CardHeader className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
              <MemberAvatar name={balance.memberName} />
              <CardTitle className="truncate">{balance.memberName}</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  "text-sm font-medium",
                  balance.state === "receives" && "text-primary",
                  balance.state === "owes" && "text-warning",
                  balance.state === "settled" && "text-success",
                )}
              >
                {balance.state === "receives" ? "Gets back" : null}
                {balance.state === "owes" ? "Owes" : null}
                {balance.state === "settled" ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CircleCheck className="size-4" aria-hidden="true" />
                    Settled up
                  </span>
                ) : null}
              </p>
              {balance.state !== "settled" ? (
                <p className="mt-2 text-xl font-semibold tabular-nums">
                  {formatCurrencyFromCents(Math.abs(balance.balanceCents))}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
