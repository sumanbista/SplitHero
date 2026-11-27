import { Fragment } from "react";
import { ChevronDown, CircleCheck, Scale } from "lucide-react";

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
import type { BalanceExplanation } from "@/lib/calculations/balance-explanation";
import type { MemberBalance } from "@/lib/calculations/balances";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents } from "@/lib/utils/currency";
import { formatExpenseDate } from "@/lib/utils/date";

export type BalanceListItem = MemberBalance & {
  memberName: string;
};

type BalanceListProps = {
  balances: BalanceListItem[];
  hasExpenses: boolean;
  /** Line-by-line breakdown per member id; rows expand to show it. */
  explanations?: Record<string, BalanceExplanation>;
};

function formatSignedCents(cents: number) {
  const formatted = formatCurrencyFromCents(Math.abs(cents));
  if (cents > 0) return `+${formatted}`;
  if (cents < 0) return `−${formatted}`;
  return formatted;
}

function BalanceExplanationLines({
  explanation,
  state,
}: {
  explanation: BalanceExplanation;
  state: MemberBalance["state"];
}) {
  return (
    <div className="border-t bg-muted/30 px-4 py-3 text-sm sm:px-5">
      <p className="mb-2 text-xs text-muted-foreground">
        Each line is what this person paid minus their share, plus payments
        they sent, minus payments they received.
      </p>
      <ul aria-label="How this balance adds up" className="flex flex-col gap-2">
        {explanation.lines.map((line) => (
          <li
            key={`${line.kind}-${line.id}`}
            className="flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              {line.kind === "expense" ? (
                <>
                  <p className="truncate font-medium">{line.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatExpenseDate(line.date)} · paid{" "}
                    {formatCurrencyFromCents(line.paidCents)} · share{" "}
                    {formatCurrencyFromCents(line.shareCents)}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">
                    {line.direction === "sent"
                      ? `Paid ${line.otherMemberName}`
                      : `Received from ${line.otherMemberName}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatExpenseDate(line.date)} · settlement payment of{" "}
                    {formatCurrencyFromCents(line.amountCents)}
                  </p>
                </>
              )}
            </div>
            <p className="shrink-0 font-semibold tabular-nums">
              {formatSignedCents(line.netCents)}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center justify-between border-t pt-2 font-semibold">
        <span>
          {state === "receives"
            ? "Gets back"
            : state === "owes"
              ? "Owes"
              : "Settled up"}
        </span>
        <span className="tabular-nums">
          {formatCurrencyFromCents(Math.abs(explanation.totalCents))}
        </span>
      </p>
    </div>
  );
}

function BalanceRow({ balance }: { balance: BalanceListItem }) {
  return (
    <>
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
            {formatCurrencyFromCents(Math.abs(balance.balanceCents))}
          </p>
        ) : null}
      </div>
    </>
  );
}

export function BalanceList({
  balances,
  hasExpenses,
  explanations,
}: BalanceListProps) {
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
              <li>
                {explanations?.[balance.memberId]?.lines.length ? (
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
                      <BalanceRow balance={balance} />
                      <ChevronDown
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                      <span className="sr-only">
                        Show how {balance.memberName}’s balance adds up
                      </span>
                    </summary>
                    <BalanceExplanationLines
                      explanation={explanations[balance.memberId]}
                      state={balance.state}
                    />
                  </details>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                    <BalanceRow balance={balance} />
                  </div>
                )}
              </li>
            </Fragment>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
