import { ChevronDown, ReceiptText } from "lucide-react";

import { ExpenseActions } from "@/components/expenses/expense-actions";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { formatCurrencyFromCents } from "@/lib/utils/currency";
import { formatExpenseDate } from "@/lib/utils/date";

export type ExpenseListItem = {
  id: string;
  title: string;
  amountCents: number;
  expenseDate: string;
  notes: string;
  paidByMemberId: string;
  paidByName: string;
  updatedAt: string;
  participants: Array<{
    memberId: string;
    memberName: string;
    shareCents: number;
  }>;
};

type ExpenseListProps = {
  expenses: ExpenseListItem[];
  hasMembers: boolean;
  hasSettlementPayments: boolean;
  members: Array<{ id: string; name: string }>;
  canManageExpenses: boolean;
  shareToken: string;
};

export function ExpenseList({
  expenses,
  hasMembers,
  hasSettlementPayments,
  members,
  canManageExpenses,
  shareToken,
}: ExpenseListProps) {
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
    <ul aria-label="Group expenses" className="flex flex-col gap-3">
      {expenses.map((expense) => (
        <li key={expense.id}>
          <Card size="sm">
            <CardHeader>
              <CardTitle className="truncate pr-3">{expense.title}</CardTitle>
              <CardDescription>
                Paid by {expense.paidByName} · Split between{" "}
                {expense.participants.length}{" "}
                {expense.participants.length === 1 ? "person" : "people"}
              </CardDescription>
              <CardAction className="flex items-center gap-1">
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrencyFromCents(expense.amountCents)}
                </p>
                {canManageExpenses ? (
                  <ExpenseActions
                    expense={expense}
                    hasSettlementPayments={hasSettlementPayments}
                    members={members}
                    shareToken={shareToken}
                  />
                ) : null}
              </CardAction>
            </CardHeader>
            <CardContent>
              <time className="block text-xs text-muted-foreground">
                {formatExpenseDate(expense.expenseDate)}
              </time>
            {expense.notes ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {expense.notes}
              </p>
            ) : null}
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
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
