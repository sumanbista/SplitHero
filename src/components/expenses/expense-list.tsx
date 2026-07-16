import { ChevronDown, ReceiptText } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { formatCurrencyFromCents } from "@/lib/utils/currency";
import { formatExpenseDate } from "@/lib/utils/date";

export type ExpenseListItem = {
  id: string;
  title: string;
  amountCents: number;
  expenseDate: string;
  paidByName: string;
  participants: Array<{
    memberId: string;
    memberName: string;
    shareCents: number;
  }>;
};

type ExpenseListProps = {
  expenses: ExpenseListItem[];
  hasMembers: boolean;
};

export function ExpenseList({ expenses, hasMembers }: ExpenseListProps) {
  if (expenses.length === 0) {
    return (
      <Empty className="border bg-primary-soft/40 py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ReceiptText />
          </EmptyMedia>
          <EmptyTitle>No expenses yet</EmptyTitle>
          <EmptyDescription>
            {hasMembers
              ? "Add the first shared expense to start tracking this group."
              : "Add a member before recording the first shared expense."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul aria-label="Group expenses" className="flex flex-col">
      {expenses.map((expense, index) => (
        <li key={expense.id}>
          {index > 0 ? <Separator /> : null}
          <article className="py-5 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{expense.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Paid by {expense.paidByName} · Split between{" "}
                  {expense.participants.length}{" "}
                  {expense.participants.length === 1 ? "person" : "people"}
                </p>
                <time className="mt-1 block text-xs text-muted-foreground">
                  {formatExpenseDate(expense.expenseDate)}
                </time>
              </div>
              <p className="shrink-0 text-lg font-semibold tabular-nums">
                {formatCurrencyFromCents(expense.amountCents)}
              </p>
            </div>
            <details className="group mt-4">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                View split
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-3 flex flex-col gap-2 rounded-lg bg-muted/60 p-3">
                {expense.participants.map((participant) => (
                  <li
                    key={participant.memberId}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="truncate">{participant.memberName}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatCurrencyFromCents(participant.shareCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </article>
        </li>
      ))}
    </ul>
  );
}
