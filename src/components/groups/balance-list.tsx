import { CircleCheck, Scale } from "lucide-react";

import { MemberAvatar } from "@/components/members/member-avatar";
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
};

export function BalanceList({ balances }: BalanceListProps) {
  if (balances.length === 0) {
    return (
      <Empty className="border bg-primary-soft/40 py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Scale />
          </EmptyMedia>
          <EmptyTitle>No balances yet</EmptyTitle>
          <EmptyDescription>
            Add group members to start tracking balances.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul aria-label="Member balances" className="flex flex-col">
      {balances.map((balance, index) => (
        <li key={balance.memberId}>
          {index > 0 ? <Separator /> : null}
          <div className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
            <MemberAvatar name={balance.memberName} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{balance.memberName}</p>
              <p
                className={cn(
                  "mt-0.5 text-sm font-medium",
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
            </div>
            {balance.state !== "settled" ? (
              <p className="shrink-0 text-lg font-semibold tabular-nums">
                {formatCurrencyFromCents(Math.abs(balance.balanceCents))}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
