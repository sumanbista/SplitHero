import { Fragment } from "react";
import { CircleCheck, Scale } from "lucide-react";

import { MemberAvatar } from "@/components/members/member-avatar";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
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
    <Card className="py-0">
      <CardContent className="px-0">
        <ul aria-label="Member balances" className="flex flex-col">
          {balances.map((balance, index) => (
            <Fragment key={balance.memberId}>
              {index > 0 ? <Separator /> : null}
              <li className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <MemberAvatar name={balance.memberName} />
                <CardTitle className="min-w-0 flex-1 truncate">
                  {balance.memberName}
                </CardTitle>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "text-xs font-medium",
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
                    <p className="mt-0.5 font-semibold tabular-nums">
                      {formatCurrencyFromCents(
                        Math.abs(balance.balanceCents),
                      )}
                    </p>
                  ) : null}
                </div>
              </li>
            </Fragment>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
